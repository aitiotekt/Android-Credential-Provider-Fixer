import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { writeJson } from "./io.mts";
import {
	artifactFileName,
	loadMetadata,
	REPO_ROOT,
	type ReleaseArtifact,
} from "./metadata.mts";
import { parseReleaseVersion } from "./policy.mts";

type PlatformReport = {
	schemaVersion: 1;
	fileName: string;
	kind: "desktop" | "cli";
	target: string;
	signed: boolean;
	notarized: boolean;
};

type ManifestArtifact = PlatformReport & {
	platform: string;
	size: number;
	sha256: string;
};

function filesRecursively(directory: string): string[] {
	if (!existsSync(directory)) {
		return [];
	}
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? filesRecursively(path) : [path];
	});
}

function sha256(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readChecksums(path: string): Map<string, string> {
	return new Map(
		readFileSync(path, "utf8")
			.trim()
			.split("\n")
			.map((line) => {
				const match = /^([0-9a-f]{64}) {2}([^/\\]+)$/i.exec(line);
				if (!match) {
					throw new Error(`Invalid SHA256SUMS entry: ${line}.`);
				}
				return [match[2], match[1].toLowerCase()] as const;
			}),
	);
}

function findExactly(files: string[], name: string): string {
	const matches = files.filter((path) => basename(path) === name);
	if (matches.length !== 1) {
		throw new Error(`Expected exactly one ${name}; found ${matches.length}.`);
	}
	return matches[0];
}

export function writePlatformReport(
	output: string,
	input: Omit<PlatformReport, "schemaVersion">,
): void {
	writeJson(resolve(REPO_ROOT, output), { schemaVersion: 1, ...input });
}

export function stageDesktop(input: {
	target: string;
	source: string;
	outputDirectory: string;
}): string {
	const metadata = loadMetadata();
	const artifact = metadata.release.artifacts.find(
		(candidate) =>
			candidate.kind === "desktop" && candidate.target === input.target,
	);
	if (!artifact) {
		throw new Error(`Unknown desktop target ${input.target}.`);
	}
	const source = resolve(REPO_ROOT, input.source);
	if (!statSync(source).isFile()) {
		throw new Error(`Desktop artifact is not a file: ${input.source}.`);
	}
	const destination = resolve(
		REPO_ROOT,
		input.outputDirectory,
		artifactFileName(metadata, artifact),
	);
	mkdirSync(dirname(destination), { recursive: true });
	copyFileSync(source, destination);
	return destination;
}

export function stageCli(input: {
	target: string;
	binary: string;
	notices: string;
	outputDirectory: string;
}): string {
	const metadata = loadMetadata();
	const artifact = metadata.release.artifacts.find(
		(candidate) =>
			candidate.kind === "cli" && candidate.target === input.target,
	);
	if (!artifact) {
		throw new Error(`Unknown CLI target ${input.target}.`);
	}
	const binary = resolve(REPO_ROOT, input.binary);
	const notices = resolve(REPO_ROOT, input.notices);
	for (const path of [binary, notices]) {
		if (!statSync(path).isFile()) {
			throw new Error(`CLI package input is not a file: ${path}.`);
		}
	}
	const outputDirectory = resolve(REPO_ROOT, input.outputDirectory);
	const work = resolve(outputDirectory, `.stage-${input.target}`);
	rmSync(work, { recursive: true, force: true });
	mkdirSync(work, { recursive: true });
	const executableName =
		artifact.platform === "windows"
			? `${metadata.project.binaryName}.exe`
			: metadata.project.binaryName;
	copyFileSync(binary, resolve(work, executableName));
	copyFileSync(resolve(REPO_ROOT, "README.md"), resolve(work, "README.md"));
	copyFileSync(resolve(REPO_ROOT, "LICENSE"), resolve(work, "LICENSE"));
	copyFileSync(notices, resolve(work, "THIRD_PARTY_NOTICES.html"));
	const destination = resolve(
		outputDirectory,
		artifactFileName(metadata, artifact),
	);
	mkdirSync(outputDirectory, { recursive: true });
	if (artifact.extension === "zip") {
		if (process.platform !== "win32") {
			throw new Error("ZIP CLI staging must run on Windows.");
		}
		execFileSync("powershell.exe", [
			"-NoLogo",
			"-NoProfile",
			"-Command",
			"Compress-Archive -LiteralPath @($args[0],$args[1],$args[2],$args[3]) -DestinationPath $args[4] -Force",
			resolve(work, executableName),
			resolve(work, "README.md"),
			resolve(work, "LICENSE"),
			resolve(work, "THIRD_PARTY_NOTICES.html"),
			destination,
		]);
	} else {
		execFileSync("tar", [
			"-czf",
			destination,
			"-C",
			work,
			executableName,
			"README.md",
			"LICENSE",
			"THIRD_PARTY_NOTICES.html",
		]);
	}
	rmSync(work, { recursive: true, force: true });
	return destination;
}

export function currentRustTarget(): string {
	const version = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
	const host = /^host:\s*(.+)$/m.exec(version)?.[1];
	if (!host) {
		throw new Error("Unable to determine the current Rust host target.");
	}
	return host;
}

function expectedSigning(
	artifact: ReleaseArtifact,
	macos: string,
	windows: string,
): boolean {
	if (artifact.platform === "macos") {
		return macos === "signed";
	}
	if (artifact.platform === "windows") {
		return windows === "signed";
	}
	return false;
}

export function createManifest(input: {
	inputDirectory: string;
	outputDirectory: string;
	sourceRef: string;
	sourceSha: string;
	runUrl: string;
	macosSigning: string;
	windowsSigning: string;
}): { manifestPath: string; checksumsPath: string; artifactCount: number } {
	if (
		!["signed", "unsigned"].includes(input.macosSigning) ||
		!["signed", "unsigned"].includes(input.windowsSigning)
	) {
		throw new Error("Manifest signing policies must be signed or unsigned.");
	}
	if (
		!input.sourceRef.startsWith("refs/") ||
		!/^[0-9a-f]{40}$/i.test(input.sourceSha) ||
		!URL.canParse(input.runUrl)
	) {
		throw new Error("Manifest source identity or Actions run URL is invalid.");
	}
	const metadata = loadMetadata();
	const parsed = parseReleaseVersion(
		metadata.project.version,
		metadata.release.tagPrefix,
	);
	const files = filesRecursively(resolve(REPO_ROOT, input.inputDirectory));
	const reports = files
		.filter((path) => path.endsWith(".report.json"))
		.map((path) => JSON.parse(readFileSync(path, "utf8")) as PlatformReport);
	const output = resolve(REPO_ROOT, input.outputDirectory);
	mkdirSync(output, { recursive: true });
	const manifestArtifacts: ManifestArtifact[] = [];
	for (const artifact of metadata.release.artifacts) {
		const fileName = artifactFileName(metadata, artifact);
		const source = findExactly(files, fileName);
		const report = reports.filter(
			(candidate) => candidate.fileName === fileName,
		);
		if (report.length !== 1) {
			throw new Error(`Expected exactly one platform report for ${fileName}.`);
		}
		const expectedSigned = expectedSigning(
			artifact,
			input.macosSigning,
			input.windowsSigning,
		);
		if (
			report[0].schemaVersion !== 1 ||
			report[0].kind !== artifact.kind ||
			report[0].target !== artifact.target ||
			report[0].signed !== expectedSigned
		) {
			throw new Error(
				`Platform report does not match release policy for ${fileName}.`,
			);
		}
		if (
			artifact.platform === "macos" &&
			expectedSigned &&
			!report[0].notarized
		) {
			throw new Error(`Signed macOS artifact was not notarized: ${fileName}.`);
		}
		const destination = resolve(output, fileName);
		copyFileSync(source, destination);
		manifestArtifacts.push({
			...report[0],
			platform: artifact.platform,
			size: statSync(destination).size,
			sha256: sha256(destination),
		});
	}
	for (const notice of [
		"THIRD_PARTY_NOTICES-CLI.html",
		"THIRD_PARTY_NOTICES-GUI.html",
	]) {
		copyFileSync(findExactly(files, notice), resolve(output, notice));
	}
	const manifest = {
		schemaVersion: 1,
		version: metadata.project.version,
		tag: parsed.tag,
		channel: parsed.channel,
		sourceRef: input.sourceRef,
		sourceSha: input.sourceSha,
		buildRunUrl: input.runUrl,
		toolchain: { node: "26.1.0", pnpm: "12.1.0", rust: "1.98.0" },
		artifacts: manifestArtifacts,
	};
	const manifestPath = resolve(output, "release-manifest.json");
	writeJson(manifestPath, manifest);
	const checksumEntries = [
		...manifestArtifacts.map(
			(artifact) => [artifact.fileName, artifact.sha256] as const,
		),
		...["THIRD_PARTY_NOTICES-CLI.html", "THIRD_PARTY_NOTICES-GUI.html"].map(
			(name) => [name, sha256(resolve(output, name))] as const,
		),
		["release-manifest.json", sha256(manifestPath)] as const,
	].sort(([left], [right]) => left.localeCompare(right));
	const checksumsPath = resolve(output, "SHA256SUMS");
	const contents = checksumEntries
		.map(([name, hash]) => `${hash}  ${name}`)
		.join("\n");
	writeFileSync(checksumsPath, `${contents}\n`);
	return {
		manifestPath,
		checksumsPath,
		artifactCount: manifestArtifacts.length,
	};
}

export function verifyArtifacts(manifestPath: string): number {
	const absoluteManifest = resolve(REPO_ROOT, manifestPath);
	const manifest = JSON.parse(readFileSync(absoluteManifest, "utf8")) as {
		schemaVersion: number;
		version: string;
		tag: string;
		sourceSha: string;
		artifacts: ManifestArtifact[];
	};
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.artifacts)) {
		throw new Error("Unsupported release manifest.");
	}
	const metadata = loadMetadata();
	const parsed = parseReleaseVersion(
		metadata.project.version,
		metadata.release.tagPrefix,
	);
	if (
		manifest.version !== metadata.project.version ||
		manifest.tag !== parsed.tag ||
		!/^[0-9a-f]{40}$/i.test(manifest.sourceSha)
	) {
		throw new Error("Release manifest identity does not match metadata.");
	}
	if (manifest.artifacts.length !== metadata.release.artifacts.length) {
		throw new Error("Release manifest has an incomplete artifact set.");
	}
	const directory = dirname(absoluteManifest);
	const expected = new Map(
		metadata.release.artifacts.map((artifact) => [
			`${artifact.kind}:${artifact.target}`,
			artifact,
		]),
	);
	const seen = new Set<string>();
	for (const artifact of manifest.artifacts) {
		const identity = `${artifact.kind}:${artifact.target}`;
		const declared = expected.get(identity);
		if (
			!declared ||
			seen.has(identity) ||
			artifact.platform !== declared.platform ||
			artifact.fileName !== artifactFileName(metadata, declared) ||
			basename(artifact.fileName) !== artifact.fileName ||
			artifact.notarized !==
				(declared.platform === "macos" && artifact.signed) ||
			(declared.platform === "linux" && artifact.signed)
		) {
			throw new Error(
				`Release manifest contains an invalid artifact: ${artifact.fileName}.`,
			);
		}
		seen.add(identity);
		const path = resolve(directory, artifact.fileName);
		if (
			!existsSync(path) ||
			statSync(path).size !== artifact.size ||
			sha256(path) !== artifact.sha256
		) {
			throw new Error(
				`Release artifact verification failed: ${artifact.fileName}.`,
			);
		}
	}
	const checksums = readChecksums(resolve(directory, "SHA256SUMS"));
	const checksumFiles = [
		...manifest.artifacts.map((artifact) => artifact.fileName),
		"THIRD_PARTY_NOTICES-CLI.html",
		"THIRD_PARTY_NOTICES-GUI.html",
		"release-manifest.json",
	];
	if (
		checksums.size !== checksumFiles.length ||
		checksumFiles.some(
			(name) =>
				!existsSync(resolve(directory, name)) ||
				checksums.get(name) !== sha256(resolve(directory, name)),
		)
	) {
		throw new Error("Release checksum set is incomplete or invalid.");
	}
	return manifest.artifacts.length;
}

export function verifyPublishedRelease(
	currentDirectory: string,
	publishedDirectory: string,
): number {
	const current = resolve(REPO_ROOT, currentDirectory);
	const published = resolve(REPO_ROOT, publishedDirectory);
	const checksums = readChecksums(resolve(current, "SHA256SUMS"));
	const expected = new Set([...checksums.keys(), "SHA256SUMS"]);
	const actualFiles = filesRecursively(published);
	const actualNames = actualFiles.map((path) => basename(path));
	if (
		new Set(actualNames).size !== actualNames.length ||
		actualNames.length !== expected.size ||
		actualNames.some((name) => !expected.has(name))
	) {
		throw new Error("Published Release asset names do not match this release.");
	}
	for (const name of expected) {
		const currentPath = resolve(current, name);
		const publishedPath = findExactly(actualFiles, name);
		if (
			!existsSync(currentPath) ||
			sha256(currentPath) !== sha256(publishedPath)
		) {
			throw new Error(`Published Release asset differs: ${name}.`);
		}
	}
	return expected.size;
}
