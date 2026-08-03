import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
	AndroidDevSession,
	adbCandidates,
	DevRebuildQueue,
	type DevRunner,
	isAndroidInput,
	parseDevices,
	parseDevOptions,
	selectDevice,
	validateAdb,
} from "../lib/android-dev.mts";

const listing =
	"List of devices attached\r\nphone unauthorized usb:1\r\nemulator-5554 device product:sdk model:Virtual_Device transport_id:7\r\n";
const device = parseDevices(listing)[0];

test("options use TTY defaults and explicit overrides and reject ambiguity", () => {
	assert.equal(parseDevOptions([], true).interactive, true);
	assert.equal(parseDevOptions([], false).interactive, false);
	assert.equal(parseDevOptions(["--interactive"], false).interactive, true);
	assert.equal(parseDevOptions(["--no-interactive"], true).interactive, false);
	assert.equal(
		parseDevOptions(["--watch", "--device=emulator-5554"], false).watch,
		true,
	);
	assert.throws(() =>
		parseDevOptions(["--interactive", "--no-interactive"], true),
	);
	assert.throws(() => parseDevOptions(["--device="], true));
	assert.throws(() => parseDevOptions(["--unknown"], true));
});

test("emulators sort first; all device states remain visible; malformed and duplicate rows fail closed", () => {
	assert.equal(device.serial, "emulator-5554");
	assert.equal(device.transportId, "7");
	assert.deepEqual(
		parseDevices("a offline\nb no permissions (udev)\nc recovery\n").map(
			(item) => item.state,
		),
		["offline", "no permissions", "recovery"],
	);
	assert.throws(() => parseDevices("broken"));
	assert.throws(() => parseDevices("a device\na device"));
});

test("selection is always explicit and rejects unavailable or stale targets", async () => {
	const question = async () => "1";
	assert.equal(await selectDevice([device], undefined, true, question), device);
	assert.equal(
		await selectDevice([device], device.serial, false, question),
		device,
	);
	await assert.rejects(
		selectDevice([device], undefined, false, question),
		/selection required/,
	);
	await assert.rejects(
		selectDevice([device], "old", false, question),
		/current list/,
	);
	await assert.rejects(
		selectDevice([], undefined, true, question),
		/No running/,
	);
	await assert.rejects(
		selectDevice([device], undefined, true, async () => "q"),
		/cancelled/,
	);
	await assert.rejects(
		selectDevice(parseDevices(listing), "phone", false, question),
		/unauthorized/,
	);
});

test("ADB discovery supports SDK properties and spaces; only validated executables are accepted", async () => {
	const fixture = mkdtempSync(join(tmpdir(), "android-sdk-"));
	try {
		writeFileSync(
			join(fixture, "local.properties"),
			"sdk.dir=/SDK\\ with\\ spaces\n",
		);
		const candidates = adbCandidates(
			fixture,
			{ ANDROID_HOME: "/other-sdk", PATH: "/bin:/bin" },
			"linux",
			"/fake-home",
		);
		assert.equal(candidates[0], "/SDK with spaces/platform-tools/adb");
		assert.equal(candidates.filter((item) => item === "/bin/adb").length, 1);
		const calls: string[][] = [];
		assert.equal(
			await validateAdb(["bad", "/SDK with spaces/adb"], async (file, args) => {
				calls.push([file, ...args]);
				return file === "bad"
					? "Not ADB"
					: "Android Debug Bridge version 1.0.41\n";
			}),
			"/SDK with spaces/adb",
		);
		assert.deepEqual(calls, [
			["bad", "version"],
			["/SDK with spaces/adb", "version"],
		]);
		await assert.rejects(
			validateAdb(["bad"], async () => {
				throw new Error("timeout");
			}),
			/No valid ADB/,
		);
	} finally {
		rmSync(fixture, { recursive: true, force: true });
	}
});

