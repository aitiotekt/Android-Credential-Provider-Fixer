import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

type LinkEntry = {
	link: string;
	target: string;
	type: "file" | "dir";
};

type PackageMetadata = {
	packages: Array<{ name: string; version: string }>;
};

type JavaScriptPackage = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

const repoRoot = resolve(import.meta.dirname, "..");
const expectedVersion = "0.1.0-alpha.1";
const genericIconSource = "assets/icons/app-icon.png";
const macosLegacyIconSource = "assets/icons/app-icon-macos-legacy.png";
const generatedIconDirectory = "apps/tauri-app/src-tauri/icons";
const iconManifest = `${generatedIconDirectory}/.sources.json`;
const frontendIcon = "apps/tauri-app/public/app-icon.png";
const conventionDocumentNames = [
	"README.md",
	"SECURITY.md",
	"PRIVACY.md",
	"CONTRIBUTING.md",
] as const;
const linkEntries: LinkEntry[] = [
	...conventionDocumentNames.map((name) => ({
		link: `docs/en/${name}`,
		target: name,
		type: "file" as const,
	})),
	{ link: "docsite/index.md", target: "README.md", type: "file" },
	{ link: "docsite/security.md", target: "SECURITY.md", type: "file" },
	{ link: "docsite/privacy.md", target: "PRIVACY.md", type: "file" },
	{ link: "docsite/contributing.md", target: "CONTRIBUTING.md", type: "file" },
	{ link: "docsite/license.md", target: "LICENSE", type: "file" },
	{ link: "docsite/docs", target: "docs/en", type: "dir" },
	{ link: "docsite/zh/index.md", target: "docs/zh/README.md", type: "file" },
	{
		link: "docsite/zh/security.md",
		target: "docs/zh/SECURITY.md",
		type: "file",
	},
	{ link: "docsite/zh/privacy.md", target: "docs/zh/PRIVACY.md", type: "file" },
	{
		link: "docsite/zh/contributing.md",
		target: "docs/zh/CONTRIBUTING.md",
		type: "file",
	},
	{ link: "docsite/zh/license.md", target: "LICENSE", type: "file" },
	{ link: "docsite/zh/docs", target: "docs/zh", type: "dir" },
	{
		link: "docsite/public/icon.png",
		target: "assets/icons/app-icon.png",
		type: "file",
	},
];

function readJson<T>(relativePath: string): T {
	return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8")) as T;
}

function readLinkState(linkPath: string): "missing" | "symlink" | "other" {
	try {
		return lstatSync(linkPath).isSymbolicLink() ? "symlink" : "other";
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return "missing";
		}
		throw error;
	}
}

function expectedRelativeTarget(entry: LinkEntry): string {
	return relative(
		dirname(resolve(repoRoot, entry.link)),
		resolve(repoRoot, entry.target),
	);
}

function syncDocs(): void {
	for (const entry of linkEntries) {
		const linkPath = resolve(repoRoot, entry.link);
		const targetPath = resolve(repoRoot, entry.target);
		if (!existsSync(targetPath)) {
			throw new Error(`Managed link target is missing: ${entry.target}`);
		}
		const state = readLinkState(linkPath);
		const expectedTarget = expectedRelativeTarget(entry);
		if (state === "other") {
			throw new Error(`Refusing to overwrite non-symlink path: ${entry.link}`);
		}
		if (state === "symlink" && readlinkSync(linkPath) === expectedTarget) {
			continue;
		}
		if (state === "symlink") {
			unlinkSync(linkPath);
		}
		mkdirSync(dirname(linkPath), { recursive: true });
		symlinkSync(expectedTarget, linkPath, entry.type);
	}
	console.log(
		`Synchronized ${linkEntries.length} managed documentation links.`,
	);
}

function markdownNames(directory: string): string[] {
	return readdirSync(resolve(repoRoot, directory), { withFileTypes: true })
		.filter(
			(entry) =>
				(entry.isFile() || entry.isSymbolicLink()) &&
				entry.name.endsWith(".md"),
		)
		.map((entry) => entry.name)
		.sort();
}

