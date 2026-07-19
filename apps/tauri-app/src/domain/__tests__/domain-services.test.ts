import { flush as flushSignals } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { createRootInjector, createSessionScope } from "../../di/providers";
import {
	ADB_SERVICE,
	BACKEND_SESSION_SERVICE,
	CHANGE_SERVICE,
	DEVICE_GATEWAY,
	DEVICE_SERVICE,
	DIAGNOSIS_SERVICE,
	SNAPSHOT_SERVICE,
	TUTORIAL_SERVICE,
	WORKFLOW_SERVICE,
} from "../../di/tokens";
import {
	type AdbDiscovery,
	type AppInfo,
	type ChangeExecution,
	type ChangePlan,
	type ChangePreview,
	type DemoFixture,
	type DiagnosisEntity,
	type ProviderChoice,
	type StartupState,
} from "../../lib/tauri";
import { AdbService } from "../adb";
import { BackendSessionService } from "../backend-session";
import { ChangeService } from "../change";
import { DeviceService } from "../devices";
import { DiagnosisService } from "../diagnosis";
import { DomainEvent, observeDomainEvent } from "../event";
import { type DeviceGateway } from "../gateways";
import { cause, entityOf, invalidateResource } from "../resource";
import { SnapshotService } from "../snapshots";
import { TutorialService } from "../tutorial-service";
import { WorkflowService } from "../workflow";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}

const _adb = {
	path: "/demo/adb",
	resolvedPath: "/demo/adb",
	version: "Android Debug Bridge version 1.0.41",
};

function discovery(id: string, revision: number): AdbDiscovery {
	return {
		schemaVersion: 2,
		discoveryId: id,
		sessionRevision: revision,
		completedAtUnixMs: revision,
		candidates: [],
		failures: [],
	};
}

describe("domain resources and events", () => {
	it("retains the last resolved entity when invalidated", () => {
		const invalidated = invalidateResource(
			{
				state: "resolved",
				entity: { id: "entity-1" },
				parent: { id: "parent-1" },
			},
			cause("parentChanged", "parent-2", 4),
		);
		expect(invalidated).toMatchObject({
			state: "invalidated",
			lastEntity: { id: "entity-1" },
			parent: { id: "parent-1" },
			cause: {
				kind: "parentChanged",
				sourceEntityId: "parent-2",
				sourceRevision: 4,
			},
		});
	});

	it("publishes a typed service-owned event synchronously", () => {
		using disposableStack = new DisposableStack();
		const event = disposableStack.use(
			new DomainEvent<{ selectionId: string; revision: number }>(),
		);
		const received: string[] = [];
		observeDomainEvent(disposableStack, event, (value) => {
			received.push(value.selectionId);
		});
		event.emit({ selectionId: "selection-1", revision: 2 });
		expect(received).toEqual(["selection-1"]);
	});

	it("releases a service-owned event subscription with its resource stack", () => {
		const event = new DomainEvent<number>();
		let received = 0;
		{
			using disposableStack = new DisposableStack();
			observeDomainEvent(disposableStack, event, (value) => {
				received += value;
			});
			event.emit(1);
		}
		event.emit(1);
		expect(received).toBe(1);
		event[Symbol.dispose]();
	});

	it("discards an older discovery response that arrives last", async () => {
		const first = deferred<AdbDiscovery>();
		const second = deferred<AdbDiscovery>();
		const discoverAdb = vi
			.fn<() => Promise<AdbDiscovery>>()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const service = new AdbService(
			{ discoverAdb } as unknown as DeviceGateway,
			{ revision: () => 0, observeRevision: vi.fn() } as never,
		);
		const older = service.discover();
		const newer = service.discover();
		second.resolve(discovery("new", 2));
		await newer;
		first.resolve(discovery("old", 1));
		await older;
		expect(entityOf(service.discovery())?.discoveryId).toBe("new");
	});

	it("cascades ADB invalidation through enumeration into diagnosis", async () => {
		using disposableStack = new DisposableStack();
		const reconciled = disposableStack.use(
			new DomainEvent<{
				revision: number;
				latestDiagnosisId: string | null;
			}>(),
		);
		const session = {
			revision: () => 2,
			observeRevision: vi.fn(),
			reconciled: reconciled.asObservable(),
		} as never;
		const adbService = disposableStack.use(
			new AdbService({} as DeviceGateway, session, {
				schemaVersion: 2,
				selectionId: "selection-1",
				discoveryId: "discovery-1",
				sessionRevision: 2,
				selectedAtUnixMs: 1,
				adb: {
					path: "/demo/adb",
					resolvedPath: "/demo/adb",
					version: "Android Debug Bridge version 1.0.41",
				},
			}),
		);
		const gateway = {
			listDevices: vi.fn().mockResolvedValue({
				schemaVersion: 2,
				enumerationId: "enumeration-1",
				selectionId: "selection-1",
				sessionRevision: 3,
				observedAtUnixMs: 1,
				devices: [
					{
						deviceId: "device-1",
						serial: "DEMO",
						state: "device",
						connectionType: "usb",
						product: null,
						model: null,
						device: null,
						transportId: null,
						details: null,
					},
				],
			}),
			resolveDiagnosis: vi.fn().mockResolvedValue({
				diagnosisId: "diagnosis-1",
				sessionRevision: 4,
				enumerationId: "enumeration-1",
				deviceId: "device-1",
			}),
		} as unknown as DeviceGateway;
		const devices = disposableStack.use(
			new DeviceService(gateway, session, adbService),
		);
		const diagnoses = disposableStack.use(
			new DiagnosisService(gateway, session, devices),
		);
		await devices.list();
		const currentDevice = entityOf(devices.enumeration())?.devices[0];
		expect(currentDevice).toBeDefined();
		if (!currentDevice) {
			return;
		}
		devices.select(currentDevice);
		await diagnoses.resolve();
		expect(entityOf(diagnoses.resource())?.diagnosisId).toBe("diagnosis-1");
		adbService.clearForNavigation();
		expect(diagnoses.resource()).toMatchObject({
			state: "invalidated",
			lastEntity: { diagnosisId: "diagnosis-1" },
			cause: { kind: "navigationToAdb" },
		});
	});
});

