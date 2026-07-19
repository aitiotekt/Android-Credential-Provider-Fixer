import { type Accessor, createMemo, createSignal, type Setter } from "solid-js";
import {
	type AdbCandidate,
	type ChangeExecution,
	type ChangePlan,
	type ChangePreview,
	type DeviceChoice,
	type DeviceList,
	type DiagnosisEntity,
	type ErrorEnvelope,
	type ProviderChoice,
	type SnapshotInventory,
	type SnapshotRecord,
} from "../lib/tauri";
import { type AdbService } from "./adb";
import { type BackendSessionService } from "./backend-session";
import { type ChangeService } from "./change";
import { type DeviceSelectionEntity, type DeviceService } from "./devices";
import { type DiagnosisService } from "./diagnosis";
import { observeDomainEvent } from "./event";
import {
	type EntityResource,
	entityOf,
	lastEntityOf,
	type OperationResult,
} from "./resource";
import { type SnapshotService } from "./snapshots";

export type WorkflowView =
	| { kind: "adb" }
	| { kind: "devices"; enumeration: DeviceList }
	| { kind: "confirmation"; selection: DeviceSelectionEntity }
	| {
			kind: "diagnosing";
			resource: Extract<
				EntityResource<
					DiagnosisEntity,
					{ enumerationId: string; deviceId: string }
				>,
				{ state: "resolving" }
			>;
	  }
	| {
			kind: "diagnosisError";
			resource: Extract<
				EntityResource<
					DiagnosisEntity,
					{ enumerationId: string; deviceId: string }
				>,
				{ state: "failed" }
			>;
	  }
	| { kind: "result"; diagnosis: DiagnosisEntity }
	| { kind: "preview"; preview: ChangePreview }
	| { kind: "plan"; plan: ChangePlan }
	| { kind: "applying"; plan: ChangePlan }
	| { kind: "outcome"; execution: ChangeExecution }
	| { kind: "snapshots"; inventory: SnapshotInventory };

const STALE_ADB = new Set(["ADB_SELECTION_STALE"]);
const STALE_DEVICE = new Set(["DEVICE_SELECTION_REQUIRED", "DEVICE_CHANGED"]);
const STALE_DIAGNOSIS = new Set([
	"CHANGE_DIAGNOSIS_UNAVAILABLE",
	"CHANGE_TARGET_NOT_REGISTERED",
	"CHANGE_PREVIEW_BLOCKED",
	"CHANGE_PLAN_EXPIRED",
	"CHANGE_PLAN_UNAVAILABLE",
	"CHANGE_STATE_CHANGED",
]);

export class WorkflowService implements Disposable {
	readonly view: Accessor<WorkflowView>;
	readonly isRestoreFlow: Accessor<boolean>;
	readonly busy: Accessor<boolean>;
	readonly error: Accessor<ErrorEnvelope | undefined>;
	readonly confirmed: Accessor<boolean>;
	private readonly setError: Setter<ErrorEnvelope | undefined>;
	private readonly setConfirmedState: Setter<boolean>;
	private recoveryGeneration = 0;
	private readonly disposableStack = new DisposableStack();

	constructor(
		private readonly session: BackendSessionService,
		private readonly adb: AdbService,
		private readonly devices: DeviceService,
		private readonly diagnoses: DiagnosisService,
		private readonly changes: ChangeService,
		private readonly snapshots: SnapshotService,
	) {
		[this.error, this.setError] = createSignal<ErrorEnvelope>();
		[this.confirmed, this.setConfirmedState] = createSignal(false);
		this.view = createMemo(() => this.deriveView());
		this.busy = createMemo(
			() =>
				this.adb.discovery().state === "resolving" ||
				this.adb.selection().state === "resolving" ||
				this.devices.enumeration().state === "resolving" ||
				this.diagnoses.resource().state === "resolving" ||
				this.changes.preview().state === "resolving" ||
				this.changes.plan().state === "resolving" ||
				this.changes.execution().state === "resolving" ||
				this.snapshots.inventory().state === "resolving",
		);
		this.isRestoreFlow = createMemo(
			() =>
				entityOf(this.changes.preview())?.kind === "restore" ||
				lastEntityOf(this.changes.plan())?.kind === "restore",
		);
		observeDomainEvent(
			this.disposableStack,
			this.devices.selectionChanged,
			() => this.setConfirmedState(false),
		);
		observeDomainEvent(
			this.disposableStack,
			this.devices.selectionInvalidated,
			() => this.setConfirmedState(false),
		);
	}

	setConfirmed(value: boolean): void {
		this.setConfirmedState(value);
	}

	clearError(): void {
		this.setError(undefined);
	}

	async start(): Promise<void> {
		this.setError(undefined);
		await this.handle(await this.adb.discover());
	}

	async refreshAdb(): Promise<void> {
		await this.handle(await this.adb.discover());
	}

	async selectAdb(candidate: AdbCandidate): Promise<void> {
		await this.handle(await this.adb.select(candidate));
	}

	async chooseAdb(): Promise<void> {
		await this.handle(await this.adb.chooseExecutable());
	}

	async continueToDevices(): Promise<void> {
		await this.handle(await this.devices.list());
	}

	selectDevice(device: DeviceChoice): void {
		const result = this.devices.select(device);
		if (!result.ok) {
			this.setError(result.error);
		}
	}

	backToAdb(): void {
		this.devices.clearEnumeration();
	}

	backToDevices(): void {
		this.devices.clearSelection();
	}

