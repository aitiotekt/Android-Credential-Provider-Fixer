import { render } from "@solidjs/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translations } from "../i18n/translations";
import {
	type AdbDiscovery,
	type DiagnosisReport,
	type ProviderChoice,
	type ValidatedAdb,
} from "../lib/tauri";
import { adbOptions, isCurrentSoleProvider, ReportPanel } from "./App";

const adb: ValidatedAdb = {
	path: "/sdk/platform-tools/adb",
	resolvedPath: "/real/sdk/platform-tools/adb",
	version: "Android Debug Bridge version 1.0.41",
};

const provider: ProviderChoice = {
	providerId: "provider-1-0",
	component: {
		flattened: "com.example/.Provider",
		packageName: "com.example",
		serviceClass: ".Provider",
	},
	enabled: true,
	primary: true,
	samePackageAsAutofill: false,
};

const fullProvider = {
	flattened: "com.example/com.example.Provider",
	packageName: "com.example",
	serviceClass: "com.example.Provider",
};

function diagnosis(
	enabledComponents: DiagnosisReport["providers"][number]["component"][] | null,
	primaryComponents: DiagnosisReport["providers"][number]["component"][] | null,
): DiagnosisReport {
	return {
		schemaVersion: 1,
		mode: "real",
		status: "complete",
		observedAtUnixMs: 1,
		adb,
		device: {
			serial: "SERIAL",
			connectionType: "usb",
			manufacturer: "Example",
			model: "Phone",
			codename: "phone",
			androidVersion: "14",
			apiLevel: 34,
		},
		androidUser: { id: 0, isForeground: true },
		providers: [provider],
		credentialState: {
			enabled: {
				key: "credential_service",
				value: {
					kind: "value",
					raw: "enabled",
					components: enabledComponents,
				},
			},
			primary: {
				key: "credential_service_primary",
				value: {
					kind: "value",
					raw: "primary",
					components: primaryComponents,
				},
			},
			autofill: { key: "autofill_service", value: { kind: "missing" } },
		},
		findings: [],
	};
}

describe("ADB option presentation", () => {
	it("reuses a discovered candidate when the resolved path is selected", () => {
		const discovery: AdbDiscovery = {
			schemaVersion: 1,
			candidates: [
				{
					candidateId: "adb-1-0",
					source: "path",
					adb: { ...adb, path: "/usr/local/bin/adb" },
				},
			],
			failures: [],
		};

		const options = adbOptions(discovery, adb);
		expect(options).toHaveLength(1);
		expect(options[0]).toMatchObject({
			adb,
			selected: true,
			source: "path",
		});
	});

	it("prepends an unmatched saved or manually selected executable", () => {
		const candidate = {
			path: "/other/adb",
			resolvedPath: "/real/other/adb",
			version: adb.version,
		};
		const discovery: AdbDiscovery = {
			schemaVersion: 1,
			candidates: [
				{ candidateId: "adb-1-0", source: "commonLocation", adb: candidate },
			],
			failures: [],
		};

		const options = adbOptions(discovery, adb);
		expect(options.map((option) => option.adb)).toEqual([adb, candidate]);
		expect(options[0]?.selected).toBe(true);
		expect(options[0]?.source).toBeUndefined();
	});

	it("deduplicates candidates by resolved executable path", () => {
		const discovery: AdbDiscovery = {
			schemaVersion: 1,
			candidates: [
				{ candidateId: "adb-1-0", source: "path", adb },
				{
					candidateId: "adb-1-1",
					source: "commonLocation",
					adb: { ...adb, path: "/alias/adb" },
				},
			],
			failures: [],
		};

		expect(adbOptions(discovery, undefined)).toHaveLength(1);
		expect(adbOptions(undefined, adb)).toEqual([
			{
				key: `selected:${adb.resolvedPath}`,
				adb,
				selected: true,
			},
		]);
		expect(adbOptions(undefined, undefined)).toEqual([]);
	});
});

describe("current sole credential provider", () => {
	let dispose: (() => void) | undefined;

	afterEach(() => dispose?.());

	it("recognizes one canonical provider across shorthand spellings", () => {
		expect(
			isCurrentSoleProvider(
				diagnosis([fullProvider], [provider.component]),
				provider,
			),
		).toBe(true);
	});

	it("rejects fallback, mismatched, and unparseable setting state", () => {
		const fallback = {
			flattened: "com.other/.Provider",
			packageName: "com.other",
			serviceClass: ".Provider",
		};
		expect(
			isCurrentSoleProvider(
				diagnosis([provider.component, fallback], [provider.component]),
				provider,
			),
		).toBe(false);
		expect(
			isCurrentSoleProvider(
				diagnosis([provider.component], [fallback]),
				provider,
			),
		).toBe(false);
		expect(
			isCurrentSoleProvider(diagnosis(null, [provider.component]), provider),
		).toBe(false);
	});

	it("shows a disabled current-state action without invoking Pin", () => {
		const container = document.createElement("div");
		const onPin = vi.fn();
		dispose = render(
			() => (
				<ReportPanel
					messages={translations.zh}
					report={diagnosis([fullProvider], [provider.component])}
					providers={[provider]}
					demo={false}
					onPin={onPin}
					onSnapshots={() => undefined}
					onRestart={() => undefined}
				/>
			),
			container,
		);

		const button = [...container.querySelectorAll("button")].find((item) =>
			item.textContent?.includes("当前唯一凭据提供方"),
		);
		expect(button).toBeDefined();
		expect(button?.disabled).toBe(true);
		button?.click();
		expect(onPin).not.toHaveBeenCalled();
	});

	it("keeps the preview action enabled when a fallback remains", () => {
		const container = document.createElement("div");
		const onPin = vi.fn();
		const fallback = {
			flattened: "com.other/.Provider",
			packageName: "com.other",
			serviceClass: ".Provider",
		};
		dispose = render(
			() => (
				<ReportPanel
					messages={translations.zh}
					report={diagnosis(
						[provider.component, fallback],
						[provider.component],
					)}
					providers={[provider]}
					demo={false}
					onPin={onPin}
					onSnapshots={() => undefined}
					onRestart={() => undefined}
				/>
			),
			container,
		);

		const button = [...container.querySelectorAll("button")].find((item) =>
			item.textContent?.includes("预览设为唯一凭据提供方"),
		);
		expect(button?.disabled).toBe(false);
		button?.click();
		expect(onPin).toHaveBeenCalledWith(provider);
	});
});
