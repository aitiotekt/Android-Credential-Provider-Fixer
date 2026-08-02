import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "smol-toml";
import { METADATA_PATH, REPO_ROOT } from "./metadata.mts";
import { parseReleaseVersion } from "./policy.mts";

export type AndroidMetadata = {
	version: string;
	versionCode: number;
	identifier: string;
	displayName: string;
	displayNameZh: string;
	testUrl: string;
	publish: "build-only" | "internal";
};

export function parseAndroidMetadata(source: string): AndroidMetadata {
	const data = parse(source).android;
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw new Error("Missing Android metadata");
	}
	const value = data as Record<string, unknown>;
	const string = (key: string) => {
		if (typeof value[key] !== "string" || !value[key]) {
			throw new Error(`Invalid android.${key}`);
		}
		return value[key] as string;
	};
	const version = string("version");
	parseReleaseVersion(version);
	const versionCode = value.version_code;
	if (
		typeof versionCode !== "number" ||
		!Number.isInteger(versionCode) ||
		versionCode < 1 ||
		versionCode > 2_100_000_000
	) {
		throw new Error("Invalid Android versionCode");
	}
	const publish = string("publish");
	if (publish !== "build-only" && publish !== "internal") {
		throw new Error("Invalid Android publishing policy");
	}
	const identifier = string("identifier");
	if (identifier !== "com.aitiotekt.webauthndiagnosis") {
		throw new Error("Android application identity must not drift");
	}
	const testUrl = string("test_url");
	if (testUrl !== "https://acp-fixer.aitiotekt.com/webauthn/") {
		throw new Error("Invalid Android test URL");
	}
	return {
		version,
		versionCode,
		publish,
		identifier,
		testUrl,
		displayName: string("display_name"),
		displayNameZh: string("display_name_zh"),
	};
}

export function loadAndroidMetadata(): AndroidMetadata {
	return parseAndroidMetadata(readFileSync(METADATA_PATH, "utf8"));
}

export function androidProperties(value: AndroidMetadata): string {
	return `# Managed by scripts/dev-cli.mts; do not edit directly.\napplicationId=${value.identifier}\nversionName=${value.version}\nversionCode=${value.versionCode}\ntestUrl=${value.testUrl}\n`;
}

export function checkAndroidVersion(): {
	version: string;
	sourceCount: number;
} {
	const value = loadAndroidMetadata();
	if (
		readFileSync(
			resolve(REPO_ROOT, "apps/android-app/metadata.properties"),
			"utf8",
		) !== androidProperties(value)
	) {
		throw new Error("Android generated metadata is out of sync");
	}
	for (const language of ["en", "zh"]) {
		const changelog = readFileSync(
			resolve(
				REPO_ROOT,
				language === "en"
					? "CHANGELOG-ANDROID.md"
					: `docs/${language}/CHANGELOG-ANDROID.md`,
			),
			"utf8",
		);
		if (
			changelog.split("\n").filter((line) => line === `## ${value.version}`)
				.length !== 1
		) {
			throw new Error(
				`Missing Android ${language} changelog for ${value.version}`,
			);
		}
		const directory = language === "en" ? "values" : "values-zh";
		const name = language === "en" ? value.displayName : value.displayNameZh;
		if (
			!readFileSync(
				resolve(
					REPO_ROOT,
					`apps/android-app/app/src/main/res/${directory}/strings.xml`,
				),
				"utf8",
			).includes(`<string name="app_name">${name}</string>`)
		) {
			throw new Error("Android display name differs from metadata");
		}
	}
	return { version: value.version, sourceCount: 4 };
}

export function setAndroidVersion(
	version: string,
	explicitCode?: number,
): { version: string; versionCode: number } {
	const source = readFileSync(METADATA_PATH, "utf8");
	const updated = updateAndroidVersion(source, version, explicitCode);
	const next = parseAndroidMetadata(updated);
	writeFileSync(METADATA_PATH, updated);
	writeFileSync(
		resolve(REPO_ROOT, "apps/android-app/metadata.properties"),
		androidProperties(next),
	);
	return { version: next.version, versionCode: next.versionCode };
}

export function updateAndroidVersion(
	source: string,
	version: string,
	explicitCode?: number,
): string {
	parseReleaseVersion(version);
	const old = parseAndroidMetadata(source);
	const versionCode =
		explicitCode ??
		(version === old.version ? old.versionCode : old.versionCode + 1);
	if (
		!Number.isInteger(versionCode) ||
		versionCode < old.versionCode ||
		versionCode > 2_100_000_000 ||
		(version !== old.version && versionCode === old.versionCode)
	) {
		throw new Error("A new Android build requires a larger versionCode");
	}
	const updated = source.replace(
		/(\[android\]\s*\nversion = ")[^"]+("\s*\nversion_code = )\d+/,
		(_match, prefix: string, separator: string) =>
			`${prefix}${version}${separator}${versionCode}`,
	);
	const next = parseAndroidMetadata(updated);
	if (next.version !== version || next.versionCode !== versionCode) {
		throw new Error("Could not update Android metadata");
	}
	return updated;
}

export function versionTarget(value: unknown): "desktop" | "android" {
	if (value === undefined || value === "default" || value === "desktop") {
		return "desktop";
	}
	if (value === "android") {
		return "android";
	}
	throw new Error(
		"--app must be default, desktop or android. Web packages follow desktop; web is a deployment target only.",
	);
}
