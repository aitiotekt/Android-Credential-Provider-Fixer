import { type Accessor, createSignal, type Setter } from "solid-js";
import { type SnapshotInventory, type SnapshotRecord } from "../lib/tauri";
import { type BackendSessionService } from "./backend-session";
import { type DiagnosisService } from "./diagnosis";
import { observeDomainEvent } from "./event";
import { type DeviceGateway } from "./gateways";
import {
	cause,
	type EntityResource,
	entityOf,
	errorFrom,
	invalidateResource,
	type OperationResult,
} from "./resource";

type InventoryParent = Record<never, never>;
export type RestoreIntentEntity = {
	intentId: string;
	snapshot: SnapshotRecord;
	sourceDiagnosisId: string | null;
	createdAtUnixMs: number;
};
type RestoreParent = { snapshotId: string };

export class SnapshotService implements Disposable {
	readonly inventory: Accessor<
		EntityResource<SnapshotInventory, InventoryParent>
	>;
	readonly restoreIntent: Accessor<
		EntityResource<RestoreIntentEntity, RestoreParent>
	>;
	private readonly setInventory: Setter<
		EntityResource<SnapshotInventory, InventoryParent>
	>;
	private readonly setRestoreIntent: Setter<
		EntityResource<RestoreIntentEntity, RestoreParent>
	>;
	private generation = 0;
	private readonly disposableStack = new DisposableStack();

	constructor(
		private readonly gateway: DeviceGateway,
		private readonly session: BackendSessionService,
		private readonly diagnoses: DiagnosisService,
	) {
		[this.inventory, this.setInventory] = createSignal<
			EntityResource<SnapshotInventory, InventoryParent>
		>({ state: "idle" });
		[this.restoreIntent, this.setRestoreIntent] = createSignal<
			EntityResource<RestoreIntentEntity, RestoreParent>
		>({ state: "idle" });
		observeDomainEvent(this.disposableStack, this.diagnoses.invalidated, () => {
			const current = entityOf(this.restoreIntent());
			if (current?.sourceDiagnosisId) {
				this.setRestoreIntent({
					state: "resolved",
					entity: { ...current, sourceDiagnosisId: null },
					parent: { snapshotId: current.snapshot.snapshotId },
				});
			}
		});
	}

	async open(): Promise<OperationResult> {
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.generation;
		this.setInventory({
			state: "resolving",
			requestId,
			parent: {},
			startedAtRevision: this.session.revision(),
		});
		try {
			const entity = await this.gateway.listSnapshots();
			if (requestGeneration !== this.generation) {
				return { ok: true };
			}
			this.setInventory({ state: "resolved", entity, parent: {} });
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.generation) {
				this.setInventory({ state: "failed", requestId, parent: {}, error });
			}
			return { ok: false, error };
		}
	}

	close(): void {
		this.generation += 1;
		this.setInventory((current) =>
			invalidateResource(
				current,
				cause("snapshotsClosed", null, this.session.revision()),
			),
		);
		this.clearRestoreIntent("snapshotsClosed");
	}

	selectForRestore(snapshot: SnapshotRecord, diagnosisId: string | null): void {
		const entity: RestoreIntentEntity = {
			intentId: crypto.randomUUID(),
			snapshot,
			sourceDiagnosisId: diagnosisId,
			createdAtUnixMs: Date.now(),
		};
		this.setRestoreIntent({
			state: "resolved",
			entity,
			parent: { snapshotId: snapshot.snapshotId },
		});
	}

	bindRestoreDiagnosis(diagnosisId: string): void {
		const current = entityOf(this.restoreIntent());
		if (!current) {
			return;
		}
		this.setRestoreIntent({
			state: "resolved",
			entity: { ...current, sourceDiagnosisId: diagnosisId },
			parent: { snapshotId: current.snapshot.snapshotId },
		});
	}

	clearRestoreIntent(kind: string): void {
		const current = entityOf(this.restoreIntent());
		this.setRestoreIntent((resource) =>
			invalidateResource(
				resource,
				cause(kind, current?.intentId ?? null, this.session.revision()),
			),
		);
	}

	[Symbol.dispose](): void {
		if (this.disposableStack.disposed) {
			return;
		}
		this.generation += 1;
		this.disposableStack.dispose();
	}
}