function changeHarness(overrides: Partial<DeviceGateway> = {}) {
	const invalidated = new DomainEvent<{ cause: ReturnType<typeof cause> }>();
	const provider = {
		providerId: "provider-1",
		diagnosisId: "diagnosis-1",
	} as ProviderChoice;
	const diagnosis = {
		diagnosisId: "diagnosis-1",
		providers: [provider],
	} as DiagnosisEntity;
	const preview = {
		previewId: "preview-1",
		revision: 1,
		sourceDiagnosisId: "diagnosis-1",
		kind: "pin",
		requiresUnparsedConfirmation: false,
		blockers: [],
	} as unknown as ChangePreview;
	const plan = {
		planId: "plan-1",
		sourcePreviewId: "preview-1",
		sourceDiagnosisId: "diagnosis-1",
		kind: "pin",
	} as ChangePlan;
	const gateway = {
		preparePin: vi.fn().mockResolvedValue(preview),
		createPinPlan: vi.fn().mockResolvedValue(plan),
		executePinPlan: vi.fn(),
		...overrides,
	} as unknown as DeviceGateway;
	const diagnoses = {
		resource: () => ({
			state: "resolved",
			entity: diagnosis,
			parent: { enumerationId: "enumeration-1", deviceId: "device-1" },
		}),
		resolve: vi.fn(),
		invalidate: vi.fn(),
		invalidated: invalidated.asObservable(),
	} as unknown as DiagnosisService;
	const service = new ChangeService(
		gateway,
		{ revision: () => 4 } as never,
		diagnoses,
	);
	return {
		gateway,
		provider,
		service,
		invalidateDiagnosis: (invalidation: ReturnType<typeof cause>) =>
			invalidated.emit({ cause: invalidation }),
		[Symbol.dispose]() {
			service[Symbol.dispose]();
			invalidated[Symbol.dispose]();
		},
	};
}

