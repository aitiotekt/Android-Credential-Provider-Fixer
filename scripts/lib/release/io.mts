import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type OutputFormat = "human" | "json" | "github-output";

export function parseFormat(value: string | undefined): OutputFormat {
	if (value === undefined) {
		return "human";
	}
	if (value === "human" || value === "json" || value === "github-output") {
		return value;
	}
	throw new Error(`Unsupported output format: ${value}.`);
}

function scalar(value: unknown): string {
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	return JSON.stringify(value);
}

export function emitResult(
	result: Record<string, unknown>,
	format: OutputFormat,
	message: string,
): void {
	if (format === "json") {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	if (format === "github-output") {
		const output = process.env.GITHUB_OUTPUT;
		if (!output) {
			throw new Error("GITHUB_OUTPUT is not set.");
		}
		for (const [key, value] of Object.entries(result)) {
			appendFileSync(output, `${key}=${scalar(value)}\n`);
		}
		return;
	}
	console.log(message);
}

export function writeJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function optionsFrom(arguments_: string[]): Map<string, string | true> {
	const options = new Map<string, string | true>();
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (!argument.startsWith("--")) {
			throw new Error(`Unexpected positional argument: ${argument}.`);
		}
		const equals = argument.indexOf("=");
		if (equals !== -1) {
			options.set(argument.slice(2, equals), argument.slice(equals + 1));
			continue;
		}
		const key = argument.slice(2);
		const next = arguments_[index + 1];
		if (next && !next.startsWith("--")) {
			options.set(key, next);
			index += 1;
		} else {
			options.set(key, true);
		}
	}
	return options;
}

export function requiredOption(
	options: Map<string, string | true>,
	key: string,
): string {
	const value = options.get(key);
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`Missing required --${key}.`);
	}
	return value;
}
