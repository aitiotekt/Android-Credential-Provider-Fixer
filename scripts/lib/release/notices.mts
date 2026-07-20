import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { REPO_ROOT } from "./metadata.mts";

type PnpmLicensePackage = {
	name: string;
	versions: string[];
	paths: string[];
	license: string;
	author?: string;
	homepage?: string;
};

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function licenseFile(pkg: PnpmLicensePackage, packagePath: string): string {
	const candidates = readdirSync(packagePath)
		.filter((name) => /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(name))
		.sort();
	for (const name of candidates) {
		const path = resolve(packagePath, name);
		if (statSync(path).isFile()) {
			return readFileSync(path, "utf8");
		}
	}
	if (pkg.license === "MIT" && pkg.author) {
		return `Copyright (c) ${pkg.author}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
	}
	throw new Error(
		`No bundled or unambiguous canonical license text found for ${pkg.name} at ${packagePath}.`,
	);
}

function frontendNotices(): string {
	const result = JSON.parse(
		execFileSync(
			"pnpm",
			[
				"--filter",
				"@aitiotekt/acp-fixer-tauri-app",
				"licenses",
				"list",
				"--prod",
				"--json",
			],
			{ cwd: REPO_ROOT, encoding: "utf8" },
		),
	) as Record<string, PnpmLicensePackage[]>;
	const packages = Object.values(result)
		.flat()
		.sort((left, right) => left.name.localeCompare(right.name));
	if (packages.length === 0) {
		throw new Error("No frontend production dependencies were reported.");
	}
	const sections = packages.map((pkg) => {
		const path = pkg.paths[0];
		if (!path) {
			throw new Error(`No installed path reported for ${pkg.name}.`);
		}
		return `<section><h2>${escapeHtml(pkg.name)} ${escapeHtml(pkg.versions.join(", "))}</h2><p>License: ${escapeHtml(pkg.license)}${pkg.homepage ? ` · <a href="${escapeHtml(pkg.homepage)}">Project website</a>` : ""}</p><pre>${escapeHtml(licenseFile(pkg, path))}</pre></section>`;
	});
	return `<h1>WebView third-party notices</h1>${sections.join("\n")}`;
}

function rustNotices(manifest: string, output: string): void {
	execFileSync(
		"cargo",
		[
			"about",
			"generate",
			"--manifest-path",
			manifest,
			"--config",
			"scripts/release/about.toml",
			"scripts/release/about.hbs",
			"--output-file",
			output,
		],
		{ cwd: REPO_ROOT, stdio: "inherit" },
	);
}

function combine(title: string, parts: string[]): string {
	const bodies = parts.map((part) =>
		readFileSync(part, "utf8")
			.replace(/^.*?<body>/s, "")
			.replace(/<\/body>.*$/s, ""),
	);
	return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#172033}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f9;padding:1rem;border-radius:.5rem}section{margin-block:2rem}</style></head><body><h1>${escapeHtml(title)}</h1>${bodies.join("\n")}</body></html>\n`;
}

export function generateNotices(outputDirectory: string): {
	cli: string;
	gui: string;
} {
	const output = resolve(REPO_ROOT, outputDirectory);
	mkdirSync(output, { recursive: true });
	const cliRust = resolve(output, ".cli-rust.html");
	const guiRust = resolve(output, ".gui-rust.html");
	const frontend = resolve(output, ".frontend.html");
	rustNotices("apps/cli/Cargo.toml", cliRust);
	rustNotices("apps/tauri-app/src-tauri/Cargo.toml", guiRust);
	writeFileSync(
		frontend,
		`<!doctype html><html lang="en"><body>${frontendNotices()}</body></html>`,
	);
	const cli = resolve(output, "THIRD_PARTY_NOTICES-CLI.html");
	const gui = resolve(output, "THIRD_PARTY_NOTICES-GUI.html");
	writeFileSync(
		cli,
		combine("Android Credential Provider Fixer CLI — Third-party notices", [
			cliRust,
		]),
	);
	writeFileSync(
		gui,
		combine("Android Credential Provider Fixer — Third-party notices", [
			guiRust,
			frontend,
		]),
	);
	return { cli, gui };
}

export function writeTauriReleaseConfig(
	notices: string,
	output: string,
	windowsSigning?: { certificateThumbprint: string; timestampUrl: string },
): void {
	const noticeSource = resolve(REPO_ROOT, notices);
	if (!existsSync(noticeSource)) {
		throw new Error(`GUI notices file is missing: ${notices}.`);
	}
	const resourceDirectory = resolve(
		REPO_ROOT,
		"apps/tauri-app/src-tauri/target/release-resources",
	);
	mkdirSync(resourceDirectory, { recursive: true });
	const resource = resolve(resourceDirectory, "THIRD_PARTY_NOTICES.html");
	copyFileSync(noticeSource, resource);
	const outputPath = resolve(REPO_ROOT, output);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(
		outputPath,
		`${JSON.stringify(
			{
				bundle: {
					licenseFile: "../../../LICENSE",
					resources: {
						[relative(
							resolve(REPO_ROOT, "apps/tauri-app/src-tauri"),
							resource,
						)]: "THIRD_PARTY_NOTICES.html",
					},
					...(windowsSigning
						? {
								windows: {
									certificateThumbprint: windowsSigning.certificateThumbprint,
									digestAlgorithm: "sha256",
									timestampUrl: windowsSigning.timestampUrl,
								},
							}
						: {}),
				},
			},
			null,
			2,
		)}\n`,
	);
}