describe("change entity causality", () => {
	it("rejects a preview whose diagnosis parent does not match", async () => {
		using harness = changeHarness({
			preparePin: vi.fn().mockResolvedValue({
				previewId: "preview-wrong",
				sourceDiagnosisId: "diagnosis-other",
			}),
		});
		const result = await harness.service.preparePin(harness.provider);
		expect(result).toMatchObject({
			ok: false,
			error: { code: "SESSION_ENTITY_MISMATCH" },
		});
		expect(harness.service.preview()).toMatchObject({
			state: "failed",
			error: { code: "SESSION_ENTITY_MISMATCH" },
		});
	});

	it("cascades diagnosis invalidation through preview, plan, and execution", async () => {
		const inFlight = deferred<ChangeExecution>();
		using harness = changeHarness({
			executePinPlan: vi.fn().mockReturnValue(inFlight.promise),
		});
		await harness.service.preparePin(harness.provider);
		harness.service.setRiskConfirmed(true);
		await Promise.resolve();
		await harness.service.createPlan();
		harness.service.setDeviceConfirmed(true);
		flushSignals();
		const execution = harness.service.execute();
		flushSignals();
		harness.invalidateDiagnosis(cause("diagnosisReplaced", "diagnosis-2", 5));
		expect(harness.service.preview().state).toBe("invalidated");
		expect(harness.service.plan().state).toBe("invalidated");
		expect(harness.service.execution().state).toBe("invalidated");
		inFlight.resolve({
			executionId: "execution-1",
			planId: "plan-1",
			sourceDiagnosisId: "diagnosis-1",
		} as ChangeExecution);
		await execution;
		expect(harness.service.execution().state).toBe("invalidated");
	});

	it("invalidates a plan after an uncertain execution failure", async () => {
		const executePinPlan = vi.fn().mockRejectedValue({
			code: "CHANGE_STATE_CHANGED",
			message: "state changed",
		});
		using harness = changeHarness({ executePinPlan });
		await harness.service.preparePin(harness.provider);
		harness.service.setRiskConfirmed(true);
		await Promise.resolve();
		await harness.service.createPlan();
		harness.service.setDeviceConfirmed(true);
		await Promise.resolve();
		expect(await harness.service.execute()).toMatchObject({ ok: false });
		expect(harness.service.plan().state).toBe("invalidated");
		expect(await harness.service.execute()).toMatchObject({
			ok: false,
			error: { code: "CHANGE_PLAN_UNAVAILABLE" },
		});
		expect(executePinPlan).toHaveBeenCalledTimes(1);
	});
});

describe("injector boundaries", () => {
	it("keeps the device gateway out of the root injector and resolves explicit factories in a session", () => {
		const appGateway = {
			getAppInfo: vi.fn<() => Promise<AppInfo>>(),
			getStartupState: vi.fn<() => Promise<StartupState>>(),
			setOnboardingStatus: vi.fn(),
			setThemePreference: vi.fn(),
			getDemoFixture: vi.fn<() => Promise<DemoFixture>>(),
		};
		const root = createRootInjector(appGateway);
		expect(() => root.get(DEVICE_GATEWAY)).toThrow();
		const gateway = { getSessionContext: vi.fn() } as unknown as DeviceGateway;
		using scope = createSessionScope(root, gateway);
		expect(scope.injector.get(DEVICE_GATEWAY)).toBe(gateway);
		expect(scope.injector.get(ADB_SERVICE)).toBeInstanceOf(AdbService);
		expect(scope.injector.get(DEVICE_SERVICE)).toBeInstanceOf(DeviceService);
		expect(scope.injector.get(DIAGNOSIS_SERVICE)).toBeInstanceOf(
			DiagnosisService,
		);
		expect(scope.injector.get(CHANGE_SERVICE)).toBeInstanceOf(ChangeService);
		expect(scope.injector.get(BACKEND_SESSION_SERVICE)).toBeInstanceOf(
			BackendSessionService,
		);
		expect(scope.injector.get(SNAPSHOT_SERVICE)).toBeInstanceOf(
			SnapshotService,
		);
		expect(scope.injector.get(WORKFLOW_SERVICE)).toBeInstanceOf(
			WorkflowService,
		);
		expect(scope.injector.get(TUTORIAL_SERVICE)).toBeInstanceOf(
			TutorialService,
		);
		expect(Object.hasOwn(scope.injector.get(ADB_SERVICE), "discover")).toBe(
			false,
		);
		expect(scope.injector.get(WORKFLOW_SERVICE)).toBe(
			scope.injector.get(WORKFLOW_SERVICE),
		);
	});
});
