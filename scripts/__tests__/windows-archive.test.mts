import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stageCli } from "../lib/release/artifacts.mts";

test("Windows CLI ZIP contains binary, README and LICENSE under literal paths", {
	skip: process.platform !== "win32",
}, () => {
	const directory = mkdtempSync(join(tmpdir(), "acp archive [test] "));
	try {
		const binary = join(directory, "input.exe");
		writeFileSync(binary, "fixture binary, never executed");
		const input = {
			target: "x86_64-pc-windows-msvc",
			binary,
			outputDirectory: join(directory, "output"),
		};
		const archive = stageCli(input);
		assert.equal(readFileSync(archive).subarray(0, 2).toString(), "PK");
		const entries = execFileSync("tar", ["-tf", archive], { encoding: "utf8" })
			.trim()
			.split(/\r?\n/)
			.sort();
		assert.deepEqual(entries, ["LICENSE", "README.md", "acp-fixer.exe"]);
		assert.equal(stageCli(input), archive);
		assert.throws(() =>
			stageCli({ ...input, binary: join(directory, "missing.exe") }),
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
