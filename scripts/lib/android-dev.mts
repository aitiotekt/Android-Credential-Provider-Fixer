import { execFile } from "node:child_process";
import { existsSync, readFileSync, watch } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
	checkAndroidVersion,
	loadAndroidMetadata,
} from "./release/android.mts";

export const androidDevHelp = `Usage: just dev-android [--device SERIAL] [--adb PATH] [--interactive | --no-interactive] [--watch]

Build, replace-install and launch this repository's debug app on an explicitly selected running device.
With no --device, both stdin and stdout must be terminals (or use --interactive).
Start your emulator in Android Studio first. No device is selected automatically.
--watch rebuilds and redeploys after edits; it is NOT state-preserving hot reload.
Use Android Studio Live Edit / Apply Changes for supported in-place updates.
No uninstall, data clearing, settings changes, emulator or ADB server management.`;

export function parseDevOptions(args: string[], tty: boolean) {
	const { values } = parseArgs({
		args,
		options: {
			device: { type: "string" },
			adb: { type: "string" },
			interactive: { type: "boolean" },
			"no-interactive": { type: "boolean" },
			watch: { type: "boolean", default: false },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.interactive && values["no-interactive"]) {
		throw new Error("--interactive conflicts with --no-interactive.");
	}
	for (const key of ["device", "adb"] as const) {
		if (values[key] !== undefined && !values[key]?.trim()) {
			throw new Error(`--${key} cannot be empty.`);
		}
	}
	return {
		...values,
		interactive: values.interactive || (!values["no-interactive"] && tty),
	};
}

export type DevDevice = {
	serial: string;
	state: string;
	details: string;
	transportId?: string;
};
export type DevRunner = (
	file: string,
	args: string[],
	timeout?: number,
) => Promise<string>;

export function parseDevices(output: string): DevDevice[] {
	const devices: DevDevice[] = [];
	for (const line of output.split(/\r?\n/)) {
		if (
			!line.trim() ||
			line.startsWith("List of devices") ||
			line.startsWith("*")
		) {
			continue;
		}
		const match = /^(\S+)\s+(no permissions|\S+)(.*)$/.exec(line);
		if (!match || devices.some((item) => item.serial === match[1])) {
			throw new Error("Invalid or duplicate entry in ADB device list.");
		}
		devices.push({
			serial: match[1],
			state: match[2],
			details: match[3].trim(),
			transportId: /\btransport_id:(\d+)\b/.exec(match[3])?.[1],
		});
	}
	return devices.sort(
		(a, b) =>
			Number(b.serial.startsWith("emulator-")) -
			Number(a.serial.startsWith("emulator-")),
	);
}

export async function selectDevice(
	devices: DevDevice[],
	serial: string | undefined,
	interactive: boolean,
	question: (prompt: string) => Promise<string>,
): Promise<DevDevice> {
	if (!devices.length) {
		throw new Error(
			"No running devices. Start an emulator in Android Studio, then retry.",
		);
	}
	if (!serial) {
		if (!interactive) {
			throw new Error(
				"Device selection required: pass --device SERIAL (even for one device).",
			);
		}
		const answer = (
			await question("Install debug app on device number (q to cancel): ")
		).trim();
		if (!/^[1-9]\d*$/.test(answer)) {
			throw new Error("Device selection cancelled or invalid.");
		}
		serial = devices[Number(answer) - 1]?.serial;
	}
	const device = devices.find((item) => item.serial === serial);
	if (!device) {
		throw new Error("The selected device is not in the current list.");
	}
	if (device.state !== "device") {
		throw new Error(
			`Device ${device.serial} is ${device.state}; no installation attempted.`,
		);
	}
	return device;
}

export function adbCandidates(
	root: string,
	env: NodeJS.ProcessEnv,
	platform: NodeJS.Platform,
	home: string,
): string[] {
	const binary = platform === "win32" ? "adb.exe" : "adb";
	const properties = join(root, "local.properties");
	const sdk = existsSync(properties)
		? /^sdk\.dir\s*=\s*(.*)$/m
				.exec(readFileSync(properties, "utf8"))?.[1]
				?.trim()
				.replace(/\\([\\: =])/g, "$1")
		: undefined;
	const sdkRoots = [
		sdk && resolve(root, sdk),
		env.ANDROID_HOME,
		env.ANDROID_SDK_ROOT,
		platform === "darwin"
			? join(home, "Library/Android/sdk")
			: platform === "win32"
				? env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Android/Sdk")
				: join(home, "Android/Sdk"),
	];
	return [
		...new Set([
			...sdkRoots
				.filter((path): path is string => !!path)
				.map((path) => join(path, "platform-tools", binary)),
			...(env.PATH ?? "")
				.split(platform === "win32" ? ";" : delimiter)
				.filter(Boolean)
				.map((path) => join(path, binary)),
		]),
	];
}

export async function validateAdb(
	candidates: string[],
	run: DevRunner,
): Promise<string> {
	for (const candidate of candidates) {
		try {
			if (
				/^Android Debug Bridge version \d+\.\d+\.\d+/m.test(
					await run(candidate, ["version"]),
				)
			) {
				return candidate;
			}
		} catch {
			/* Invalid candidates cannot become the deployment executable. */
		}
	}
	throw new Error(
		"No valid ADB found. Configure local.properties / ANDROID_HOME, or pass --adb PATH.",
	);
}

function parseUser(output: string): string {
	const value = output.trim();
	if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
		throw new Error("Invalid foreground Android user.");
	}
	return String(Number(value));
}

// Keep the selected transport and user pinned across slow builds and watch cycles.
export class AndroidDevSession {
	private user: string | undefined;
	private readonly root: string;
	private readonly adb: string;
	private readonly device: DevDevice;
	private readonly applicationId: string;
	private readonly run: DevRunner;
	private readonly build: () => Promise<void>;
	constructor(
		root: string,
		adb: string,
		device: DevDevice,
		applicationId: string,
		run: DevRunner,
		build: () => Promise<void>,
	) {
		this.root = root;
		this.adb = adb;
		this.device = device;
		this.applicationId = applicationId;
		this.run = run;
		this.build = build;
	}

	private async checkContext(): Promise<string> {
		const current = parseDevices(
			await this.run(this.adb, ["devices", "-l"]),
		).find((item) => item.serial === this.device.serial);
		if (
			current?.state !== "device" ||
			current.transportId !== this.device.transportId
		) {
			throw new Error(
				"Selected device disconnected or changed. Stop and explicitly select it again.",
			);
		}
		const user = parseUser(
			await this.run(this.adb, [
				"-s",
				this.device.serial,
				"shell",
				"am",
				"get-current-user",
			]),
		);
		if (this.user !== undefined && user !== this.user) {
			throw new Error(
				"Foreground user changed. Stop and explicitly select the device again.",
			);
		}
		this.user = user;
		return user;
	}

	async deploy(): Promise<void> {
		await this.checkContext();
		await this.build();
		const user = await this.checkContext();
		const apk = resolve(
			this.root,
			"apps/android-app/app/build/outputs/apk/debug/webauthn-diagnosis-debug.apk",
		);
		const installed = await this.run(
			this.adb,
			["-s", this.device.serial, "install", "--user", user, "-r", apk],
			120_000,
		);
		if (!/^Success\s*$/m.test(installed)) {
			throw new Error(`Debug installation failed: ${installed.trim()}`);
		}
		await this.checkContext();
		const launched = await this.run(this.adb, [
			"-s",
			this.device.serial,
			"shell",
			"am",
			"start",
			"--user",
			user,
			"-W",
			"-n",
			`${this.applicationId}/.MainActivity`,
		]);
		if (!/^Status:\s*ok\s*$/m.test(launched) || /^Error:/m.test(launched)) {
			throw new Error(`App launch failed: ${launched.trim()}`);
		}
	}
}

export function isAndroidInput(path: string): boolean {
	const normalized = path.replaceAll("\\", "/");
	return (
		normalized.startsWith("apps/android-app/app/src/") ||
		[
			"build.gradle.kts",
			"settings.gradle.kts",
			"gradle.properties",
			"local.properties",
			"acp-fixer-metadata.toml",
			"apps/android-app/metadata.properties",
			"apps/android-app/app/build.gradle.kts",
			"apps/android-app/app/proguard-rules.pro",
		].includes(normalized) ||
		normalized.startsWith("gradle/")
	);
}

// Revision coalescing ensures edits made during a build trigger one later build.
export class DevRebuildQueue {
	private running = false;
	private pending = false;
	private stopped = false;
	private readonly deploy: () => Promise<void>;
	private readonly onError: (error: unknown) => void;
	constructor(deploy: () => Promise<void>, onError: (error: unknown) => void) {
		this.deploy = deploy;
		this.onError = onError;
	}
	async request(): Promise<void> {
		if (this.stopped) {
			return;
		}
		this.pending = true;
		if (this.running) {
			return;
		}
		this.running = true;
		try {
			while (this.pending && !this.stopped) {
				this.pending = false;
				try {
					await this.deploy();
				} catch (error) {
					this.onError(error);
				}
			}
		} finally {
			this.running = false;
		}
	}
	[Symbol.dispose](): void {
		this.stopped = true;
		this.pending = false;
	}
}

export async function runAndroidDev(
	root: string,
	args: string[],
): Promise<void> {
	const options = parseDevOptions(
		args,
		!!process.stdin.isTTY && !!process.stdout.isTTY,
	);
	if (options.help) {
		console.log(androidDevHelp);
		return;
	}
	checkAndroidVersion();
	const abort = new AbortController();
	const stop = () => abort.abort();
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	const run: DevRunner = (file, arguments_, timeout = 30_000) =>
		new Promise((accept, reject) => {
			execFile(
				file,
				arguments_,
				{
					cwd: root,
					signal: abort.signal,
					timeout,
					maxBuffer: 8 * 1024 * 1024,
					encoding: "utf8",
					windowsHide: true,
				},
				(error, stdout, stderr) => {
					if (error) {
						reject(
							new Error(`${file}: ${error.message}\n${stderr}\n${stdout}`),
						);
					} else {
						accept(stdout);
					}
				},
			);
		});
	try {
		const adb = await validateAdb(
			options.adb
				? [resolve(options.adb)]
				: adbCandidates(root, process.env, process.platform, homedir()),
			run,
		);
		console.log(`ADB: ${adb}`);
		const devices = parseDevices(await run(adb, ["devices", "-l"]));
		for (const [index, device] of devices.entries()) {
			console.log(
				`${index + 1}. ${device.serial} [${device.state}] ${device.details}`,
			);
		}
		const device = await selectDevice(
			devices,
			options.device,
			options.interactive,
			async (prompt) => {
				const reader = createInterface({
					input: process.stdin,
					output: process.stdout,
				});
				try {
					return await reader.question(prompt, { signal: abort.signal });
				} finally {
					reader.close();
				}
			},
		);
		const session = new AndroidDevSession(
			root,
			adb,
			device,
			loadAndroidMetadata().identifier,
			run,
			async () => {
				checkAndroidVersion();
				console.log(`Building debug app for ${device.serial}…`);
				// Invoke the checked-in Wrapper via Java on every OS: .bat execution would require a shell on Windows.
				const java = process.env.JAVA_HOME
					? join(
							process.env.JAVA_HOME,
							"bin",
							process.platform === "win32" ? "java.exe" : "java",
						)
					: "java";
				console.log(
					await run(
						java,
						[
							"-Xmx64m",
							"-Xms64m",
							"-classpath",
							join(root, "gradle/wrapper/gradle-wrapper.jar"),
							"org.gradle.wrapper.GradleWrapperMain",
							":webauthn-diagnosis:assembleDebug",
							"--console=plain",
						],
						600_000,
					),
				);
			},
		);
		const deploy = async () => {
			await session.deploy();
			console.log(`Debug app installed and launched on ${device.serial}.`);
		};
		if (!options.watch) {
			await deploy();
			return;
		}
		console.log(
			"Watching Android inputs. Changes rebuild, replace-install and restart; runtime state is not preserved. Ctrl+C stops watching.",
		);
		using queue = new DevRebuildQueue(deploy, (error) => {
			if (!abort.signal.aborted) {
				console.error(error);
			}
		});
		const watchers: ReturnType<typeof watch>[] = [];
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			for (const [directory, recursive] of [
				["", false],
				["apps/android-app", false],
				["apps/android-app/app", false],
				["apps/android-app/app/src", true],
				["gradle", true],
			] as const) {
				const watcher = watch(
					join(root, directory),
					{ recursive },
					(_event, filename) => {
						if (
							!filename ||
							!isAndroidInput(directory ? `${directory}/${filename}` : filename)
						) {
							return;
						}
						clearTimeout(timer);
						timer = setTimeout(() => {
							void queue.request();
						}, 400);
					},
				);
				watcher.on("error", (error) => {
					console.error(error);
					stop();
				});
				watchers.push(watcher);
			}
			const stopped = new Promise<void>((accept) => {
				if (abort.signal.aborted) {
					accept();
				} else {
					abort.signal.addEventListener("abort", () => accept(), {
						once: true,
					});
				}
			});
			await queue.request();
			await stopped;
		} finally {
			clearTimeout(timer);
			for (const watcher of watchers) {
				watcher.close();
			}
		}
	} catch (error) {
		if (!abort.signal.aborted) {
			throw error;
		}
	} finally {
		process.removeListener("SIGINT", stop);
		process.removeListener("SIGTERM", stop);
		if (abort.signal.aborted) {
			process.exitCode = 130;
		}
	}
}
