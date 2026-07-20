import assert from "node:assert/strict";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	createManifest,
	verifyArtifacts,
	verifyPublishedRelease,
	writePlatformReport,
} from "../lib/release/artifacts.mts";
import {
	artifactFileName,
	loadMetadata,
	REPO_ROOT,
} from "../lib/release/metadata.mts";
import { extractChangelogSection } from "../lib/release/notes.mts";
import {
	parseReleaseVersion,
	resolveReleasePlan,
} from "../lib/release/policy.mts";

test("release versions accept stable, alpha, and beta only", () => {
	assert.equal(parseReleaseVersion("1.2.3").channel, "stable");
	assert.equal(parseReleaseVersion("1.2.3-alpha.0").channel, "alpha");
	assert.equal(parseReleaseVersion("1.2.3-beta.12").tag, "v1.2.3-beta.12");
	for (const invalid of [
		"1.2.3-rc.1",
		"1.2.3-alpha",
		"1.2.3+build",
		"v1.2.3",
	]) {
		assert.throws(() => parseReleaseVersion(invalid));
	}
});

test("stable plans require an exact tag and signed platform artifacts", () => {
	const metadata = loadMetadata();
	metadata.project.version = "1.2.3";
	metadata.release.prereleaseSigning = {
		macos: "unsigned",
		windows: "unsigned",
	};
	assert.throws(() =>
		resolveReleasePlan(metadata, {
			sourceRef: "refs/heads/release",
			sourceSha: "a".repeat(40),
			testsRunId: "42",
		}),
	);
	const plan = resolveReleasePlan(metadata, {
		sourceRef: "refs/tags/v1.2.3",
		sourceSha: "a".repeat(40),
		testsRunId: "42",
	});
	assert.equal(plan.macosSigning, "signed");
	assert.equal(plan.windowsSigning, "signed");
	assert.equal(plan.requiresStableApproval, true);
});

test("prerelease plans preserve the per-platform signing policy", () => {
	const metadata = loadMetadata();
	metadata.release.prereleaseSigning = { macos: "signed", windows: "unsigned" };
	const plan = resolveReleasePlan(metadata, {
		sourceRef: "refs/heads/release",
		sourceSha: "b".repeat(40),
		testsRunId: "7",
	});
	assert.equal(plan.macosSigning, "signed");
	assert.equal(plan.windowsSigning, "unsigned");
	assert.equal(plan.mayCreateTag, true);
});