function checkDocs(): void {
	for (const entry of linkEntries) {
		const linkPath = resolve(repoRoot, entry.link);
		if (readLinkState(linkPath) !== "symlink") {
			throw new Error(`Managed path is not a symlink: ${entry.link}`);
		}
		const actual = readlinkSync(linkPath);
		const expected = expectedRelativeTarget(entry);
		if (actual !== expected) {
			throw new Error(
				`Incorrect symlink ${entry.link}: expected ${expected}, found ${actual}`,
			);
		}
	}
	for (const name of conventionDocumentNames) {
		const englishSource = resolve(repoRoot, name);
		const translatedSource = resolve(repoRoot, "docs/zh", name);
		if (readLinkState(englishSource) !== "other") {
			throw new Error(
				`English convention source must be a regular file: ${name}`,
			);
		}
		if (readLinkState(translatedSource) !== "other") {
			throw new Error(
				`Translated convention source must be a regular file: docs/zh/${name}`,
			);
		}
	}
	const rootLanguageVariants = readdirSync(repoRoot).filter((name) =>
		/^(?:README|SECURITY|PRIVACY|CONTRIBUTING)\.[^.]+\.md$/i.test(name),
	);
	if (rootLanguageVariants.length > 0) {
		throw new Error(
			`Language-suffixed convention documents are not allowed at the repository root: ${rootLanguageVariants.join(", ")}`,
		);
	}

	const english = markdownNames("docs/en");
	const chinese = markdownNames("docs/zh");
	if (JSON.stringify(english) !== JSON.stringify(chinese)) {
		throw new Error(
			`Documentation languages differ. English: ${english.join(", ")}; Chinese: ${chinese.join(", ")}`,
		);
	}
	console.log(
		`Documentation links and ${english.length} bilingual document pairs are valid.`,
	);
}

function checkVersion(): void {
	const rootPackage = readJson<{ version: string }>("package.json");
	const appPackage = readJson<{ version: string }>(
		"apps/tauri-app/package.json",
	);
	const docsPackage = readJson<{ version: string }>("docsite/package.json");
	const tauriConfig = readJson<{ version: string }>(
		"apps/tauri-app/src-tauri/tauri.conf.json",
	);
	const cargo = JSON.parse(
		execFileSync("cargo", ["metadata", "--no-deps", "--format-version", "1"], {
			cwd: repoRoot,
			encoding: "utf8",
		}),
	) as PackageMetadata;
	const versions = [
		["root package", rootPackage.version],
		["Tauri app package", appPackage.version],
		["docsite package", docsPackage.version],
		["Tauri config", tauriConfig.version],
		...cargo.packages.map((pkg) => [`Cargo package ${pkg.name}`, pkg.version]),
	] as const;
	const mismatches = versions.filter(
		([, version]) => version !== expectedVersion,
	);
	if (mismatches.length > 0) {
		throw new Error(
			`Expected ${expectedVersion}: ${mismatches.map(([name, version]) => `${name}=${version}`).join(", ")}`,
		);
	}
	console.log(`All ${versions.length} version sources use ${expectedVersion}.`);
}

function assertIconMaster(relativePath: string, requireAlpha: boolean): void {
	const bytes = readFileSync(resolve(repoRoot, relativePath));
	const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	if (bytes.length < 26 || !bytes.subarray(0, 8).equals(pngSignature)) {
		throw new Error(`Icon master is not a valid PNG: ${relativePath}`);
	}
	const width = bytes.readUInt32BE(16);
	const height = bytes.readUInt32BE(20);
	if (width !== 1024 || height !== 1024) {
		throw new Error(
			`Icon master must be 1024x1024: ${relativePath} is ${width}x${height}`,
		);
	}
	const colorType = bytes[25];
	if (requireAlpha && colorType !== 4 && colorType !== 6) {
		throw new Error("macOS icon master must contain an alpha channel.");
	}
}

function relativeFilesUnder(directory: string, prefix = ""): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
		const absolutePath = resolve(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...relativeFilesUnder(absolutePath, relativePath));
		} else if (entry.isFile()) {
			files.push(relativePath);
		}
	}
	return files.sort();
}

function generateTauriIcons(
	source: string,
	output: string,
	stdio: "inherit" | "ignore",
): void {
	execFileSync(
		"pnpm",
		[
			"--dir",
			"apps/tauri-app",
			"exec",
			"tauri",
			"icon",
			resolve(repoRoot, source),
			"--output",
			output,
		],
		{ cwd: repoRoot, stdio },
	);
}

