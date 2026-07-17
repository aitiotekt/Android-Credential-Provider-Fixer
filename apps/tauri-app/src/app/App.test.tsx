import { render } from "@solidjs/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const api = vi.hoisted(() => ({
	getAppInfo: vi.fn(),
	getStartupState: vi.fn(),
	discoverAdb: vi.fn(),
	selectAdbCandidate: vi.fn(),
	chooseAdbExecutable: vi.fn(),
	listDevices: vi.fn(),
	inspectDevice: vi.fn(),
	setOnboardingStatus: vi.fn(),
	getDemoFixture: vi.fn(),
}));

const tutorial = vi.hoisted(() => ({
	startTutorial: vi.fn(),
	stopTutorial: vi.fn(),
}));

vi.mock("../lib/tauri", () => api);
vi.mock("./tutorial", () => tutorial);

async function flushPromises() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function clickButton(container: HTMLElement, text: string) {
	const button = [...container.querySelectorAll("button")].find((item) =>
		item.textContent?.includes(text),
	);
	expect(button, `button containing ${text}`).toBeDefined();
	button?.click();
}

const adb = {
	path: "/sdk/platform-tools/adb",
	resolvedPath: "/sdk/platform-tools/adb",
	version: "Android Debug Bridge version 1.0.41",
};

const device = {
	deviceId: "device-1-0",
	serial: "SERIAL",
	state: "device" as const,
	connectionType: "usb" as const,
	product: "product",
	model: "Phone",
	device: "phone",
	transportId: "1",
	details: null,
};

const report = {
	schemaVersion: 1,
	mode: "real" as const,
	status: "complete" as const,
	observedAtUnixMs: 1_788_220_800_000,
	adb,
	device: {
		serial: "SERIAL",
		connectionType: "usb" as const,
		manufacturer: "Example",
		model: "Phone",
		codename: "phone",
		androidVersion: "14",
		apiLevel: 34,
	},
	androidUser: { id: 0, isForeground: true },
	providers: [
		{
			component: {
				flattened: "com.example/.Provider",
				packageName: "com.example",
				serviceClass: ".Provider",
			},
			enabled: true,
			primary: true,
			samePackageAsAutofill: false,
		},
	],
	credentialState: {
		enabled: {
			key: "credential_service",
			value: {
				kind: "value" as const,
				raw: "com.example/.Provider",
				components: [],
			},
		},
		primary: {
			key: "credential_service_primary",
			value: { kind: "missing" as const },
		},
		autofill: { key: "autofill_service", value: { kind: "empty" as const } },
	},
	findings: [
		{
			code: "NO_INCONSISTENCY_DETECTED",
			severity: "info" as const,
			relatedValue: null,
		},
	],
};

