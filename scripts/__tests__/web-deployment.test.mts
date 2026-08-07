import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWebSource } from "../lib/release/web.mts";

const testedSha = "a".repeat(40);
const otherSha = "b".repeat(40);
const automatic = {
	eventName: "workflow_run",
	workflowRef: "refs/heads/main",
	workflowSha: otherSha,
	repository: "aitiotekt/Android-Credential-Provider-Fixer",
	checkedOutSha: testedSha,
	mainSha: testedSha,
	event: {
		workflow_run: {
			name: "Tests",
			path: ".github/workflows/tests.yml",
			status: "completed",
			conclusion: "success",
			event: "push",
			head_branch: "main",
			head_sha: testedSha,
			head_repository: {
				full_name: "aitiotekt/Android-Credential-Provider-Fixer",
			},
		},
	},
};

test("automatic Web deployment uses the exact successful Tests SHA, not the default-branch event SHA", () => {
	assert.deepEqual(resolveWebSource(automatic), {
		source_sha: testedSha,
		should_deploy: true,
	});
	assert.throws(
		() => resolveWebSource({ ...automatic, checkedOutSha: otherSha }),
		/exact deployment source/,
	);
});

test("failed, cancelled, unfinished, unrelated, PR, fork, and non-main Tests cannot deploy", () => {
	for (const patch of [
		{ conclusion: "failure" },
		{ conclusion: "cancelled" },
		{ conclusion: "skipped" },
		{ status: "in_progress" },
		{ name: "Other" },
		{ path: ".github/workflows/other.yml" },
		{ head_branch: "release" },
		{ head_branch: "dev" },
		{ event: "pull_request" },
		{ head_repository: { full_name: "someone/fork" } },
	]) {
		assert.throws(
			() =>
				resolveWebSource({
					...automatic,
					event: {
						workflow_run: { ...automatic.event.workflow_run, ...patch },
					},
				}),
			/requires successful main Tests/,
		);
	}
	assert.throws(
		() => resolveWebSource({ ...automatic, event: {} }),
		/requires successful main Tests/,
	);
	assert.throws(
		() => resolveWebSource({ ...automatic, eventName: "push" }),
		/Unsupported/,
	);
});

test("manual Web runs can rebuild main without an upstream Tests event but cannot select another branch or SHA", () => {
	const manual = {
		...automatic,
		eventName: "workflow_dispatch",
		workflowSha: testedSha,
		event: {},
	};
	assert.deepEqual(resolveWebSource(manual), {
		source_sha: testedSha,
		should_deploy: true,
	});
	for (const workflowRef of [
		"refs/heads/release",
		"refs/heads/dev",
		"refs/tags/v1.0.0",
	]) {
		assert.throws(
			() => resolveWebSource({ ...manual, workflowRef }),
			/restricted to main/,
		);
	}
	assert.throws(
		() => resolveWebSource({ ...manual, workflowSha: otherSha }),
		/exact deployment source/,
	);
	assert.throws(
		() => resolveWebSource({ ...manual, workflowSha: "main" }),
		/exact deployment source/,
	);
});

test("late runs and reruns skip an obsolete source instead of rolling production back", () => {
	assert.deepEqual(resolveWebSource({ ...automatic, mainSha: otherSha }), {
		source_sha: testedSha,
		should_deploy: false,
	});
	assert.deepEqual(
		resolveWebSource({
			...automatic,
			eventName: "workflow_dispatch",
			workflowSha: testedSha,
			mainSha: otherSha,
			event: {},
		}),
		{ source_sha: testedSha, should_deploy: false },
	);
	assert.throws(
		() => resolveWebSource({ ...automatic, mainSha: "" }),
		/current main/,
	);
});
