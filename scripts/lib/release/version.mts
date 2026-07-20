import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	loadMetadata,
	METADATA_PATH,
	REPO_ROOT,
	type SigningPolicy,
} from "./metadata.mts";
import { parseReleaseVersion } from "./policy.mts";

type CargoMetadata = {
	packages: Array<{
		license: string | null;
		name: string;
		repository: string | null;
		version: string;
	}>;
};

function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(resolve(REPO_ROOT, path), "utf8")) as Record<
		string,
		unknown
	>;
}

function writeJson(path: string, value: Record<string, unknown>): void {
	writeFileSync(
		resolve(REPO_ROOT, path),
		`${JSON.stringify(value, null, "\t")}\n`,
	);
}

function replaceExactly(
	source: string,
	pattern: RegExp,
	replacement: string,
	label: string,
): string {
	const matches = source.match(
		new RegExp(
			pattern.source,
			pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
		),
	);
	if (matches?.length !== 1) {
		throw new Error(
			`Expected exactly one managed ${label}; found ${matches?.length ?? 0}.`,
		);
	}
	return source.replace(pattern, replacement);
}

export function checkVersion(): { version: string; sourceCount: number } {
	const metadata = loadMetadata();
	parseReleaseVersion(metadata.project.version, metadata.release.tagPrefix);
	const sources: Array<[string, string]> = [];
	for (const path of [
		"package.json",
		"apps/tauri-app/package.json",
		"docsite/package.json",
	]) {
		const value = readJson(path).version;
		if (typeof value !== "string") {
			throw new Error(`${path} has no version.`);
		}
		sources.push([path, value]);
	}
	const tauri = readJson("apps/tauri-app/src-tauri/tauri.conf.json");
	if (typeof tauri.version !== "string") {
		throw new Error("Tauri config has no version.");
	}
	sources.push(["apps/tauri-app/src-tauri/tauri.conf.json", tauri.version]);
	const cargo = JSON.parse(
		execFileSync(
			"cargo",
			["metadata", "--locked", "--no-deps", "--format-version", "1"],
			{
				cwd: REPO_ROOT,
				encoding: "utf8",
			},
		),
	) as CargoMetadata;
	for (const pkg of cargo.packages) {
		sources.push([`Cargo package ${pkg.name}`, pkg.version]);
		if (
			pkg.license !== "MIT" ||
			pkg.repository !== metadata.project.repositoryUrl
		) {
			throw new Error(
				`Cargo package ${pkg.name} release metadata does not match acp-fixer-metadata.toml.`,
			);
		}
	}
	const mismatches = sources.filter(
		([, version]) => version !== metadata.project.version,
	);
	if (mismatches.length > 0) {
		throw new Error(
			`Expected ${metadata.project.version}: ${mismatches.map(([name, version]) => `${name}=${version}`).join(", ")}`,
		);
	}
	for (const path of ["CHANGELOG.md", "docs/zh/CHANGELOG.md"]) {
		const source = readFileSync(resolve(REPO_ROOT, path), "utf8");
		const headings = source.match(
			new RegExp(
				`^## ${metadata.project.version.replaceAll(".", "\\.")}$`,
				"gm",
			),
		);
		if (headings?.length !== 1) {
			throw new Error(
				`${path} must contain exactly one ${metadata.project.version} section.`,
			);
		}
	}
	if (tauri.identifier !== metadata.project.identifier) {
		throw new Error("Tauri identifier does not match release metadata.");
	}
	if (tauri.productName !== metadata.project.displayName) {
		throw new Error("Tauri product name does not match release metadata.");
	}
	return { version: metadata.project.version, sourceCount: sources.length };
}

export function setVersion(version: string): { version: string } {
	parseReleaseVersion(version);
	const metadataSource = readFileSync(METADATA_PATH, "utf8");
	writeFileSync(
		METADATA_PATH,
		replaceExactly(
			metadataSource,
			/(?<=\[project\]\n)version = "[^"]+"/,
			`version = "${version}"`,
			"metadata project version",
		),
	);
	for (const path of [
		"package.json",
		"apps/tauri-app/package.json",
		"docsite/package.json",
	]) {
		const json = readJson(path);
		json.version = version;
		writeJson(path, json);
	}
	const tauriPath = "apps/tauri-app/src-tauri/tauri.conf.json";
	const tauri = readJson(tauriPath);
	tauri.version = version;
	writeJson(tauriPath, tauri);
	const cargoPath = resolve(REPO_ROOT, "Cargo.toml");
	writeFileSync(
		cargoPath,
		replaceExactly(
			readFileSync(cargoPath, "utf8"),
			/(?<=\[workspace\.package\]\n)version = "[^"]+"/,
			`version = "${version}"`,
			"Cargo workspace version",
		),
	);
	execFileSync("cargo", ["metadata", "--format-version", "1"], {
		cwd: REPO_ROOT,
		stdio: "ignore",
	});
	return { version };
}

export function setPrereleaseSigning(
	platform: "macos" | "windows",
	policy: SigningPolicy,
): { platform: "macos" | "windows"; policy: SigningPolicy } {
	const metadata = loadMetadata();
	if (
		!parseReleaseVersion(metadata.project.version).isPrerelease &&
		policy === "unsigned"
	) {
		throw new Error(
			"Stable releases cannot select unsigned platform artifacts.",
		);
	}
	const source = readFileSync(METADATA_PATH, "utf8");
	const section = "[release.prerelease_signing]";
	const sectionStart = source.indexOf(section);
	const sectionEnd = source.indexOf("\n[", sectionStart + section.length);
	if (sectionStart === -1) {
		throw new Error("Missing release.prerelease_signing section.");
	}
	const prefix = source.slice(0, sectionStart);
	const body = source.slice(
		sectionStart,
		sectionEnd === -1 ? undefined : sectionEnd,
	);
	const suffix = sectionEnd === -1 ? "" : source.slice(sectionEnd);
	const pattern = new RegExp(`${platform} = "(?:signed|unsigned)"`);
	writeFileSync(
		METADATA_PATH,
		`${prefix}${replaceExactly(body, pattern, `${platform} = "${policy}"`, `${platform} signing policy`)}${suffix}`,
	);
	return { platform, policy };
}
