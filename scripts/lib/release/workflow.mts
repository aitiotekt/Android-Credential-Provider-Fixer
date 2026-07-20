import { execFileSync } from "node:child_process";
import { loadMetadata, REPO_ROOT } from "./metadata.mts";
import {
	assertTagMatchesVersion,
	parseReleaseVersion,
	resolveReleasePlan,
} from "./policy.mts";

function git(arguments_: string[]): string {
	return execFileSync("git", arguments_, {
		cwd: REPO_ROOT,
		encoding: "utf8",
	}).trim();
}

function remoteTagTarget(tag: string): string | undefined {
	const output = git([
		"ls-remote",
		"--tags",
		"origin",
		`refs/tags/${tag}`,
		`refs/tags/${tag}^{}`,
	]);
	if (!output) {
		return undefined;
	}
	const lines = output.split("\n");
	const peeled = lines.find((line) => line.endsWith(`refs/tags/${tag}^{}`));
	return (peeled ?? lines[0]).split(/\s+/)[0];
}

export function testsPreflight(sourceRef: string, sourceSha: string) {
	const metadata = loadMetadata();
	const parsed = parseReleaseVersion(
		metadata.project.version,
		metadata.release.tagPrefix,
	);
	assertTagMatchesVersion(metadata, sourceRef);
	const releaseBranchRef = `refs/heads/${metadata.release.branch}`;
	const expectedTagRef = `refs/tags/${parsed.tag}`;
	let releasePrepareCandidate = false;
	let expectedTagStatus: "missing" | "same" | "different" = "missing";
	const target = remoteTagTarget(parsed.tag);
	if (target) {
		expectedTagStatus = target === sourceSha ? "same" : "different";
	}
	if (sourceRef === releaseBranchRef && parsed.isPrerelease) {
		if (expectedTagStatus === "different") {
			throw new Error(`Tag ${parsed.tag} already points to another commit.`);
		}
		releasePrepareCandidate = true;
	} else if (sourceRef === expectedTagRef) {
		if (expectedTagStatus !== "same") {
			throw new Error(
				`Tag ${parsed.tag} does not resolve to the tested source SHA.`,
			);
		}
		releasePrepareCandidate = true;
	}
	return {
		source_ref: sourceRef,
		source_sha: sourceSha,
		version: parsed.version,
		expected_tag: parsed.tag,
		expected_tag_status: expectedTagStatus,
		release_prepare_candidate: releasePrepareCandidate,
	};
}

export function releasePlan(
	sourceRef: string,
	sourceSha: string,
	testsRunId: string,
) {
	const plan = resolveReleasePlan(loadMetadata(), {
		sourceRef,
		sourceSha,
		testsRunId,
	});
	return {
		source_ref: plan.sourceRef,
		source_sha: plan.sourceSha,
		tests_run_id: plan.testsRunId,
		version: plan.version,
		channel: plan.channel,
		expected_tag: plan.tag,
		prerelease: plan.isPrerelease,
		macos_signing: plan.macosSigning,
		windows_signing: plan.windowsSigning,
		requires_stable_approval: plan.requiresStableApproval,
		may_create_tag: plan.mayCreateTag,
	};
}

export async function validateReleaseRef(input: {
	sourceRef: string;
	sourceSha: string;
	testsRunId: string;
}): Promise<void> {
	const metadata = loadMetadata();
	resolveReleasePlan(metadata, input);
	const head = git(["rev-parse", "HEAD"]);
	if (head !== input.sourceSha) {
		throw new Error(
			`Checked-out HEAD ${head} does not match source SHA ${input.sourceSha}.`,
		);
	}
	if (input.sourceRef.startsWith("refs/tags/")) {
		const tagTarget = remoteTagTarget(
			input.sourceRef.slice("refs/tags/".length),
		);
		if (tagTarget !== input.sourceSha) {
			throw new Error("Release tag does not point to source SHA.");
		}
	} else {
		const remote = git(["ls-remote", "origin", input.sourceRef]);
		if (!remote || remote.split(/\s+/)[0] !== input.sourceSha) {
			throw new Error("Release branch no longer points to source SHA.");
		}
	}
	const token = process.env.GITHUB_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;
	const api = process.env.GITHUB_API_URL ?? "https://api.github.com";
	if (!token || !repository) {
		throw new Error(
			"GITHUB_TOKEN and GITHUB_REPOSITORY are required to validate the Tests run.",
		);
	}
	let run:
		| { conclusion?: string; head_sha?: string; name?: string; status?: string }
		| undefined;
	for (let attempt = 0; attempt < 25; attempt += 1) {
		const response = await fetch(
			`${api}/repos/${repository}/actions/runs/${input.testsRunId}`,
			{
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${token}`,
					"X-GitHub-Api-Version": "2022-11-28",
				},
			},
		);
		if (!response.ok) {
			throw new Error(
				`Unable to read Tests run ${input.testsRunId}: HTTP ${response.status}.`,
			);
		}
		run = (await response.json()) as typeof run;
		if (run?.status === "completed") {
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 5_000));
	}
	if (
		run?.name !== "Tests" ||
		run.conclusion !== "success" ||
		run.head_sha !== input.sourceSha
	) {
		throw new Error(
			"The supplied Tests run is not a successful Tests workflow for source SHA.",
		);
	}
}

export function ensureReleaseTag(
	sourceSha: string,
	push: boolean,
): "created" | "existing" {
	const metadata = loadMetadata();
	const parsed = parseReleaseVersion(
		metadata.project.version,
		metadata.release.tagPrefix,
	);
	const target = remoteTagTarget(parsed.tag);
	if (target && target !== sourceSha) {
		throw new Error(`Tag ${parsed.tag} points to ${target}, not ${sourceSha}.`);
	}
	if (target) {
		return "existing";
	}
	git([
		"tag",
		"--annotate",
		parsed.tag,
		sourceSha,
		"--message",
		`${metadata.project.displayName} ${parsed.version}`,
	]);
	if (push) {
		git(["push", "origin", `refs/tags/${parsed.tag}`]);
	}
	return "created";
}