function withGeneratedIconSets(
	stdio: "inherit" | "ignore",
	action: (genericDirectory: string, macosLegacyDirectory: string) => void,
): void {
	const workDirectory = mkdtempSync(join(tmpdir(), "acp-fixer-icons-"));
	const genericDirectory = resolve(workDirectory, "generic");
	const macosLegacyDirectory = resolve(workDirectory, "macos-legacy");
	try {
		generateTauriIcons(genericIconSource, genericDirectory, stdio);
		generateTauriIcons(macosLegacyIconSource, macosLegacyDirectory, stdio);
		action(genericDirectory, macosLegacyDirectory);
	} finally {
		rmSync(workDirectory, { recursive: true, force: true });
	}
}

function iconManifestContents(): string {
	const appPackage = readJson<JavaScriptPackage>("apps/tauri-app/package.json");
	const cliVersion = appPackage.devDependencies?.["@tauri-apps/cli"];
	if (!cliVersion) {
		throw new Error("@tauri-apps/cli version is missing from the app package.");
	}
	const sha256 = (relativePath: string) =>
		createHash("sha256")
			.update(readFileSync(resolve(repoRoot, relativePath)))
			.digest("hex");
	return `${JSON.stringify(
		{
			genericSource: {
				path: genericIconSource,
				sha256: sha256(genericIconSource),
			},
			macosLegacySource: {
				path: macosLegacyIconSource,
				sha256: sha256(macosLegacyIconSource),
			},
			tauriCliVersion: cliVersion,
		},
		null,
		2,
	)}\n`;
}

function syncIcons(): void {
	assertIconMaster(genericIconSource, false);
	assertIconMaster(macosLegacyIconSource, true);
	const destination = resolve(repoRoot, generatedIconDirectory);

	withGeneratedIconSets("inherit", (genericDirectory, macosLegacyDirectory) => {
		for (const relativePath of relativeFilesUnder(genericDirectory)) {
			if (relativePath === "icon.icns") {
				continue;
			}
			const output = resolve(destination, relativePath);
			mkdirSync(dirname(output), { recursive: true });
			copyFileSync(resolve(genericDirectory, relativePath), output);
		}
		copyFileSync(
			resolve(macosLegacyDirectory, "icon.icns"),
			resolve(destination, "icon.icns"),
		);
	});
	copyFileSync(
		resolve(repoRoot, genericIconSource),
		resolve(repoRoot, frontendIcon),
	);
	writeFileSync(resolve(repoRoot, iconManifest), iconManifestContents());
	console.log("Synchronized generic icons and the macOS legacy ICNS asset.");
}

function assertFilesEqual(expected: string, actual: string): void {
	if (
		!existsSync(actual) ||
		!readFileSync(expected).equals(readFileSync(actual))
	) {
		throw new Error(
			`Generated icon is stale: ${relative(repoRoot, actual)}. Run just sync-icons.`,
		);
	}
}

function checkIcons(): void {
	assertIconMaster(genericIconSource, false);
	assertIconMaster(macosLegacyIconSource, true);
	const destination = resolve(repoRoot, generatedIconDirectory);

	withGeneratedIconSets("ignore", (genericDirectory, macosLegacyDirectory) => {
		for (const relativePath of relativeFilesUnder(genericDirectory)) {
			if (relativePath !== "icon.icns") {
				assertFilesEqual(
					resolve(genericDirectory, relativePath),
					resolve(destination, relativePath),
				);
			}
		}
		const generatedIcns = readFileSync(
			resolve(macosLegacyDirectory, "icon.icns"),
		);
		const checkedInIcns = readFileSync(resolve(destination, "icon.icns"));
		if (
			generatedIcns.subarray(0, 4).toString("ascii") !== "icns" ||
			checkedInIcns.subarray(0, 4).toString("ascii") !== "icns"
		) {
			throw new Error("The generated macOS icon is not a valid ICNS file.");
		}
	});
	assertFilesEqual(
		resolve(repoRoot, genericIconSource),
		resolve(repoRoot, frontendIcon),
	);
	if (
		readFileSync(resolve(repoRoot, iconManifest), "utf8") !==
		iconManifestContents()
	) {
		throw new Error("Icon source manifest is stale. Run just sync-icons.");
	}
	console.log("Generic and macOS legacy generated icons are up to date.");
}

