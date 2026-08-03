import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");

function createFixture(source: string) {
	const directory = mkdtempSync(join(tmpdir(), "just-dev-"));
	mkdirSync(join(directory, "scripts"));
	writeFileSync(
		join(directory, "justfile"),
		readFileSync(join(root, "justfile")),
	);
	mkdirSync(join(directory, "justfiles"));
	for (const name of [
		"setup",
		"dev",
		"quality",
		"build",
		"test",
		"maintenance",
	]) {
		writeFileSync(
			join(directory, `justfiles/${name}.just`),
			name === "dev" ? readFileSync(join(root, "justfiles/dev.just")) : "",
		);
	}
	// The real development CLI, Cargo, and ADB are never invoked by this fixture.
	writeFileSync(join(directory, "scripts/dev-cli.mts"), source);
	return {
		directory,
		[Symbol.dispose]: () => rmSync(directory, { recursive: true, force: true }),
	};
}

test("development recipe preserves argument boundaries, including empty and shell-special values", () => {
	using fixture = createFixture(
		"console.log(JSON.stringify(process.argv.slice(2)));",
	);
	for (const args of [
		[],
		["--help"],
		[
			"--adb",
			"/SDK with spaces/adb",
			"--device",
			"emulator-5554",
			"",
			'quote"value',
			"single'value",
			"$HOME",
			"$(echo unexpected)",
			"a;b&c|d",
			"*.apk",
			"C:\\SDK with spaces\\",
		],
	]) {
		const result = spawnSync("just", ["dev-android", ...args], {
			cwd: fixture.directory,
			encoding: "utf8",
			timeout: 10000,
		});
		assert.ifError(result.error);
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(JSON.parse(result.stdout), ["android", "dev", ...args]);
	}
});

test("development recipe preserves stdin, stdout, stderr, and a nonzero native exit code", () => {
	using fixture = createFixture(`
import { readFileSync, writeSync } from "node:fs";
writeSync(1, readFileSync(0));
writeSync(2, "diagnostic output\\n");
process.exitCode = 37;
`);
	const input = `${"stream output\n".repeat(10000)}last line\n`;
	const result = spawnSync("just", ["dev-android"], {
		cwd: fixture.directory,
		input,
		encoding: "utf8",
		maxBuffer: 1024 * 1024,
		timeout: 10000,
	});
	assert.ifError(result.error);
	assert.equal(result.status, 37, result.stderr);
	assert.equal(result.stdout, input);
	assert.match(result.stderr, /diagnostic output/);
});

test("Unix development process receives terminal-group SIGINT and flushes its shutdown output", {
	skip: process.platform === "win32",
	timeout: 10000,
}, async () => {
	using fixture = createFixture(`
import { writeSync } from "node:fs";
process.on("SIGINT", () => {
  writeSync(1, "shutdown complete\\n");
  process.exit(130);
});
writeSync(1, "ready\\n");
setInterval(() => {}, 1000);
`);
	const child = spawn("just", ["dev-android"], {
		cwd: fixture.directory,
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const closed = once(child, "close");
	let output = "";
	child.stdout.on("data", (chunk) => {
		output += chunk;
	});
	child.stderr.resume();
	try {
		await once(child.stdout, "data", { signal: AbortSignal.timeout(5000) });
		assert.match(output, /ready/);
		assert.ok(child.pid);
		process.kill(-child.pid, "SIGINT");
		await closed;
		assert.match(output, /shutdown complete/);
	} finally {
		if (child.pid) {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch (error) {
				assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
			}
		}
		await closed;
	}
});