test("metadata enforces the complete artifact matrix and stable names", () => {
	const directory = mkdtempSync(join(tmpdir(), "acp-fixer-metadata-test-"));
	try {
		const source = readFileSync("acp-fixer-metadata.toml", "utf8");
		const path = join(directory, "metadata.toml");
		writeFileSync(path, source);
		const metadata = loadMetadata(path);
		assert.equal(
			artifactFileName(metadata, metadata.release.artifacts[0]),
			`android-credential-provider-fixer-v${metadata.project.version}-aarch64-apple-darwin.dmg`,
		);
		writeFileSync(
			path,
			`${source}\n${source.match(/\[\[release\.artifact\]\][\s\S]*?(?=\n\[\[release\.artifact\]\])/u)?.[0]}\n`,
		);
		assert.throws(() => loadMetadata(path), /Duplicate release artifact/);
		writeFileSync(
			path,
			source.replace(
				'target = "aarch64-unknown-linux-gnu"',
				'target = "armv7-unknown-linux-gnueabihf"',
			),
		);
		assert.throws(() => loadMetadata(path), /Unsupported release artifact/);
		writeFileSync(
			path,
			source.slice(0, source.lastIndexOf("\n[[release.artifact]]")),
		);
		assert.throws(() => loadMetadata(path), /complete artifact matrix/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("release notes extract exactly one changelog section", () => {
	const source =
		"# Changelog\n\n## 1.2.3\n\n- Current\n\n## 1.2.2\n\n- Previous\n";
	assert.equal(extractChangelogSection(source, "1.2.3"), "- Current");
	assert.throws(() => extractChangelogSection(source, "1.2.4"));
});

test("manifest creation requires and verifies the complete artifact set", () => {
	const relativeRoot = `temp/release-tests/${Date.now()}-${process.pid}`;
	const input = join(REPO_ROOT, relativeRoot, "input");
	const output = join(REPO_ROOT, relativeRoot, "output");
	mkdirSync(input, { recursive: true });
	try {
		const metadata = loadMetadata();
		for (const artifact of metadata.release.artifacts) {
			const fileName = artifactFileName(metadata, artifact);
			writeFileSync(
				join(input, fileName),
				`${artifact.kind}:${artifact.target}`,
			);
			writePlatformReport(
				`${relativeRoot}/input/${artifact.kind}-${artifact.target}.report.json`,
				{
					fileName,
					kind: artifact.kind,
					target: artifact.target,
					signed: false,
					notarized: false,
				},
			);
		}
		for (const notice of [
			"THIRD_PARTY_NOTICES-CLI.html",
			"THIRD_PARTY_NOTICES-GUI.html",
		]) {
			writeFileSync(join(input, notice), notice);
		}
		assert.throws(
			() =>
				createManifest({
					inputDirectory: `${relativeRoot}/input`,
					outputDirectory: `${relativeRoot}/signing-mismatch`,
					sourceRef: "refs/heads/release",
					sourceSha: "a".repeat(40),
					runUrl: "https://example.invalid/run/1",
					macosSigning: "signed",
					windowsSigning: "unsigned",
				}),
			/platform report does not match release policy/i,
		);
		const result = createManifest({
			inputDirectory: `${relativeRoot}/input`,
			outputDirectory: `${relativeRoot}/output`,
			sourceRef: "refs/heads/release",
			sourceSha: "a".repeat(40),
			runUrl: "https://example.invalid/run/1",
			macosSigning: "unsigned",
			windowsSigning: "unsigned",
		});
		assert.equal(result.artifactCount, 8);
		assert.equal(
			verifyArtifacts(`${relativeRoot}/output/release-manifest.json`),
			8,
		);
		const published = join(REPO_ROOT, relativeRoot, "published");
		mkdirSync(published);
		for (const name of readdirSync(output)) {
			copyFileSync(join(output, name), join(published, name));
		}
		assert.equal(
			verifyPublishedRelease(
				`${relativeRoot}/output`,
				`${relativeRoot}/published`,
			),
			12,
		);
		writeFileSync(join(published, "unexpected.txt"), "unexpected");
		assert.throws(
			() =>
				verifyPublishedRelease(
					`${relativeRoot}/output`,
					`${relativeRoot}/published`,
				),
			/asset names/,
		);
		rmSync(join(published, "unexpected.txt"));
		const publishedArtifact = artifactFileName(
			metadata,
			metadata.release.artifacts[0],
		);
		writeFileSync(join(published, publishedArtifact), "changed");
		assert.throws(
			() =>
				verifyPublishedRelease(
					`${relativeRoot}/output`,
					`${relativeRoot}/published`,
				),
			/asset differs/,
		);
		const manifestPath = join(output, "release-manifest.json");
		const manifestSource = readFileSync(manifestPath, "utf8");
		const manifest = JSON.parse(manifestSource) as {
			artifacts: Array<Record<string, unknown>>;
		};
		manifest.artifacts[1] = { ...manifest.artifacts[0] };
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		assert.throws(
			() => verifyArtifacts(`${relativeRoot}/output/release-manifest.json`),
			/invalid artifact/,
		);
		writeFileSync(manifestPath, manifestSource);
		const first = artifactFileName(metadata, metadata.release.artifacts[0]);
		rmSync(join(output, first));
		assert.throws(
			() => verifyArtifacts(`${relativeRoot}/output/release-manifest.json`),
			/verification failed/,
		);
		writeFileSync(
			join(output, first),
			`${metadata.release.artifacts[0].kind}:${metadata.release.artifacts[0].target}`,
		);
		writeFileSync(join(output, first), "changed");
		assert.throws(
			() => verifyArtifacts(`${relativeRoot}/output/release-manifest.json`),
			/verification failed/,
		);
	} finally {
		rmSync(join(REPO_ROOT, relativeRoot), { recursive: true, force: true });
	}
});
