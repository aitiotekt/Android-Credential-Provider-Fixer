import { render } from "@solidjs/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

const api = vi.hoisted(() => ({
	getAppInfo: vi.fn(),
	getStartupState: vi.fn(),
	discoverAdb: vi.fn(),
	selectAdbCandidate: vi.fn(),
	chooseAdbExecutable: vi.fn(),
	listDevices: vi.fn(),
	resolveDiagnosis: vi.fn(),
	preparePin: vi.fn(),
	createPinPlan: vi.fn(),
	executePinPlan: vi.fn(),
	listSnapshots: vi.fn(),
	prepareRestore: vi.fn(),
	createRestorePlan: vi.fn(),
	executeRestorePlan: vi.fn(),
	cancelChangePlan: vi.fn(),
	authorizePinPreview: vi.fn(),
	setOnboardingStatus: vi.fn(),
	setThemePreference: vi.fn(),
	getDemoFixture: vi.fn(),
	getSessionContext: vi.fn(),
}));

const tutorial = vi.hoisted(() => ({
	startTutorial: vi.fn(),
	stopTutorial: vi.fn(),
	advanceTutorial: vi.fn(),
	advanceTutorialFromInteraction: vi.fn(),
}));

vi.mock("../tutorial", () => tutorial);

const appGateway = {
	getAppInfo: (...args: []) => api.getAppInfo(...args),
	getStartupState: (...args: []) => api.getStartupState(...args),
	setOnboardingStatus: (...args: ["completed" | "skipped"]) =>
		api.setOnboardingStatus(...args),
	setThemePreference: (...args: ["system" | "light" | "dark"]) =>
		api.setThemePreference(...args),
	getDemoFixture: (...args: []) => api.getDemoFixture(...args),
};

