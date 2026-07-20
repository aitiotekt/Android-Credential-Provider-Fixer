import semver from "semver";
import { type AcpFixerMetadata, type SigningPolicy } from "./metadata.mts";

export type ReleaseChannel = "stable" | "alpha" | "beta";

export type ParsedReleaseVersion = {
	version: string;
	channel: ReleaseChannel;
	isPrerelease: boolean;
	tag: string;
};

export type ReleasePlan = ParsedReleaseVersion & {
	sourceRef: string;
	sourceSha: string;
	testsRunId: string;
	macosSigning: SigningPolicy;
	windowsSigning: SigningPolicy;
	requiresStableApproval: boolean;
	mayCreateTag: boolean;
};

const RELEASE_VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta)\.([1-9]\d*|0))?$/;

export function parseReleaseVersion(
	version: string,
	tagPrefix = "v",
): ParsedReleaseVersion {
	const match = RELEASE_VERSION.exec(version);
	if (!match || !semver.valid(version) || version.includes("+")) {
		throw new Error(
			`Unsupported release version ${version}; expected X.Y.Z, X.Y.Z-alpha.N, or X.Y.Z-beta.N.`,
		);
	}
	const channel = (match[4] ?? "stable") as ReleaseChannel;
	return {
		version,
		channel,
		isPrerelease: channel !== "stable",
		tag: `${tagPrefix}${version}`,
	};
}

export function resolveReleasePlan(
	metadata: AcpFixerMetadata,
	input: { sourceRef: string; sourceSha: string; testsRunId: string },
): ReleasePlan {
	if (!/^[0-9a-f]{40}$/i.test(input.sourceSha)) {
		throw new Error("source-sha must be a full 40-character Git commit SHA.");
	}
	if (!/^\d+$/.test(input.testsRunId)) {
		throw new Error("tests-run-id must be a GitHub Actions run ID.");
	}
	const parsed = parseReleaseVersion(
		metadata.project.version,
		metadata.release.tagPrefix,
	);
	const releaseBranchRef = `refs/heads/${metadata.release.branch}`;
	const expectedTagRef = `refs/tags/${parsed.tag}`;
	if (parsed.channel === "stable" && input.sourceRef !== expectedTagRef) {
		throw new Error(
			"Stable releases must originate from the exact version tag.",
		);
	}
	if (
		parsed.isPrerelease &&
		input.sourceRef !== releaseBranchRef &&
		input.sourceRef !== expectedTagRef
	) {
		throw new Error(
			`Prereleases must originate from ${releaseBranchRef} or ${expectedTagRef}.`,
		);
	}
	const stable = parsed.channel === "stable";
	return {
		...parsed,
		...input,
		macosSigning: stable ? "signed" : metadata.release.prereleaseSigning.macos,
		windowsSigning: stable
			? "signed"
			: metadata.release.prereleaseSigning.windows,
		requiresStableApproval: stable,
		mayCreateTag: parsed.isPrerelease && input.sourceRef === releaseBranchRef,
	};
}

export function assertTagMatchesVersion(
	metadata: AcpFixerMetadata,
	sourceRef: string,
): void {
	if (!sourceRef.startsWith("refs/tags/")) {
		return;
	}
	const parsed = parseReleaseVersion(
		metadata.project.version,
		metadata.release.tagPrefix,
	);
	if (sourceRef !== `refs/tags/${parsed.tag}`) {
		throw new Error(
			`Tag ${sourceRef} does not match metadata version ${metadata.project.version}.`,
		);
	}
}
