import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadMetadata, REPO_ROOT } from "./metadata.mts";
import { parseReleaseVersion } from "./policy.mts";

export function extractChangelogSection(
	source: string,
	version: string,
): string {
	const heading = `## ${version}`;
	const start = source.indexOf(`${heading}\n`);
	if (start === -1) {
		throw new Error(`CHANGELOG.md has no ${version} section.`);
	}
	const bodyStart = start + heading.length + 1;
	const next = source.indexOf("\n## ", bodyStart);
	const body = source.slice(bodyStart, next === -1 ? undefined : next).trim();
	if (!body) {
		throw new Error(`CHANGELOG.md section ${version} is empty.`);
	}
	return body;
}

export function generateReleaseNotes(input: {
	manifest: string;
	output: string;
}): string {
	const metadata = loadMetadata();
	const parsed = parseReleaseVersion(
		metadata.project.version,
		metadata.release.tagPrefix,
	);
	const manifest = JSON.parse(
		readFileSync(resolve(REPO_ROOT, input.manifest), "utf8"),
	) as {
		artifacts: Array<{
			fileName: string;
			platform: string;
			signed: boolean;
			notarized: boolean;
		}>;
	};
	const changelog = extractChangelogSection(
		readFileSync(resolve(REPO_ROOT, "CHANGELOG.md"), "utf8"),
		metadata.project.version,
	);
	const rows = manifest.artifacts
		.map(
			(artifact) =>
				`| \`${artifact.fileName}\` | ${artifact.platform} | ${artifact.signed ? "Platform signed" : artifact.platform === "linux" ? "GitHub attestation" : "Unsigned prerelease"} | ${artifact.notarized ? "Yes" : "No"} |`,
		)
		.join("\n");
	const warning = parsed.isPrerelease
		? "> This is prerelease software. Artifacts marked unsigned are not code-signed or notarized and may trigger operating-system warnings."
		: "> This stable release requires platform signing for macOS and Windows artifacts.";
	const contents = `# ${metadata.project.displayName} ${metadata.project.version}\n\n${warning}\n\n${changelog}\n\n## Downloads and verification\n\n| Artifact | Platform | Trust status | Notarized |\n| --- | --- | --- | --- |\n${rows}\n\nThe application does not bundle ADB. Install Android SDK Platform-Tools separately. Verify downloads with \`SHA256SUMS\`, inspect \`release-manifest.json\`, and run \`gh attestation verify <file> --repo aitiotekt/Android-Credential-Provider-Fixer\`.\n`;
	const output = resolve(REPO_ROOT, input.output);
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, contents);
	return output;
}
