import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { REPO_ROOT } from "./metadata.mts";

type WebEvent = {
	workflow_run?: {
		name?: string;
		path?: string;
		status?: string;
		conclusion?: string;
		event?: string;
		head_branch?: string;
		head_sha?: string;
		head_repository?: { full_name?: string };
	};
};

type WebSourceInput = {
	eventName: string;
	workflowRef: string;
	workflowSha: string;
	repository: string;
};

export function resolveWebSource(
	input: WebSourceInput & {
		event: WebEvent;
		checkedOutSha: string;
		mainSha: string;
	},
): { source_sha: string; should_deploy: boolean } {
	if (input.workflowRef !== "refs/heads/main") {
		throw new Error(
			"Web deployment is restricted to main, including manual runs.",
		);
	}
	let sourceSha: string | undefined;
	if (input.eventName === "workflow_dispatch") {
		sourceSha = input.workflowSha;
	} else if (input.eventName === "workflow_run") {
		const run = input.event.workflow_run;
		if (
			run?.name !== "Tests" ||
			run.path !== ".github/workflows/tests.yml" ||
			run.status !== "completed" ||
			run.conclusion !== "success" ||
			run.head_branch !== "main" ||
			run.head_repository?.full_name !== input.repository ||
			(run.event !== "push" && run.event !== "workflow_dispatch")
		) {
			throw new Error(
				"Automatic Web deployment requires successful main Tests from this repository.",
			);
		}
		sourceSha = run.head_sha;
	} else {
		throw new Error("Unsupported Web deployment trigger.");
	}
	if (
		!sourceSha ||
		!/^[0-9a-f]{40}$/.test(sourceSha) ||
		input.checkedOutSha !== sourceSha
	) {
		throw new Error("Web checkout must match the exact deployment source SHA.");
	}
	if (!/^[0-9a-f]{40}$/.test(input.mainSha)) {
		throw new Error("Unable to resolve the current main commit.");
	}
	// A delayed or rerun workflow must not roll production back to an older main.
	return { source_sha: sourceSha, should_deploy: sourceSha === input.mainSha };
}

export function webSource(input: WebSourceInput & { eventFile: string }) {
	const git = (args: string[]) =>
		execFileSync("git", args, {
			cwd: REPO_ROOT,
			encoding: "utf8",
		}).trim();
	return resolveWebSource({
		...input,
		event: JSON.parse(readFileSync(input.eventFile, "utf8")) as WebEvent,
		checkedOutSha: git(["rev-parse", "HEAD"]),
		mainSha: git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0],
	});
}
