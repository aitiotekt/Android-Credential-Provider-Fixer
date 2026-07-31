import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";
import { checkPublicationWorkflow } from "../lib/release/checks.mts";
import { loadMetadata, REPO_ROOT } from "../lib/release/metadata.mts";
import { ensureReleaseTag } from "../lib/release/workflow.mts";

const source = readFileSync(
	join(REPO_ROOT, ".github/workflows/release.yml"),
	"utf8",
);
const workflow = parse(source);

test("alpha, beta and stable job branches keep approval and cancellation boundaries", () => {
	for (const channel of ["alpha", "beta", "stable"]) {
		for (const signing of ["signed", "unsigned"]) {
			if (channel === "stable" && signing === "unsigned") {
				continue;
			}
			for (const approval of ["success", "skipped", "failure"]) {
				const needs = {
					"release-plan": {
						result: "success",
						outputs: {
							macos_signing: signing,
							requires_stable_approval: String(channel === "stable"),
						},
					},
					"stable-approval": { result: approval },
				};
				for (const cancelled of [false, true]) {
					const evaluate = (job: string) =>
						runInNewContext(
							workflow.jobs[job].if.replace(/needs\.([\w-]+)/g, 'needs["$1"]'),
							{ needs, cancelled: () => cancelled },
						);
					const permitted =
						!cancelled && (channel !== "stable" || approval === "success");
					assert.equal(evaluate("windows"), permitted);
					assert.equal(
						evaluate("macos-signed"),
						permitted && signing === "signed",
					);
					assert.equal(
						evaluate("macos-unsigned"),
						!cancelled && signing === "unsigned",
					);
				}
			}
		}
	}
});

test("publication guard survives skipped branches and blocks failure or cancellation", () => {
	checkPublicationWorkflow(source);
	for (const assemble of ["success", "failure", "skipped", "cancelled"]) {
		for (const cancelled of [false, true]) {
			const expression = workflow.jobs.publish.if.replaceAll(
				"needs.release-plan.result",
				'needs["release-plan"].result',
			);
			const result = runInNewContext(expression, {
				cancelled: () => cancelled,
				needs: {
					"release-plan": { result: "success" },
					assemble: { result: assemble },
					"stable-approval": { result: "skipped" },
					"macos-unsigned": { result: "skipped" },
				},
			});
			assert.equal(result, !cancelled && assemble === "success");
		}
	}
	assert.throws(
		() =>
			checkPublicationWorkflow(
				source.replace(
					/ {2}publish:\n {4}if:[\s\S]*?(?= {4}needs:)/,
					"  publish:\n",
				),
			),
		/explicitly require/,
	);
	assert.throws(
		() =>
			checkPublicationWorkflow(
				source.replace("release-@(macos-*|windows-*|linux-*)", "release-*"),
			),
		/exclude/,
	);
	assert.throws(
		() =>
			checkPublicationWorkflow(
				source.replace("GIT_COMMITTER_NAME:", "UNUSED_NAME:"),
			),
		/committer/,
	);
});

test("tag creation works without global Git identity and refuses conflicting commits", () => {
	const directory = mkdtempSync(join(tmpdir(), "acp tag "));
	const saved = { ...process.env };
	try {
		const tagStep = workflow.jobs.publish.steps.find(
			(step: { name: string }) => step.name === "Create or verify release tag",
		);
		Object.assign(process.env, tagStep.env, {
			GIT_CONFIG_GLOBAL: join(directory, "no-global-config"),
			GIT_CONFIG_NOSYSTEM: "1",
		});
		const repository = join(directory, "repo");
		const origin = join(directory, "origin.git");
		const git = (...args: string[]) =>
			execFileSync("git", args, {
				cwd: directory,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}).trim();
		git("init", "--bare", origin);
		git("init", repository);
		git("-C", repository, "remote", "add", "origin", origin);
		const commit = () =>
			git(
				"-C",
				repository,
				"-c",
				"user.name=Test",
				"-c",
				"user.email=test@example.invalid",
				"commit",
				"--allow-empty",
				"-m",
				"fixture",
			);
		commit();
		const sha = git("-C", repository, "rev-parse", "HEAD");
		assert.equal(ensureReleaseTag(sha, true, repository), "created");
		assert.equal(ensureReleaseTag(sha, true, repository), "existing");
		const metadata = loadMetadata();
		assert.equal(
			git(
				"-C",
				repository,
				"cat-file",
				"-t",
				`${metadata.release.tagPrefix}${metadata.project.version}`,
			),
			"tag",
		);
		commit();
		assert.throws(() => ensureReleaseTag(sha, true, repository), /checked-out/);
		assert.throws(
			() =>
				ensureReleaseTag(
					git("-C", repository, "rev-parse", "HEAD"),
					true,
					repository,
				),
			/not/,
		);
	} finally {
		for (const key of Object.keys(process.env)) {
			if (!(key in saved)) {
				delete process.env[key];
			}
		}
		Object.assign(process.env, saved);
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publication script verifies uploads before exposing new or repaired releases", () => {
	const script = workflow.jobs.publish.steps.find(
		(step: { name: string }) =>
			step.name === "Publish idempotent GitHub Release",
	).run;
	for (const scenario of [
		"new",
		"draft",
		"published",
		"upload-failed",
		"verify-failed",
		"publish-failed",
	]) {
		const directory = mkdtempSync(join(tmpdir(), "acp publish "));
		try {
			const result = spawnSync(
				"bash",
				[
					"-e",
					"-c",
					`
published=0
gh() {
  echo "gh $*" >&2
  case "$1 $2" in
    'release view')
      if [ "$published" = 1 ]; then echo false; return; fi
      if [ "$SCENARIO" = published ]; then echo false; return; fi
      if [ "$SCENARIO" = draft ]; then
        case "$*" in *'--json assets'*) echo false ;; *) echo true ;; esac
        return
      fi
      return 1 ;;
    'release upload') [ "$SCENARIO" != upload-failed ] ;;
    'release edit')
      if [ "$SCENARIO" = publish-failed ]; then return 1; fi
      published=1 ;;
  esac
}
mise() {
  echo "mise $*" >&2
  [ "$SCENARIO" != verify-failed ]
}
${script}
`,
				],
				{
					cwd: directory,
					encoding: "utf8",
					env: {
						...process.env,
						SCENARIO: scenario,
						TAG: "v0.1.0-beta.1",
						VERSION: "0.1.0-beta.1",
						PRERELEASE: "true",
						GITHUB_REPOSITORY: "test/project",
					},
				},
			);
			assert.equal(
				result.status === 0,
				["new", "draft", "published"].includes(scenario),
				result.stderr,
			);
			if (["upload-failed", "verify-failed", "published"].includes(scenario)) {
				assert.ok(!result.stderr.includes("gh release edit"));
			}
			if (["new", "draft"].includes(scenario)) {
				assert.ok(
					result.stderr.indexOf("--published-directory=temp/release/uploaded") <
						result.stderr.indexOf("gh release edit"),
				);
				assert.ok(result.stderr.includes("--latest=false"));
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
});