const deviceGateway = {
	getSessionContext: (...args: []) => api.getSessionContext(...args),
	discoverAdb: (...args: []) => api.discoverAdb(...args),
	selectAdbCandidate: (...args: [string, string]) =>
		api.selectAdbCandidate(...args),
	chooseAdbExecutable: (...args: []) => api.chooseAdbExecutable(...args),
	listDevices: (...args: [string]) => api.listDevices(...args),
	resolveDiagnosis: (...args: [string, string]) =>
		api.resolveDiagnosis(...args),
	preparePin: (...args: [string, string, boolean]) => api.preparePin(...args),
	authorizePinPreview: (...args: [string]) => api.authorizePinPreview(...args),
	createPinPlan: (...args: [string]) => api.createPinPlan(...args),
	executePinPlan: (...args: [string]) => api.executePinPlan(...args),
	listSnapshots: (...args: []) => api.listSnapshots(...args),
	prepareRestore: (...args: [string, string]) => api.prepareRestore(...args),
	createRestorePlan: (...args: [string]) => api.createRestorePlan(...args),
	executeRestorePlan: (...args: [string]) => api.executeRestorePlan(...args),
	cancelChangePlan: (...args: [string]) => api.cancelChangePlan(...args),
};

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
	schemaVersion: 2,
	mode: "real" as const,
	completeness: "complete" as const,
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
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		});
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
		tutorial.advanceTutorial.mockReset();
		api.getAppInfo.mockResolvedValue({
			productName: "Android Credential Provider Fixer",
			version: "test-version",
			developmentPhase: "phase-2-verified-changes",
			adbReadOperationsEnabled: true,
			adbWriteOperationsEnabled: true,
		});
		api.getStartupState.mockResolvedValue({
			schemaVersion: 2,
			onboardingVersion: 2,
			onboardingStatus: "skipped",
			themePreference: "system",
			adbSelection: null,
			preferenceWarning: null,
		});
		api.getSessionContext.mockResolvedValue({
			schemaVersion: 2,
			sessionRevision: 0,
			selectionId: null,
			enumerationId: null,
			latestDiagnosisId: null,
		});
		api.setOnboardingStatus.mockResolvedValue({
			schemaVersion: 2,
			onboardingVersion: 2,
			onboardingStatus: "skipped",
			themePreference: "system",
			adbSelection: null,
			preferenceWarning: null,
		});
		container = document.createElement("div");
		document.body.append(container);
	});

	afterEach(() => {
		dispose?.();
		container.remove();
	});

	it("renders the localized welcome page and switches to Chinese", async () => {
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		expect(container.textContent).toContain(
			"Make hidden Credential Provider state visible",
		);
		expect(container.textContent).toContain("test-version");
		const select = container.querySelector("select");
		expect(select).not.toBeNull();
		if (!select) {
			return;
		}
		select.value = "zh";
		select.dispatchEvent(new Event("input", { bubbles: true }));
		await flushPromises();

		expect(container.textContent).toContain("看清隐藏的凭据提供方状态");
		expect(window.localStorage.getItem("acp-fixer.locale")).toBe("zh");
	});

	it("walks through explicit ADB and device selection", async () => {
		api.discoverAdb.mockResolvedValue({
			schemaVersion: 2,
			discoveryId: "discovery-1",
			sessionRevision: 1,
			completedAtUnixMs: 1,
			candidates: [{ candidateId: "adb-1-0", source: "path", adb }],
			failures: [],
		});
		api.selectAdbCandidate.mockResolvedValue({
			schemaVersion: 2,
			selectionId: "selection-1",
			discoveryId: "discovery-1",
			sessionRevision: 2,
			selectedAtUnixMs: 1,
			adb,
		});
		api.listDevices.mockResolvedValue({
			schemaVersion: 2,
			enumerationId: "enumeration-1",
			selectionId: "selection-1",
			sessionRevision: 2,
			observedAtUnixMs: 1,
			devices: [device],
		});
		api.resolveDiagnosis.mockResolvedValue({
			schemaVersion: 2,
			diagnosisId: "diagnosis-1",
			sessionRevision: 2,
			enumerationId: "enumeration-1",
			deviceId: "device-1-0",
			startedAtUnixMs: 1,
			resolvedAtUnixMs: 2,
			report,
			providers: [
				{
					...report.providers[0],
					providerId: "provider-1-0",
					diagnosisId: "diagnosis-1",
				},
			],
		});
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		clickButton(container, "Start diagnosis");
		await flushPromises();
		clickButton(container, "Use this ADB");
		await flushPromises();
		expect(container.querySelectorAll("[data-tour='adb-card']")).toHaveLength(
			1,
		);
		const selectedAdbButton = [...container.querySelectorAll("button")].find(
			(item) => item.textContent?.includes("Selected"),
		);
		expect(selectedAdbButton?.disabled).toBe(true);
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
		clickButton(container, "Run diagnosis");
		await flushPromises();

		expect(api.resolveDiagnosis).toHaveBeenCalledWith(
			"enumeration-1",
			"device-1-0",
		);
		expect(container.textContent).toContain("com.example/.Provider");
		expect(container.textContent).toContain("No modeled state inconsistency");
	});

	it("rebases a saved ADB selection onto the latest discovery entity", async () => {
		api.getStartupState.mockResolvedValue({
			schemaVersion: 2,
			onboardingVersion: 2,
			onboardingStatus: "skipped",
			themePreference: "system",
			adbSelection: {
				schemaVersion: 2,
				selectionId: "selection-old",
				discoveryId: null,
				sessionRevision: 1,
				selectedAtUnixMs: 1,
				adb,
			},
			preferenceWarning: null,
		});
		api.discoverAdb.mockResolvedValue({
			schemaVersion: 2,
			discoveryId: "discovery-new",
			sessionRevision: 2,
			completedAtUnixMs: 2,
			candidates: [{ candidateId: "adb-new", source: "saved", adb }],
			failures: [],
		});
		api.selectAdbCandidate.mockResolvedValue({
			schemaVersion: 2,
			selectionId: "selection-new",
			discoveryId: "discovery-new",
			sessionRevision: 3,
			selectedAtUnixMs: 3,
			adb,
		});
		api.listDevices.mockResolvedValue({
			schemaVersion: 2,
			enumerationId: "enumeration-new",
			selectionId: "selection-new",
			sessionRevision: 4,
			observedAtUnixMs: 4,
			devices: [device],
		});

		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();
		clickButton(container, "Start diagnosis");
		await flushPromises();
		await flushPromises();

		expect(api.selectAdbCandidate).toHaveBeenCalledWith(
			"discovery-new",
			"adb-new",
		);
		expect(container.querySelector("[data-tour='adb-card']")).not.toBeNull();

		clickButton(container, "Continue to devices");
		await flushPromises();
		expect(api.listDevices).toHaveBeenCalledWith("selection-new");
		expect(container.textContent).not.toContain("ADB_SELECTION_STALE");
		expect(container.textContent).toContain("Choose a device");
	});

	it("automatically revalidates ADB when the backend rejects a stale selection", async () => {
		api.discoverAdb.mockResolvedValue({
			schemaVersion: 2,
			discoveryId: "discovery-1",
			sessionRevision: 1,
			completedAtUnixMs: 1,
			candidates: [{ candidateId: "adb-1", source: "path", adb }],
			failures: [],
		});
		api.selectAdbCandidate
			.mockResolvedValueOnce({
				schemaVersion: 2,
				selectionId: "selection-1",
				discoveryId: "discovery-1",
				sessionRevision: 2,
				selectedAtUnixMs: 2,
				adb,
			})
			.mockResolvedValueOnce({
				schemaVersion: 2,
				selectionId: "selection-2",
				discoveryId: "discovery-1",
				sessionRevision: 4,
				selectedAtUnixMs: 4,
				adb,
			});
		api.listDevices.mockRejectedValue({
			code: "ADB_SELECTION_STALE",
			message: "the selected ADB candidate is no longer available",
		});

		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();
		clickButton(container, "Start diagnosis");
		await flushPromises();
		clickButton(container, "Use this ADB");
		await flushPromises();
		clickButton(container, "Continue to devices");
		await flushPromises();
		await flushPromises();

		expect(api.discoverAdb).toHaveBeenCalledTimes(2);
		expect(api.selectAdbCandidate).toHaveBeenLastCalledWith(
			"discovery-1",
			"adb-1",
		);
		expect(container.textContent).not.toContain("ADB_SELECTION_STALE");
		const selectedButton = [...container.querySelectorAll("button")].find(
			(item) => item.textContent?.includes("Selected"),
		);
		expect(selectedButton?.disabled).toBe(true);
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
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		clickButton(container, "Explore simulated demo");
		await flushPromises();
		expect(
			[...container.querySelectorAll("button")].some((item) =>
				item.textContent?.includes("Exit demo"),
			),
		).toBe(true);
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
		clickButton(container, "Run diagnosis");
		await flushPromises();

		expect(container.textContent).toContain("Simulated mode");
		expect(api.discoverAdb).not.toHaveBeenCalled();
		expect(api.listDevices).not.toHaveBeenCalled();
		expect(api.resolveDiagnosis).not.toHaveBeenCalled();

		clickButton(container, "Start tutorial");
		await flushPromises();
		expect(container.textContent).toContain("Restart the guided demo?");
		clickButton(container, "Stay here");
		await flushPromises();
		expect(container.textContent).toContain("Diagnosis results");
		expect(tutorial.startTutorial).not.toHaveBeenCalled();

		const previousScope = container
			.querySelector("[data-session-scope]")
			?.getAttribute("data-session-scope");
		clickButton(container, "Start tutorial");
		await flushPromises();
		clickButton(container, "Restart tutorial");
		await vi.waitFor(() =>
			expect(tutorial.startTutorial).toHaveBeenCalledOnce(),
		);
		expect(
			container
				.querySelector("[data-session-scope]")
				?.getAttribute("data-session-scope"),
		).not.toBe(previousScope);
		expect(container.querySelector("[data-tour='adb-card']")).not.toBeNull();
		expect(
			container.querySelector("[data-tour='continue-adb']"),
		).not.toBeNull();
		expect(container.textContent).not.toContain("Diagnosis results");

		clickButton(container, "Exit demo");
		await flushPromises();
		expect(container.textContent).not.toContain("Simulated mode");
		expect(container.textContent).toContain(
			"Make hidden Credential Provider state visible",
		);
	});

	it("confirms before replacing a live workflow with the guided demo", async () => {
		api.discoverAdb.mockResolvedValue({
			schemaVersion: 2,
			discoveryId: "discovery-live",
			sessionRevision: 1,
			completedAtUnixMs: 1,
			candidates: [{ candidateId: "adb-live", source: "path", adb }],
			failures: [],
		});
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
		tutorial.startTutorial.mockImplementationOnce(() => {
			expect(
				document.querySelector("[data-tour='demo-banner']"),
			).not.toBeNull();
		});
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		clickButton(container, "Start diagnosis");
		await vi.waitFor(() => {
			const button = [...container.querySelectorAll("button")].find((item) =>
				item.textContent?.includes("Start tutorial"),
			);
			expect(button?.disabled).toBe(false);
		});
		clickButton(container, "Start tutorial");
		await flushPromises();

		expect(container.textContent).toContain("Switch to the guided demo?");
		expect(api.getDemoFixture).not.toHaveBeenCalled();
		expect(container.textContent).not.toContain("Simulated mode");

		clickButton(container, "Stay here");
		await flushPromises();
		expect(container.textContent).not.toContain("Switch to the guided demo?");
		expect(container.textContent).toContain(
			"Select a validated ADB installation",
		);

		clickButton(container, "Start tutorial");
		await flushPromises();
		clickButton(container, "Switch and start tutorial");
		await vi.waitFor(() =>
			expect(tutorial.startTutorial).toHaveBeenCalledOnce(),
		);

		expect(api.getDemoFixture).toHaveBeenCalledOnce();
		expect(container.textContent).toContain("Simulated mode");
	});

	it("lets tutorial navigation move forward and backward across views", async () => {
		const before = {
			enabled: { kind: "value", raw: "com.google/.Provider", parseable: true },
			primary: { kind: "missing" },
		};
		const after = {
			enabled: { kind: "value", raw: "com.example/.Provider", parseable: true },
			primary: { kind: "value", raw: "com.example/.Provider", parseable: true },
		};
		const pinPreview = {
			schemaVersion: 1,
			previewId: "demo-preview-pin",
			sourceSnapshotId: null,
			kind: "pin",
			createdAtUnixMs: 1,
			adb,
			device: report.device,
			androidUser: report.androidUser,
			target: report.providers[0]?.component,
			registeredProviders: ["com.example/.Provider"],
			before,
			after,
			requiresUnparsedConfirmation: false,
			allowUnparsed: false,
			blockers: [],
		};
		const snapshot = {
			schemaVersion: 1,
			revision: 2,
			snapshotId: "demo-snapshot-pin",
			planId: "demo-plan-pin",
			sourceSnapshotId: null,
			createdAtUnixMs: 1,
			updatedAtUnixMs: 2,
			status: "applied",
			kind: "pin",
			adb,
			device: report.device,
			androidUser: report.androidUser,
			target: report.providers[0]?.component,
			before,
			intendedAfter: after,
			lastObserved: after,
			message: null,
		};
		const pinOutcome = {
			schemaVersion: 1,
			planId: "demo-plan-pin",
			snapshotId: "demo-snapshot-pin",
			status: "applied",
			completedAtUnixMs: 2,
			steps: [],
			recoverySteps: [],
			observed: after,
		};
		api.getDemoFixture.mockResolvedValue({
			schemaVersion: 1,
			simulated: true,
			adb,
			devices: {
				observedAtUnixMs: 1,
				devices: [{ ...device, deviceId: undefined }],
			},
			report: { ...report, mode: "demo" },
			pinPreview,
			pinOutcome,
			snapshots: { schemaVersion: 1, snapshots: [snapshot], warnings: [] },
		});
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		clickButton(container, "Start tutorial");
		await vi.waitFor(() =>
			expect(
				tutorial.startTutorial,
				container
					.querySelector("[data-error-message]")
					?.getAttribute("data-error-message") ??
					container.textContent ??
					"",
			).toHaveBeenCalledOnce(),
		);
		const callbacks = tutorial.startTutorial.mock.calls[0]?.[1] as
			| { sceneChanged?: (scene: string) => void }
			| undefined;

		callbacks?.sceneChanged?.("devices");
		await flushPromises();
		expect(container.querySelector("[data-tour='device-card']")).not.toBeNull();

		callbacks?.sceneChanged?.("adb");
		await flushPromises();
		expect(
			container.querySelector("[data-tour='continue-adb']"),
		).not.toBeNull();
		expect(container.textContent).toContain(adb.path);

		for (const [scene, selector] of [
			["confirmation", "[data-tour='confirmation']"],
			["diagnosis", "[data-tour='diagnosis-result']"],
			["pinPreview", "[data-tour='plan-preview']"],
			["pinConfirmation", "[data-tour='device-write-confirm']"],
			["pinOutcome", "[data-tour='change-outcome']"],
			["snapshots", "[data-tour='preview-restore']"],
			["restorePreview", "[data-tour='risk-confirm']"],
			["restoreConfirmation", "[data-tour='apply-change']"],
			["restoreOutcome", "[data-tour='change-outcome']"],
		] as const) {
			callbacks?.sceneChanged?.(scene);
			await vi.waitFor(() =>
				expect(
					container.querySelector(selector),
					`${scene} target`,
				).not.toBeNull(),
			);
			if (scene === "pinOutcome") {
				expect(
					container.querySelector("[data-tour='open-snapshots']"),
				).not.toBeNull();
			}
			if (scene === "pinConfirmation" || scene === "restoreConfirmation") {
				expect(
					container.querySelector("[data-tour='device-write-check']"),
				).not.toBeNull();
			}
			expect(
				[...container.querySelectorAll("button")].some((item) =>
					item.textContent?.includes("Exit demo"),
				),
			).toBe(true);
		}
		expect(api.listDevices).not.toHaveBeenCalled();
		expect(api.resolveDiagnosis).not.toHaveBeenCalled();
	});

	it("offers onboarding once and records a skip", async () => {
		api.getStartupState.mockResolvedValue({
			schemaVersion: 1,
			onboardingVersion: 1,
			onboardingStatus: null,
			themePreference: "system",
			selectedAdb: null,
			preferenceWarning: null,
		});
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		expect(container.textContent).toContain("Learn the workflow?");
		clickButton(container, "Skip for now");
		await flushPromises();

		expect(api.setOnboardingStatus).toHaveBeenCalledWith("skipped");
		expect(container.textContent).not.toContain("Learn the workflow?");
	});

	it("shows an unavailable state when startup IPC fails", async () => {
		api.getStartupState.mockRejectedValue(new Error("IPC unavailable"));
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		expect(container.textContent).toContain("The local core is unavailable");
	});

	it("applies and persists an explicit theme preference", async () => {
		api.getStartupState.mockResolvedValue({
			schemaVersion: 1,
			onboardingVersion: 2,
			onboardingStatus: "skipped",
			themePreference: "dark",
			selectedAdb: null,
			preferenceWarning: null,
		});
		api.setThemePreference.mockResolvedValue({
			schemaVersion: 1,
			onboardingVersion: 2,
			onboardingStatus: "skipped",
			themePreference: "light",
			selectedAdb: null,
			preferenceWarning: null,
		});
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		expect(document.documentElement.dataset.theme).toBe("dark");
		container.querySelector<HTMLInputElement>('input[value="light"]')?.click();
		await flushPromises();

		expect(api.setThemePreference).toHaveBeenCalledWith("light");
		expect(document.documentElement.dataset.theme).toBe("light");
		expect(document.documentElement.style.colorScheme).toBe("light");
	});

	it("rolls back the theme when preference persistence fails", async () => {
		api.setThemePreference.mockRejectedValue({
			code: "PREFERENCE_WRITE_FAILED",
			message: "Could not save preference.",
		});
		dispose = render(
			() => <App appGateway={appGateway} deviceGateway={deviceGateway} />,
			container,
		);
		await flushPromises();

		container.querySelector<HTMLInputElement>('input[value="dark"]')?.click();
		await flushPromises();

		expect(document.documentElement.dataset.theme).toBe("light");
		expect(container.textContent).toContain(
			"The application preference could not be saved.",
		);
		expect(container.textContent).not.toContain("PREFERENCE_WRITE_FAILED");
		expect(
			container.querySelector<HTMLInputElement>('input[value="system"]')
				?.checked,
		).toBe(true);
	});
});
