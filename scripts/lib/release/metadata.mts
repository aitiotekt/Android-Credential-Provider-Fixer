import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "smol-toml";

export const REPO_ROOT = resolve(import.meta.dirname, "../../..");
export const METADATA_PATH = resolve(REPO_ROOT, "acp-fixer-metadata.toml");

export type SigningPolicy = "signed" | "unsigned";
export type ArtifactKind = "desktop" | "cli";
export type ArtifactPlatform = "macos" | "windows" | "linux";

export type ReleaseArtifact = {
	kind: ArtifactKind;
	platform: ArtifactPlatform;
	target: string;
	extension: "dmg" | "exe" | "tar.gz" | "zip";
};

export type AcpFixerMetadata = {
	schemaVersion: 1;
	project: {
		version: string;
		displayName: string;
		binaryName: string;
		identifier: string;
		repositoryUrl: string;
		docsUrl: string;
	};
	release: {
		branch: string;
		tagPrefix: string;
		prereleaseSigning: {
			macos: SigningPolicy;
			windows: SigningPolicy;
		};
		artifacts: ReleaseArtifact[];
	};
};

type RawMetadata = {
	schema_version?: unknown;
	project?: Record<string, unknown>;
	release?: Record<string, unknown> & {
		prerelease_signing?: Record<string, unknown>;
		artifact?: unknown;
	};
};

const SUPPORTED_ARTIFACTS = new Set([
	"desktop:macos:aarch64-apple-darwin:dmg",
	"desktop:macos:x86_64-apple-darwin:dmg",
	"desktop:windows:x86_64-pc-windows-msvc:exe",
	"cli:macos:aarch64-apple-darwin:tar.gz",
	"cli:macos:x86_64-apple-darwin:tar.gz",
	"cli:windows:x86_64-pc-windows-msvc:zip",
	"cli:linux:x86_64-unknown-linux-gnu:tar.gz",
	"cli:linux:aarch64-unknown-linux-gnu:tar.gz",
]);

function requiredString(
	object: Record<string, unknown> | undefined,
	key: string,
	location: string,
): string {
	const value = object?.[key];
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(
			`Missing non-empty ${location}.${key} in acp-fixer-metadata.toml.`,
		);
	}
	return value;
}

function signingPolicy(value: unknown, location: string): SigningPolicy {
	if (value !== "signed" && value !== "unsigned") {
		throw new Error(`${location} must be "signed" or "unsigned".`);
	}
	return value;
}

function releaseArtifact(value: unknown, index: number): ReleaseArtifact {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`release.artifact[${index}] must be a table.`);
	}
	const object = value as Record<string, unknown>;
	const kind = requiredString(object, "kind", `release.artifact[${index}]`);
	const platform = requiredString(
		object,
		"platform",
		`release.artifact[${index}]`,
	);
	const extension = requiredString(
		object,
		"extension",
		`release.artifact[${index}]`,
	);
	if (kind !== "desktop" && kind !== "cli") {
		throw new Error(`Unsupported artifact kind: ${kind}.`);
	}
	if (platform !== "macos" && platform !== "windows" && platform !== "linux") {
		throw new Error(`Unsupported artifact platform: ${platform}.`);
	}
	if (!["dmg", "exe", "tar.gz", "zip"].includes(extension)) {
		throw new Error(`Unsupported artifact extension: ${extension}.`);
	}
	return {
		kind,
		platform,
		target: requiredString(object, "target", `release.artifact[${index}]`),
		extension: extension as ReleaseArtifact["extension"],
	};
}

export function loadMetadata(path = METADATA_PATH): AcpFixerMetadata {
	const raw = parse(readFileSync(path, "utf8")) as RawMetadata;
	if (raw.schema_version !== 1) {
		throw new Error("acp-fixer-metadata.toml schema_version must be 1.");
	}
	const project = raw.project;
	const release = raw.release;
	const signing = release?.prerelease_signing;
	const artifacts = release?.artifact;
	if (!Array.isArray(artifacts) || artifacts.length === 0) {
		throw new Error("acp-fixer-metadata.toml must define release artifacts.");
	}
	const parsedArtifacts = artifacts.map(releaseArtifact);
	const identities = new Set<string>();
	for (const artifact of parsedArtifacts) {
		const identity = `${artifact.kind}:${artifact.platform}:${artifact.target}:${artifact.extension}`;
		if (identities.has(identity)) {
			throw new Error(`Duplicate release artifact: ${identity}.`);
		}
		identities.add(identity);
		if (!SUPPORTED_ARTIFACTS.has(identity)) {
			throw new Error(`Unsupported release artifact: ${identity}.`);
		}
	}
	if (
		identities.size !== SUPPORTED_ARTIFACTS.size ||
		[...SUPPORTED_ARTIFACTS].some((identity) => !identities.has(identity))
	) {
		throw new Error(
			"Release metadata must define the complete artifact matrix.",
		);
	}
	return {
		schemaVersion: 1,
		project: {
			version: requiredString(project, "version", "project"),
			displayName: requiredString(project, "display_name", "project"),
			binaryName: requiredString(project, "binary_name", "project"),
			identifier: requiredString(project, "identifier", "project"),
			repositoryUrl: requiredString(project, "repository_url", "project"),
			docsUrl: requiredString(project, "docs_url", "project"),
		},
		release: {
			branch: requiredString(release, "branch", "release"),
			tagPrefix: requiredString(release, "tag_prefix", "release"),
			prereleaseSigning: {
				macos: signingPolicy(
					signing?.macos,
					"release.prerelease_signing.macos",
				),
				windows: signingPolicy(
					signing?.windows,
					"release.prerelease_signing.windows",
				),
			},
			artifacts: parsedArtifacts,
		},
	};
}

export function artifactFileName(
	metadata: AcpFixerMetadata,
	artifact: ReleaseArtifact,
): string {
	const prefix =
		artifact.kind === "desktop"
			? "android-credential-provider-fixer"
			: metadata.project.binaryName;
	const suffix =
		artifact.kind === "desktop" && artifact.extension === "exe"
			? "-setup.exe"
			: `.${artifact.extension}`;
	return `${prefix}-v${metadata.project.version}-${artifact.target}${suffix}`;
}
