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
const expectedVersion = "0.1.0-alpha.5";
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
	"CHANGELOG.md",
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
	{ link: "docsite/changelog.md", target: "CHANGELOG.md", type: "file" },
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
	{
		link: "docsite/zh/changelog.md",
		target: "docs/zh/CHANGELOG.md",
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
		/^(?:README|SECURITY|PRIVACY|CONTRIBUTING|CHANGELOG)\.[^.]+\.md$/i.test(
			name,
		),
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

function fileSha256(relativePath: string): string {
	return createHash("sha256")
		.update(readFileSync(resolve(repoRoot, relativePath)))
		.digest("hex");
}

function generatedIconHashes(): Record<string, string> {
	const hashes: Record<string, string> = {};
	for (const relativePath of relativeFilesUnder(
		resolve(repoRoot, generatedIconDirectory),
	)) {
		if (relativePath === ".sources.json") {
			continue;
		}
		hashes[relativePath] = fileSha256(
			`${generatedIconDirectory}/${relativePath}`,
		);
	}
	return hashes;
}

function iconManifestContents(): string {
	const appPackage = readJson<JavaScriptPackage>("apps/tauri-app/package.json");
	const cliVersion = appPackage.devDependencies?.["@tauri-apps/cli"];
	if (!cliVersion) {
		throw new Error("@tauri-apps/cli version is missing from the app package.");
	}
	// Hash checked-in outputs instead of regenerating during check: `tauri icon`
	// PNG bytes are not stable across Linux/macOS hosts.
	return `${JSON.stringify(
		{
			genericSource: {
				path: genericIconSource,
				sha256: fileSha256(genericIconSource),
			},
			macosLegacySource: {
				path: macosLegacyIconSource,
				sha256: fileSha256(macosLegacyIconSource),
			},
			frontendIcon: {
				path: frontendIcon,
				sha256: fileSha256(frontendIcon),
			},
			tauriCliVersion: cliVersion,
			generated: generatedIconHashes(),
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

function checkIcons(): void {
	assertIconMaster(genericIconSource, false);
	assertIconMaster(macosLegacyIconSource, true);
	const checkedInIcns = readFileSync(
		resolve(repoRoot, `${generatedIconDirectory}/icon.icns`),
	);
	if (checkedInIcns.subarray(0, 4).toString("ascii") !== "icns") {
		throw new Error("The generated macOS icon is not a valid ICNS file.");
	}
	if (
		!existsSync(resolve(repoRoot, frontendIcon)) ||
		!readFileSync(resolve(repoRoot, genericIconSource)).equals(
			readFileSync(resolve(repoRoot, frontendIcon)),
		)
	) {
		throw new Error(
			`Generated icon is stale: ${frontendIcon}. Run just sync-icons.`,
		);
	}
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
	const forbiddenFrontendPlugins = [
		"@tauri-apps/plugin-shell",
		"@tauri-apps/plugin-dialog",
		"@tauri-apps/plugin-fs",
	];
	const installedForbiddenPlugins = forbiddenFrontendPlugins.filter(
		(name) => name in dependencies,
	);
	if (installedForbiddenPlugins.length > 0) {
		throw new Error(
			`The frontend must not depend on privileged Tauri plugins: ${installedForbiddenPlugins.join(", ")}.`,
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
	const expectedCommands = [
		"authorize_pin_preview",
		"cancel_change_plan",
		"choose_adb_executable",
		"create_pin_plan",
		"create_restore_plan",
		"discover_adb",
		"execute_pin_plan",
		"execute_restore_plan",
		"get_app_info",
		"get_demo_fixture",
		"get_session_context",
		"get_startup_state",
		"list_devices",
		"list_snapshots",
		"prepare_pin",
		"prepare_restore",
		"resolve_diagnosis",
		"select_adb_candidate",
		"set_onboarding_status",
		"set_theme_preference",
	].sort();
	commandNames.sort();
	if (JSON.stringify(commandNames) !== JSON.stringify(expectedCommands)) {
		throw new Error(
			`Unexpected Tauri command surface: ${commandNames.join(", ") || "none"}`,
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
		(command) => !expectedCommands.includes(command),
	);
	if (unexpectedCommands.length > 0) {
		throw new Error(
			`Unexpected frontend IPC command: ${unexpectedCommands.join(", ")}`,
		);
	}

	const executableSources = [
		...tauriSources,
		...filesUnder("apps/cli/src", new Set([".rs"])),
		...filesUnder("packages/core/src", new Set([".rs"])),
	];
	const universallyForbiddenPatterns = [
		/\.args?\(\s*["'](?:-c|\/[cC]|-Command)["']\s*\)/,
		/["'](?:kill-server|start-server|force-stop)["']/,
	];
	const settingsWritePatterns = [
		/settings\s+(?:put|delete)/,
		/["']settings["'][\s\S]{0,300}["'](?:put|delete)["']/,
	];
	for (const path of executableSources) {
		const source = readFileSync(resolve(repoRoot, path), "utf8");
		if (universallyForbiddenPatterns.some((pattern) => pattern.test(source))) {
			throw new Error(
				`Forbidden shell or ADB server command found in ${path}.`,
			);
		}
		const hasSettingsWrite = settingsWritePatterns.some((pattern) =>
			pattern.test(source),
		);
		if (hasSettingsWrite && path !== "packages/core/src/changes.rs") {
			throw new Error(
				`Settings write found outside the bounded Core writer: ${path}.`,
			);
		}
	}
	const writer = readFileSync(
		resolve(repoRoot, "packages/core/src/changes.rs"),
		"utf8",
	);
	for (const required of [
		'const ENABLED_KEY: &str = "credential_service"',
		'const PRIMARY_KEY: &str = "credential_service_primary"',
		"debug_assert!(matches!(key, ENABLED_KEY | PRIMARY_KEY))",
	]) {
		if (!writer.includes(required)) {
			throw new Error(
				`Bounded settings writer invariant is missing: ${required}`,
			);
		}
	}

	console.log(
		`Security boundary is valid across ${capabilityFiles.length} capability, ${tauriSources.length} Tauri, and ${frontendSources.length} frontend files.`,
	);
}

function checkArchitecture(): void {
	const appPackage = readJson<{
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	}>("apps/tauri-app/package.json");
	const dependencies = appPackage.dependencies ?? {};
	const devDependencies = appPackage.devDependencies ?? {};
	if (dependencies["core-js"] !== "3.50.0") {
		throw new Error(
			"The frontend must pin core-js 3.50.0 for its explicit resource management polyfills.",
		);
	}
	for (const [dependency, expected] of [
		["@swc/core", "1.16.1"],
		["unplugin-swc", "1.5.11"],
	] as const) {
		if (devDependencies[dependency] !== expected) {
			throw new Error(
				`The frontend must pin ${dependency} ${expected} for its compatibility transform.`,
			);
		}
	}
	for (const forbidden of [
		"reflect-metadata",
		"@ark-ui/solid",
		"@park-ui/solid",
		"@pandacss/dev",
	]) {
		if (forbidden in dependencies) {
			throw new Error(
				`Forbidden frontend architecture dependency: ${forbidden}`,
			);
		}
	}

	const viteConfig = readFileSync(
		resolve(repoRoot, "apps/tauri-app/vite.config.ts"),
		"utf8",
	);
	const vitestConfig = readFileSync(
		resolve(repoRoot, "apps/tauri-app/vitest.config.ts"),
		"utf8",
	);
	const targetModule = readFileSync(
		resolve(repoRoot, "apps/tauri-app/config/webview-targets.ts"),
		"utf8",
	);
	const swcModule = readFileSync(
		resolve(repoRoot, "apps/tauri-app/config/swc-compat.ts"),
		"utf8",
	);
	for (const target of ['chrome: "111"', 'edge: "111"', 'safari: "16.4"']) {
		if (!targetModule.includes(target)) {
			throw new Error(`Shared WebView engine target is missing ${target}.`);
		}
	}
	if (targetModule.includes('"es2022"')) {
		throw new Error(
			"Do not mix an ECMAScript edition into the concrete WebView engine targets.",
		);
	}
	for (const [path, source] of [
		["apps/tauri-app/vite.config.ts", viteConfig],
		["apps/tauri-app/vitest.config.ts", vitestConfig],
	] as const) {
		if (!source.includes('from "./config/swc-compat.ts"')) {
			throw new Error(`The shared SWC transform is not used by ${path}.`);
		}
		if (!source.includes("createSwcCompatPlugin()")) {
			throw new Error(
				`The SWC compatibility plugin is not registered by ${path}.`,
			);
		}
		if (/\boxc\s*:/.test(source)) {
			throw new Error(
				`Do not configure Vite's source Oxc transform alongside unplugin-swc: ${path}`,
			);
		}
	}
	if (!/build:\s*\{\s*target:\s*WEBVIEW_TARGETS/s.test(viteConfig)) {
		throw new Error("Vite build does not use the shared WebView target.");
	}
	if (!viteConfig.includes('from "./config/webview-targets.ts"')) {
		throw new Error("Vite build does not import the shared WebView target.");
	}
	for (const required of [
		'import { WEBVIEW_SWC_TARGETS } from "./webview-targets.ts"',
		"explicitResourceManagement: true",
		"targets: WEBVIEW_SWC_TARGETS",
		'mode: "usage"',
		'coreJs: "3.50"',
		"shippedProposals: true",
	]) {
		if (!swcModule.includes(required)) {
			throw new Error(
				`The shared SWC compatibility config is missing: ${required}`,
			);
		}
	}
	for (const required of [
		"export const WEBVIEW_SWC_TARGETS = WEBVIEW_ENGINE_TARGETS",
		"Object.entries(WEBVIEW_ENGINE_TARGETS)",
	]) {
		if (!targetModule.includes(required)) {
			throw new Error(
				`WebView targets must derive Vite and SWC forms from one engine map: ${required}`,
			);
		}
	}
	if (/generatedCode\s*:/.test(viteConfig)) {
		throw new Error(
			"Vite already sets Rolldown generatedCode to ES2015; do not duplicate it.",
		);
	}
	if (
		/rolldownOptions\s*:\s*\{[\s\S]*?transform\s*:\s*\{[\s\S]*?target\s*:/m.test(
			viteConfig,
		)
	) {
		throw new Error(
			"Do not bypass Vite's final build target through rolldownOptions.transform.target.",
		);
	}
	const mainSource = readFileSync(
		resolve(repoRoot, "apps/tauri-app/src/main.tsx"),
		"utf8",
	);
	if (mainSource.includes("explicit-resource-management")) {
		throw new Error(
			"Explicit resource management polyfills must be injected by SWC usage analysis, not a manual application entry.",
		);
	}

	const frontendSources = filesUnder(
		"apps/tauri-app/src",
		new Set([".ts", ".tsx"]),
	);
	for (const path of frontendSources) {
		const source = readFileSync(resolve(repoRoot, path), "utf8");
		if (
			!path.includes("/__tests__/") &&
			/from\s+["'](?:vite|vitest|unplugin-swc|@swc\/core)["']/.test(source)
		) {
			throw new Error(
				`Build and test tooling must stay outside bundled application source: ${path}`,
			);
		}
		if (/\.test\.tsx?$/.test(path) && !path.includes("/__tests__/")) {
			throw new Error(
				`Frontend unit tests must live in a module-level __tests__ directory: ${path}`,
			);
		}
		if (
			(path.startsWith("apps/tauri-app/src/domain/") ||
				path.startsWith("apps/tauri-app/src/application/")) &&
			(/export\s+function\s+create\w*Service\b/.test(source) ||
				/export\s+interface\s+\w*Service\b/.test(source))
		) {
			throw new Error(
				`Stateful application services must use a class, not a closure factory/interface pair: ${path}`,
			);
		}
		if (/\brunInInjectionContext\b|\binject\s*\(/.test(source)) {
			throw new Error(`Ambient injection context is forbidden: ${path}`);
		}
		if (/\bDomainEventBus\b|\bDOMAIN_EVENT_BUS\b/.test(source)) {
			throw new Error(`Shared frontend event buses are forbidden: ${path}`);
		}
		if (
			path !== "apps/tauri-app/src/domain/event.ts" &&
			/import\s*\{[^}]*\bSubject\b[^}]*\}\s*from\s*["']rxjs["']/.test(source)
		) {
			throw new Error(
				`RxJS Subject construction is restricted to the DomainEvent extension: ${path}`,
			);
		}
		if (
			!path.includes("/__tests__/") &&
			/^\s*(?:public\s+|private\s+|protected\s+)?dispose\s*\(/m.test(source)
		) {
			throw new Error(
				`Owned frontend resources must expose Symbol.dispose instead of an ad-hoc dispose method: ${path}`,
			);
		}
		if (
			/\bresources\s*(?::\s*DisposableStack|=\s*new\s+DisposableStack|=\s*\w+\.move\(\))/.test(
				source,
			)
		) {
			throw new Error(
				`DisposableStack variables must use a singular stack-specific name; resources is reserved for EntityResource state: ${path}`,
			);
		}
		if (
			source.includes("ReflectiveInjector") &&
			path !== "apps/tauri-app/src/di/providers.ts"
		) {
			throw new Error(
				`ReflectiveInjector is restricted to DI bootstrap: ${path}`,
			);
		}
		if (/\bsetStep\s*\(/.test(source)) {
			throw new Error(`Independent workflow navigation is forbidden: ${path}`);
		}
		if (/^\s*@(?:Injectable|Inject|Optional|Self|SkipSelf)\b/m.test(source)) {
			throw new Error(
				`Decorator-based dependency injection is forbidden: ${path}`,
			);
		}
		if (
			path !== "apps/tauri-app/src/infrastructure/tauri-gateway.ts" &&
			(/from\s+["']@tauri-apps\/api\/core["']/.test(source) ||
				/\binvoke\s*\(/.test(source))
		) {
			throw new Error(`Tauri invoke leaked outside the gateway: ${path}`);
		}
		if (
			path.startsWith("apps/tauri-app/src/views/") &&
			(/from\s+["'][^"']*infrastructure\//.test(source) ||
				/\bcreateSignal\s*\(/.test(source))
		) {
			throw new Error(`A view owns infrastructure or domain signals: ${path}`);
		}
		if (
			(path.startsWith("apps/tauri-app/src/views/") ||
				path.startsWith("apps/tauri-app/src/app/")) &&
			(/from\s+["']rxjs["']/.test(source) ||
				/from\s+["'][^"']*domain\/event["']/.test(source) ||
				/\.subscribe\s*\(/.test(source))
		) {
			throw new Error(
				`Rendering code must consume state or snapshots instead of domain events: ${path}`,
			);
		}
	}
	console.log(
		`Frontend architecture boundary is valid across ${frontendSources.length} source files.`,
	);
}

function usage(): never {
	console.error(
		"Usage: node scripts/dev-cli.mts docs <sync|check> | icons <sync|check> | version check | security check | architecture check",
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
} else if (scope === "architecture" && action === "check") {
	checkArchitecture();
} else if (scope === "icons" && action === "sync") {
	syncIcons();
} else if (scope === "icons" && action === "check") {
	checkIcons();
} else {
	usage();
}