	async runDiagnosis(): Promise<void> {
		if (this.confirmed()) {
			await this.handle(await this.diagnoses.resolve());
		}
	}

	async retryDiagnosis(): Promise<void> {
		await this.handle(await this.diagnoses.resolve());
	}

	async preparePin(provider: ProviderChoice): Promise<void> {
		await this.handle(await this.changes.preparePin(provider));
	}

	async createPlan(): Promise<void> {
		await this.handle(await this.changes.createPlan());
	}

	confirmPreviewRisk(allowUnparsed = false): void {
		this.changes.setRiskConfirmed(true);
		this.changes.setAllowUnparsed(allowUnparsed);
	}

	confirmPlanDevice(): void {
		this.changes.setDeviceConfirmed(true);
	}

	async executePlan(): Promise<void> {
		const result = await this.changes.execute();
		await this.handle(result);
		if (result.ok) {
			this.diagnoses.invalidate("executionCompleted");
		}
	}

	async cancelPlan(): Promise<OperationResult> {
		const result = await this.changes.cancelPlan();
		await this.handle(result);
		return result;
	}

	closePreview(): void {
		this.changes.closePreview();
		this.snapshots.clearRestoreIntent("restorePreviewClosed");
	}

	async openSnapshots(): Promise<void> {
		this.changes.clearExecution();
		await this.handle(await this.snapshots.open());
	}

	closeSnapshots(): void {
		this.snapshots.close();
	}

	async prepareRestore(snapshot: SnapshotRecord): Promise<void> {
		const diagnosis = entityOf(this.diagnoses.resource());
		this.snapshots.selectForRestore(snapshot, diagnosis?.diagnosisId ?? null);
		if (!diagnosis) {
			const result = await this.diagnoses.resolve();
			if (!result.ok) {
				await this.handle(result);
				return;
			}
		}
		const current = entityOf(this.diagnoses.resource());
		if (!current) {
			return;
		}
		this.snapshots.bindRestoreDiagnosis(current.diagnosisId);
		await this.handle(await this.changes.prepareRestore(snapshot));
	}

	async finishAndDiagnoseAgain(): Promise<void> {
		this.snapshots.close();
		this.changes.clearExecution();
		this.setConfirmedState(true);
		await this.handle(await this.diagnoses.resolve());
	}

	resetToAdb(): void {
		this.changes.clearExecution();
		this.changes.closePreview();
		this.snapshots.close();
		this.diagnoses.invalidate("workflowReset");
		this.devices.clearEnumeration("workflowReset");
		this.setConfirmedState(false);
		this.setError(undefined);
	}

	[Symbol.dispose](): void {
		if (this.disposableStack.disposed) {
			return;
		}
		this.recoveryGeneration += 1;
		this.disposableStack.dispose();
	}

	private deriveView(): WorkflowView {
		const execution = this.changes.execution();
		const plan = this.changes.plan();
		const preview = this.changes.preview();
		const inventory = this.snapshots.inventory();
		const diagnosis = this.diagnoses.resource();
		const deviceSelection = this.devices.selection();
		const enumeration = this.devices.enumeration();

		if (execution.state === "resolving" && plan.state === "resolved") {
			return { kind: "applying", plan: plan.entity };
		}
		if (plan.state === "resolved") {
			return { kind: "plan", plan: plan.entity };
		}
		if (preview.state === "resolved") {
			return { kind: "preview", preview: preview.entity };
		}
		if (execution.state === "resolved") {
			return { kind: "outcome", execution: execution.entity };
		}
		if (inventory.state === "resolved") {
			return { kind: "snapshots", inventory: inventory.entity };
		}
		if (diagnosis.state === "resolving") {
			return { kind: "diagnosing", resource: diagnosis };
		}
		if (diagnosis.state === "failed") {
			return { kind: "diagnosisError", resource: diagnosis };
		}
		if (diagnosis.state === "resolved") {
			const backend = this.session.context();
			if (
				backend.state === "resolved" &&
				backend.entity.latestDiagnosisId !== diagnosis.entity.diagnosisId
			) {
				return deviceSelection.state === "resolved"
					? { kind: "confirmation", selection: deviceSelection.entity }
					: enumeration.state === "resolved"
						? { kind: "devices", enumeration: enumeration.entity }
						: { kind: "adb" };
			}
			return { kind: "result", diagnosis: diagnosis.entity };
		}
		if (deviceSelection.state === "resolved") {
			return { kind: "confirmation", selection: deviceSelection.entity };
		}
		if (enumeration.state === "resolved") {
			return { kind: "devices", enumeration: enumeration.entity };
		}
		return { kind: "adb" };
	}

	private async handle(
		result: OperationResult,
		recoveryLevel?: "adb" | "device" | "diagnosis",
	): Promise<void> {
		if (result.ok) {
			this.setError(undefined);
			return;
		}
		this.setError(result.error);
		const code = result.error.code;
		const inferred = STALE_ADB.has(code)
			? "adb"
			: STALE_DEVICE.has(code)
				? "device"
				: STALE_DIAGNOSIS.has(code)
					? "diagnosis"
					: undefined;
		const recovery = inferred ?? recoveryLevel;
		if (!inferred || !recovery) {
			return;
		}
		const recoveryId = ++this.recoveryGeneration;
		await this.session.reconcile();
		if (recoveryId !== this.recoveryGeneration) {
			return;
		}
		if (recovery === "adb") {
			await this.adb.discover();
		} else if (recovery === "device") {
			await this.devices.list();
		} else {
			await this.diagnoses.resolve();
		}
	}
}