function deployment(
	overrides: {
		build?: () => Promise<void>;
		user?: () => string;
		list?: () => string;
		install?: string;
		launch?: string;
	} = {},
) {
	const calls: string[][] = [];
	const run: DevRunner = async (file, args) => {
		assert.equal(file, "/mock SDK/adb");
		calls.push(args);
		if (args[0] === "devices") {
			return overrides.list?.() ?? listing;
		}
		if (args.includes("get-current-user")) {
			return overrides.user?.() ?? "10\r\n";
		}
		if (args.includes("install")) {
			return overrides.install ?? "Performing Streamed Install\nSuccess\n";
		}
		if (args.includes("start")) {
			return overrides.launch ?? "Status: ok\n";
		}
		throw new Error("Unexpected command");
	};
	const session = new AndroidDevSession(
		"/mock repo",
		"/mock SDK/adb",
		device,
		"com.aitiotekt.webauthndiagnosis",
		run,
		overrides.build ??
			(async () => {
				calls.push(["build"]);
			}),
	);
	return { calls, session };
}

test("build/install/launch pin transport and user and preserve exact argument boundaries", async () => {
	const { session, calls } = deployment();
	await session.deploy();
	const check = [
		["devices", "-l"],
		["-s", "emulator-5554", "shell", "am", "get-current-user"],
	];
	assert.deepEqual(calls, [
		...check,
		["build"],
		...check,
		[
			"-s",
			"emulator-5554",
			"install",
			"--user",
			"10",
			"-r",
			resolve(
				"/mock repo/apps/android-app/app/build/outputs/apk/debug/webauthn-diagnosis-debug.apk",
			),
		],
		...check,
		[
			"-s",
			"emulator-5554",
			"shell",
			"am",
			"start",
			"--user",
			"10",
			"-W",
			"-n",
			"com.aitiotekt.webauthndiagnosis/.MainActivity",
		],
	]);
});

test("build failure, transport drift and user drift prevent installation", async () => {
	for (const cause of ["build", "transport", "user", "invalid-user"]) {
		let built = false;
		const { session, calls } = deployment({
			build: async () => {
				if (cause === "build") {
					throw new Error("compile failed");
				}
				built = true;
			},
			list: () =>
				cause === "transport" && built
					? listing.replace("transport_id:7", "transport_id:8")
					: listing,
			user: () =>
				cause === "invalid-user"
					? "-1"
					: cause === "user" && built
						? "11"
						: "10",
		});
		await assert.rejects(session.deploy());
		assert.equal(
			calls.some((args) => args.includes("install")),
			false,
		);
	}
});

test("installation failure prevents launch and am start textual failures are not successes", async () => {
	const failure = deployment({
		install: "Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]",
	});
	await assert.rejects(failure.session.deploy(), /installation failed/);
	assert.equal(
		failure.calls.some((args) => args.includes("start")),
		false,
	);
	await assert.rejects(
		deployment({ launch: "Error: Activity not started" }).session.deploy(),
		/launch failed/,
	);
});

test("watch filtering excludes build outputs and unrelated Web/desktop sources", () => {
	for (const path of [
		"apps/android-app/app/src/main/App.kt",
		"apps/android-app/app/src/main/res/values/strings.xml",
		"build.gradle.kts",
		"gradle/libs.versions.toml",
		"apps\\android-app\\app\\build.gradle.kts",
	]) {
		assert.equal(isAndroidInput(path), true);
	}
	for (const path of [
		"apps/android-app/app/build/output.apk",
		"apps/tauri-app/src/App.tsx",
		"node_modules/file",
		".gradle/file",
	]) {
		assert.equal(isAndroidInput(path), false);
	}
});

test("watch coalesces edits during builds, recovers after errors and stops on disposal", async () => {
	let count = 0;
	let release = () => {};
	const pending = new Promise<void>((accept) => {
		release = accept;
	});
	const errors: unknown[] = [];
	const queue = new DevRebuildQueue(
		async () => {
			count++;
			if (count === 1) {
				await pending;
				throw new Error("compile error");
			}
		},
		(error) => errors.push(error),
	);
	const work = queue.request();
	await queue.request();
	await queue.request();
	assert.equal(count, 1);
	release();
	await work;
	assert.equal(count, 2);
	assert.equal(errors.length, 1);
	queue[Symbol.dispose]();
	queue[Symbol.dispose]();
	await queue.request();
	assert.equal(count, 2);
});