function filesUnder(directory: string, extensions: Set<string>): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(resolve(repoRoot, directory), {
		withFileTypes: true,
	})) {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) {
			files.push(...filesUnder(path, extensions));
		} else if (
			entry.isFile() &&
			extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))
		) {
			files.push(path);
		}
	}
	return files;
}

function stringsIn(value: unknown): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.flatMap(stringsIn);
	}
	if (value && typeof value === "object") {
		return Object.values(value).flatMap(stringsIn);
	}
	return [];
}

function checkSecurity(): void {
	const appPackage = readJson<JavaScriptPackage>("apps/tauri-app/package.json");
	const dependencies = {
		...appPackage.dependencies,
		...appPackage.devDependencies,
	};
	if ("@tauri-apps/plugin-shell" in dependencies) {
		throw new Error(
			"The frontend must not depend on @tauri-apps/plugin-shell.",
		);
	}

	const capabilityFiles = filesUnder(
		"apps/tauri-app/src-tauri/capabilities",
		new Set([".json"]),
	);
	for (const path of capabilityFiles) {
		const forbidden = stringsIn(readJson<unknown>(path)).filter((value) =>
			/^shell:(?:default|allow-execute|allow-spawn)$/.test(value),
		);
		if (forbidden.length > 0) {
			throw new Error(
				`Frontend shell permission found in ${path}: ${forbidden.join(", ")}`,
			);
		}
	}

	const tauriSources = filesUnder(
		"apps/tauri-app/src-tauri/src",
		new Set([".rs"]),
	);
	const commandNames = tauriSources.flatMap((path) => {
		const source = readFileSync(resolve(repoRoot, path), "utf8");
		return [
			...source.matchAll(
				/#\[tauri::command\]\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/g,
			),
		].map((match) => match[1]);
	});
	if (JSON.stringify(commandNames) !== JSON.stringify(["get_app_info"])) {
		throw new Error(
			`Expected get_app_info to be the only Tauri command, found: ${commandNames.join(", ") || "none"}`,
		);
	}

	const frontendSources = filesUnder(
		"apps/tauri-app/src",
		new Set([".ts", ".tsx"]),
	);
	const invokedCommands = frontendSources.flatMap((path) => {
		const source = readFileSync(resolve(repoRoot, path), "utf8");
		return [
			...source.matchAll(/invoke(?:<[^>]+>)?\(\s*["'`]([^"'`]+)["'`]/g),
		].map((match) => match[1]);
	});
	const unexpectedCommands = invokedCommands.filter(
		(command) => command !== "get_app_info",
	);
	if (unexpectedCommands.length > 0) {
		throw new Error(
			`Unexpected frontend IPC command: ${unexpectedCommands.join(", ")}`,
		);
	}

	const executableSources = [
		...tauriSources,
		...filesUnder("apps/cli/src", new Set([".rs"])),
	];
	const forbiddenPatterns = [
		/\.args?\(\s*["'](?:-c|\/[cC]|-Command)["']\s*\)/,
		/settings\s+(?:put|delete)/,
	];
	for (const path of executableSources) {
		const source = readFileSync(resolve(repoRoot, path), "utf8");
		if (forbiddenPatterns.some((pattern) => pattern.test(source))) {
			throw new Error(
				`Forbidden shell string or settings write found in ${path}.`,
			);
		}
	}

	console.log(
		`Security boundary is valid across ${capabilityFiles.length} capability, ${tauriSources.length} Tauri, and ${frontendSources.length} frontend files.`,
	);
}

function usage(): never {
	console.error(
		"Usage: node scripts/dev-cli.mts docs <sync|check> | icons <sync|check> | version check | security check",
	);
	process.exit(2);
}

const [scope, action, ...extra] = process.argv.slice(2);
if (extra.length > 0) {
	usage();
}
if (scope === "docs" && action === "sync") {
	syncDocs();
} else if (scope === "docs" && action === "check") {
	checkDocs();
} else if (scope === "version" && action === "check") {
	checkVersion();
} else if (scope === "security" && action === "check") {
	checkSecurity();
} else if (scope === "icons" && action === "sync") {
	syncIcons();
} else if (scope === "icons" && action === "check") {
	checkIcons();
} else {
	usage();
}
