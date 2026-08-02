import { cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib/release/metadata.mts";

export function assembleWeb(docs: string, app: string, parent: string): string {
	if (
		!existsSync(resolve(docs, "index.html")) ||
		!existsSync(resolve(app, "index.html"))
	) {
		throw new Error("Build both Web sites before assembling Pages");
	}
	if (existsSync(resolve(docs, "webauthn"))) {
		throw new Error("VitePress must not own the /webauthn/ namespace");
	}
	mkdirSync(parent, { recursive: true });
	const destination = mkdtempSync(resolve(parent, "pages-"));
	cpSync(docs, destination, { recursive: true });
	cpSync(app, resolve(destination, "webauthn"), { recursive: true });
	return destination;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
	const path = assembleWeb(
		resolve(REPO_ROOT, "docsite/.vitepress/dist"),
		resolve(REPO_ROOT, "apps/webauthn-web/dist"),
		resolve(REPO_ROOT, "temp/web"),
	);
	const { emitResult } = await import("./lib/release/io.mts");
	emitResult(
		{ path },
		process.env.GITHUB_OUTPUT ? "github-output" : "json",
		path,
	);
}
