import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "./metadata.mts";

const WORKFLOWS = [
	".github/workflows/tests.yml",
	".github/workflows/release.yml",
	".github/workflows/docs.yml",
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
	const cname = readFileSync(
		resolve(REPO_ROOT, "docsite/public/CNAME"),
		"utf8",
	).trim();
	if (cname !== "acp-fixer.aitiotekt.com") {
		throw new Error("Unexpected documentation CNAME.");
	}
	return sources.length;
}
