import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { androidTrack } from "../android-release.mts";
import { assembleWeb } from "../build-web.mts";
import {
	androidProperties,
	checkAndroidVersion,
	parseAndroidMetadata,
	updateAndroidVersion,
	versionTarget,
} from "../lib/release/android.mts";

const metadata = `[android]
version = "0.1.0-alpha.1"
version_code = 1
display_name = "WebAuthn Diagnosis"
display_name_zh = "WebAuthn 诊断"
identifier = "com.aitiotekt.webauthndiagnosis"
test_url = "https://acp-fixer.aitiotekt.com/webauthn/"
publish = "build-only"
`;

test("version targets preserve default/desktop compatibility and independent Android", () => {
	for (const input of [undefined, "default", "desktop"]) {
		assert.equal(versionTarget(input), "desktop");
	}
	assert.equal(versionTarget("android"), "android");
	for (const input of [true, "web", "all", ""]) {
		assert.throws(() => versionTarget(input));
	}
	const android = parseAndroidMetadata(metadata);
	assert.equal(android.publish, "build-only");
	assert.equal(android.identifier, "com.aitiotekt.webauthndiagnosis");
	assert.match(androidProperties(android), /versionCode=1/);
	assert.doesNotThrow(checkAndroidVersion);
});

test("Android metadata rejects invalid publishing targets and version codes", () => {
	for (const replacement of ["0", "-1", "2100000001", "1.5"]) {
		assert.throws(() =>
			parseAndroidMetadata(
				metadata.replace("version_code = 1", `version_code = ${replacement}`),
			),
		);
	}
	assert.throws(() =>
		parseAndroidMetadata(
			metadata.replace('publish = "build-only"', 'publish = "production"'),
		),
	);
	assert.throws(() =>
		parseAndroidMetadata(
			metadata.replace("com.aitiotekt.webauthndiagnosis", "com.example.other"),
		),
	);
	assert.deepEqual(androidTrack("0.1.0-alpha.1", 7), {
		track: "internal",
		releases: [
			{ name: "0.1.0-alpha.1", versionCodes: ["7"], status: "completed" },
		],
	});
});

test("Android version changes are isolated, monotonic and idempotent", () => {
	const source = `[project]\nversion = "0.1.0-beta.1"\n${metadata}`;
	const updated = updateAndroidVersion(source, "0.1.0-alpha.2");
	assert.match(updated, /\[project\]\nversion = "0.1.0-beta.1"/);
	assert.equal(parseAndroidMetadata(updated).versionCode, 2);
	assert.equal(updateAndroidVersion(updated, "0.1.0-alpha.2"), updated);
	assert.equal(
		parseAndroidMetadata(updateAndroidVersion(updated, "0.1.0-alpha.2", 3))
			.versionCode,
		3,
	);
	assert.throws(() => updateAndroidVersion(updated, "0.1.0-alpha.3", 2));
	assert.throws(() => updateAndroidVersion(updated, "0.1.0-alpha.2", 1));
	assert.throws(() => updateAndroidVersion(updated, "not-a-version"));
});

test("Pages assembly keeps both sites and rejects missing builds or namespace collisions", () => {
	const directory = mkdtempSync(join(tmpdir(), "acp-web-test-"));
	try {
		const docs = join(directory, "docs");
		const web = join(directory, "web");
		mkdirSync(docs);
		mkdirSync(web);
		assert.throws(() => assembleWeb(docs, web, join(directory, "out")));
		writeFileSync(join(docs, "index.html"), "documentation");
		writeFileSync(join(docs, "CNAME"), "acp-fixer.aitiotekt.com");
		writeFileSync(join(web, "index.html"), "diagnosis");
		const result = assembleWeb(docs, web, join(directory, "out"));
		assert.equal(
			readFileSync(join(result, "index.html"), "utf8"),
			"documentation",
		);
		assert.equal(
			readFileSync(join(result, "webauthn/index.html"), "utf8"),
			"diagnosis",
		);
		assert.equal(
			readFileSync(join(result, "CNAME"), "utf8"),
			"acp-fixer.aitiotekt.com",
		);
		mkdirSync(join(docs, "webauthn"));
		assert.throws(() => assembleWeb(docs, web, join(directory, "out")));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("Web deploys only main; Android preserves AAB before an opt-in store upload", () => {
	const web = parse(
		readFileSync(
			new URL("../../.github/workflows/web.yml", import.meta.url),
			"utf8",
		),
	);
	assert.equal(
		web.jobs.deploy.if,
		"github.event_name != 'pull_request' && github.ref == 'refs/heads/main'",
	);
	assert.deepEqual(web.on.push.branches, ["main", "release"]);
	const android = parse(
		readFileSync(
			new URL("../../.github/workflows/android.yml", import.meta.url),
			"utf8",
		),
	);
	assert.deepEqual(Object.keys(android.on), ["workflow_dispatch"]);
	assert.equal(android.jobs.build.environment, "android-release");
	const steps = android.jobs.build.steps;
	const artifact = steps.findIndex(
		(step: { name: string }) =>
			step.name === "Preserve AAB before any Play request",
	);
	const upload = steps.findIndex(
		(step: { name: string }) => step.name === "Upload to Play internal testing",
	);
	assert.ok(artifact >= 0 && artifact < upload);
	assert.equal(steps[upload].if, "steps.plan.outputs.publish == 'internal'");
	assert.equal(steps[upload]["continue-on-error"], undefined);
});