describe("App", () => {
	let container: HTMLDivElement;
	let dispose: (() => void) | undefined;

	beforeEach(() => {
		window.localStorage.clear();
		Object.defineProperty(window.navigator, "language", {
			configurable: true,
			value: "en-US",
		});
		Object.defineProperty(window.navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn() },
		});
		for (const mock of Object.values(api)) {
			mock.mockReset();
		}
		tutorial.startTutorial.mockReset();
		tutorial.stopTutorial.mockReset();
		api.getAppInfo.mockResolvedValue({
			productName: "Android Credential Provider Fixer",
			version: "0.1.0-alpha.2",
			developmentPhase: "phase-1-read-only",
			adbReadOperationsEnabled: true,
			adbWriteOperationsEnabled: false,
		});
		api.getStartupState.mockResolvedValue({
			schemaVersion: 1,
			onboardingVersion: 1,
			onboardingStatus: "skipped",
			selectedAdb: null,
			preferenceWarning: null,
		});
		api.setOnboardingStatus.mockResolvedValue({
			schemaVersion: 1,
			onboardingVersion: 1,
			onboardingStatus: "skipped",
			selectedAdb: null,
			preferenceWarning: null,
		});
		container = document.createElement("div");
		document.body.append(container);
	});

	afterEach(() => {
		dispose?.();
		container.remove();
	});

	it("renders the read-only phase and switches to Chinese", async () => {
		dispose = render(() => <App />, container);
		await flushPromises();

		expect(container.textContent).toContain(
			"Make hidden Credential Provider state visible",
		);
		expect(container.textContent).toContain("0.1.0-alpha.2");
		const select = container.querySelector("select");
		expect(select).not.toBeNull();
		if (!select) {
			return;
		}
		select.value = "zh";
		select.dispatchEvent(new Event("input", { bubbles: true }));
		await flushPromises();

		expect(container.textContent).toContain(
			"让隐藏的 Credential Provider 状态可见",
		);
		expect(window.localStorage.getItem("acp-fixer.locale")).toBe("zh");
	});

	it("walks through explicit ADB and device selection", async () => {
		api.discoverAdb.mockResolvedValue({
			schemaVersion: 1,
			candidates: [{ candidateId: "adb-1-0", source: "path", adb }],
			failures: [],
		});
		api.selectAdbCandidate.mockResolvedValue(adb);
		api.listDevices.mockResolvedValue({
			schemaVersion: 1,
			observedAtUnixMs: 1,
			devices: [device],
		});
		api.inspectDevice.mockResolvedValue(report);
		dispose = render(() => <App />, container);
		await flushPromises();

		clickButton(container, "Start read-only diagnosis");
		await flushPromises();
		clickButton(container, "Use this ADB");
		await flushPromises();
		clickButton(container, "Continue to devices");
		await flushPromises();
		clickButton(container, "Inspect this device");
		await flushPromises();
		const checkbox = container.querySelector<HTMLInputElement>(
			"input[type='checkbox']",
		);
		expect(checkbox).not.toBeNull();
		if (!checkbox) {
			return;
		}
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event("input", { bubbles: true }));
		await flushPromises();
		clickButton(container, "Run read-only diagnosis");
		await flushPromises();

		expect(api.inspectDevice).toHaveBeenCalledWith("device-1-0");
		expect(container.textContent).toContain("com.example/.Provider");
		expect(container.textContent).toContain("No modeled state inconsistency");
	});

	it("runs the demo without live discovery or inspection calls", async () => {
		api.getDemoFixture.mockResolvedValue({
			schemaVersion: 1,
			simulated: true,
			adb,
			devices: {
				observedAtUnixMs: 1,
				devices: [{ ...device, deviceId: undefined }],
			},
			report: { ...report, mode: "demo" },
		});
		dispose = render(() => <App />, container);
		await flushPromises();

		clickButton(container, "Explore simulated demo");
		await flushPromises();
		clickButton(container, "Continue to devices");
		await flushPromises();
		clickButton(container, "Inspect this device");
		await flushPromises();
		const checkbox = container.querySelector<HTMLInputElement>(
			"input[type='checkbox']",
		);
		if (!checkbox) {
			throw new Error("confirmation checkbox missing");
		}
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event("input", { bubbles: true }));
		await flushPromises();
		clickButton(container, "Run read-only diagnosis");
		await flushPromises();

		expect(container.textContent).toContain("Simulated Demo");
		expect(api.discoverAdb).not.toHaveBeenCalled();
		expect(api.listDevices).not.toHaveBeenCalled();
		expect(api.inspectDevice).not.toHaveBeenCalled();
	});

	it("offers onboarding once and records a skip", async () => {
		api.getStartupState.mockResolvedValue({
			schemaVersion: 1,
			onboardingVersion: 1,
			onboardingStatus: null,
			selectedAdb: null,
			preferenceWarning: null,
		});
		dispose = render(() => <App />, container);
		await flushPromises();

		expect(container.textContent).toContain("Learn the workflow?");
		clickButton(container, "Skip for now");
		await flushPromises();

		expect(api.setOnboardingStatus).toHaveBeenCalledWith("skipped");
		expect(container.textContent).not.toContain("Learn the workflow?");
	});

	it("shows an unavailable state when startup IPC fails", async () => {
		api.getStartupState.mockRejectedValue(new Error("IPC unavailable"));
		dispose = render(() => <App />, container);
		await flushPromises();

		expect(container.textContent).toContain("The local core is unavailable");
	});
});
