import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	checkAndroidVersion,
	loadAndroidMetadata,
} from "./lib/release/android.mts";
import { emitResult } from "./lib/release/io.mts";
import { METADATA_PATH, REPO_ROOT } from "./lib/release/metadata.mts";

const directory = resolve(REPO_ROOT, "temp/release/android");

export function androidTrack(version: string, versionCode: number) {
	return {
		track: "internal",
		releases: [
			{
				name: version,
				versionCodes: [String(versionCode)],
				status: "completed",
			},
		],
	};
}

async function main() {
	const [action, policy] = process.argv.slice(2);
	const metadata = loadAndroidMetadata();
	if (action === "policy") {
		if (policy !== "build-only" && policy !== "internal") {
			throw new Error("Policy must be build-only or internal");
		}
		const source = readFileSync(METADATA_PATH, "utf8");
		writeFileSync(
			METADATA_PATH,
			source.replace(
				/(\[android\][\s\S]*?\npublish = ")[^"]+("\n)/,
				`$1${policy}$2`,
			),
		);
		return;
	}
	checkAndroidVersion();
	if (action === "plan") {
		emitResult(
			{ ...metadata },
			process.env.GITHUB_OUTPUT ? "github-output" : "json",
			"Android release plan",
		);
		return;
	}
	if (action === "stage") {
		const input = resolve(
			REPO_ROOT,
			"apps/android-app/app/build/outputs/bundle/release/webauthn-diagnosis-release.aab",
		);
		const verification = execFileSync(
			"jarsigner",
			["-J-Duser.language=en", "-verify", input],
			{ encoding: "utf8" },
		);
		if (!verification.includes("jar verified.")) {
			throw new Error("AAB must have a verified JAR signature");
		}
		const bytes = readFileSync(input);
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		mkdirSync(directory, { recursive: true });
		copyFileSync(input, resolve(directory, "webauthn-diagnosis.aab"));
		writeFileSync(
			resolve(directory, "build.json"),
			`${JSON.stringify({ schemaVersion: 1, ...metadata, sha256, sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() }, null, 2)}\n`,
		);
		writeFileSync(
			resolve(directory, "SHA256SUMS"),
			`${sha256}  webauthn-diagnosis.aab\n`,
		);
		return;
	}
	if (action !== "upload") {
		throw new Error("Use android-release.mts plan|policy POLICY|stage|upload");
	}
	if (metadata.publish !== "internal") {
		throw new Error("Play upload is disabled by repository metadata");
	}
	const bytes = readFileSync(resolve(directory, "webauthn-diagnosis.aab"));
	const report = JSON.parse(
		readFileSync(resolve(directory, "build.json"), "utf8"),
	);
	if (
		report.sha256 !== createHash("sha256").update(bytes).digest("hex") ||
		report.versionCode !== metadata.versionCode ||
		report.version !== metadata.version ||
		report.identifier !== metadata.identifier
	) {
		throw new Error("Staged AAB metadata/hash mismatch");
	}
	const { GoogleAuth } = await import("google-auth-library");
	if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
		throw new Error("Missing Play service-account credential");
	}
	const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${metadata.identifier}/edits`;
	// Never log Gaxios errors: they can contain authenticated request headers.
	try {
		const auth = new GoogleAuth({
			credentials: JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON),
			scopes: ["https://www.googleapis.com/auth/androidpublisher"],
		});
		const client = await auth.getClient();
		const edit = await client.request<{ id: string }>({
			url: base,
			method: "POST",
			data: {},
			retry: false,
		});
		const id = encodeURIComponent(edit.data.id);
		const uploaded = await client.request<{
			versionCode: number;
			sha256: string;
		}>({
			url: `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${metadata.identifier}/edits/${id}/bundles?uploadType=media`,
			method: "POST",
			data: bytes,
			headers: { "Content-Type": "application/octet-stream" },
			timeout: 120_000,
			retry: false,
		});
		if (
			uploaded.data.versionCode !== metadata.versionCode ||
			uploaded.data.sha256.toLowerCase() !== report.sha256
		) {
			throw new Error("Play bundle version/hash mismatch");
		}
		await client.request({
			url: `${base}/${id}/tracks/internal`,
			method: "PUT",
			data: androidTrack(metadata.version, metadata.versionCode),
			retry: false,
		});
		await client.request({
			url: `${base}/${id}:commit`,
			method: "POST",
			data: {},
			retry: false,
		});
		console.log("Uploaded and committed the Android internal test release.");
	} catch {
		throw new Error(
			"Play upload/commit failed or its outcome is uncertain. Retain the AAB and inspect Play Console before retrying; no automatic replay was attempted.",
		);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
	try {
		await main();
	} catch (error) {
		console.error(
			error instanceof Error ? error.message : "Android release failed",
		);
		process.exitCode = 1;
	}
}
