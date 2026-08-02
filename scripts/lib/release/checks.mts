import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "./metadata.mts";

type ReleaseJob = {
	if?: string;
	needs?: string[];
	steps?: Array<{
		name?: string;
		run?: string;
		env?: Record<string, string>;
		with?: Record<string, unknown>;
	}>;
};

export function checkPublicationWorkflow(source: string): void {
	const { jobs } = parse(source) as { jobs: Record<string, ReleaseJob> };
	const condition = jobs.publish?.if?.replace(/\s+/g, " ").trim();
	if (
		condition !==
		"!cancelled() && needs.release-plan.result == 'success' && needs.assemble.result == 'success'"
	) {
		throw new Error(
			"Publication must explicitly require successful dependencies without inheriting skipped ancestors.",
		);
	}
	const steps = jobs.publish.steps ?? [];
	const tag = steps.find(
		(step) => step.name === "Create or verify release tag",
	);
	if (!tag?.env?.GIT_COMMITTER_NAME || !tag.env.GIT_COMMITTER_EMAIL) {
		throw new Error(
			"Annotated release tags require an explicit committer identity.",
		);
	}
	const download = jobs.assemble?.steps?.find(
		(step) => step.name === "Download release inputs",
	);
	if (download?.with?.pattern !== "release-@(macos-*|windows-*|linux-*)") {
		throw new Error(
			"Assembly must exclude previously assembled final artifacts.",
		);
	}
	if (
		jobs["release-report"]?.if !== "always()" ||
		!jobs["release-report"].needs?.includes("publish")
	) {
		throw new Error(
			"Release completion must be checked even when publication is skipped.",
		);
	}
	const publish =
		steps.find((step) => step.name === "Publish idempotent GitHub Release")
			?.run ?? "";
	const verification = publish.indexOf(
		"--published-directory=temp/release/uploaded",
	);
	if (verification < 0 || verification > publish.indexOf("--draft=false")) {
		throw new Error(
			"Uploaded draft assets must be verified before publication.",
		);
	}
}

const WORKFLOWS = [
	".github/workflows/tests.yml",
	".github/workflows/release.yml",
	".github/workflows/web.yml",
	".github/workflows/android.yml",
] as const;
const COMPOSITE_ACTIONS = [
	".github/actions/setup-workspace/action.yml",
	".github/actions/setup-rust-cache/action.yml",
] as const;

export function checkReleaseAutomation(): number {
	const sources = [...WORKFLOWS, ...COMPOSITE_ACTIONS].map(
		(path) => [path, readFileSync(resolve(REPO_ROOT, path), "utf8")] as const,
	);
	for (const [path, source] of sources) {
		parse(source);
		for (const match of source.matchAll(
			/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm,
		)) {
			const use = match[1];
			if (!use.startsWith("./") && !/@[0-9a-f]{40}$/i.test(use)) {
				throw new Error(
					`External action is not pinned to a full commit SHA in ${path}: ${use}.`,
				);
			}
		}
		if (
			/\b(?:adb\s+(?:devices|shell|version)|settings\s+(?:put|delete))\b/i.test(
				source,
			)
		) {
			throw new Error(
				`Workflow must not invoke ADB or Android settings: ${path}.`,
			);
		}
	}
	const release =
		sources.find(([path]) => path.endsWith("release.yml"))?.[1] ?? "";
	checkPublicationWorkflow(release);
	for (const required of [
		"workflow_dispatch:",
		"environment: stable-release",
		"environment: release-signing",
		"ubuntu-24.04-arm",
		"macos-15-intel",
		"windows-2025",
		"actions/attest-build-provenance@",
	]) {
		if (!release.includes(required)) {
			throw new Error(`Release workflow is missing ${required}.`);
		}
	}
	if (/^\s+(?:push|pull_request|release):\s*$/m.test(release)) {
		throw new Error("Release workflow must only expose workflow_dispatch.");
	}
	const workflow = parse(release) as {
		jobs: Record<
			string,
			{
				environment?: unknown;
				if?: string;
				permissions?: Record<string, string>;
				steps?: Array<{
					uses?: string;
					if?: string;
					"continue-on-error"?: boolean;
					with?: Record<string, string>;
				}>;
			}
		>;
	};
	const windows = workflow.jobs.windows;
	const assemble = workflow.jobs.assemble;
	const attestation = assemble?.steps?.find((step) =>
		step.uses?.startsWith("actions/attest-build-provenance@"),
	);
	if (
		!windows ||
		windows.environment ||
		!windows.if?.includes("needs.stable-approval.result == 'success'") ||
		/WINDOWS_PFX|WINDOWS_TIMESTAMP|signtool|windows_signing/.test(release)
	) {
		throw new Error(
			"Windows releases must use the approval-gated build without Authenticode credentials.",
		);
	}
	if (
		!attestation ||
		attestation.if ||
		attestation["continue-on-error"] ||
		assemble.permissions?.["id-token"] !== "write" ||
		assemble.permissions?.attestations !== "write"
	) {
		throw new Error(
			"Every release channel requires unconditional GitHub provenance attestation.",
		);
	}
	for (const subject of [
		"*.exe",
		"*.zip",
		"SHA256SUMS",
		"release-manifest.json",
	]) {
		if (!attestation.with?.["subject-path"]?.includes(subject)) {
			throw new Error(`Release attestation is missing ${subject}.`);
		}
	}
	const cname = readFileSync(
		resolve(REPO_ROOT, "docsite/public/CNAME"),
		"utf8",
	).trim();
	if (cname !== "acp-fixer.aitiotekt.com") {
		throw new Error("Unexpected documentation CNAME.");
	}
	return sources.length;
}
