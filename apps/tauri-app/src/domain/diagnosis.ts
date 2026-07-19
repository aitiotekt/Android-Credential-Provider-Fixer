import { type Accessor, createSignal, type Setter } from "solid-js";
import { type DiagnosisEntity } from "../lib/tauri";
import { type BackendSessionService } from "./backend-session";
import { type DeviceService } from "./devices";
import { DomainEvent, observeDomainEvent } from "./event";
import { type DeviceGateway } from "./gateways";
import {
	cause,
	type EntityResource,
	entityOf,
	errorFrom,
	type InvalidationCause,
	invalidateResource,
	type OperationResult,
} from "./resource";

type DiagnosisParent = { enumerationId: string; deviceId: string };

export class DiagnosisService implements Disposable {
	readonly resource: Accessor<EntityResource<DiagnosisEntity, DiagnosisParent>>;
	private readonly setResource: Setter<
		EntityResource<DiagnosisEntity, DiagnosisParent>
	>;
	private generation = 0;
	private activeParent?: DiagnosisParent;
	private readonly disposableStack = new DisposableStack();
	private readonly invalidatedEvent = this.disposableStack.use(
		new DomainEvent<{ cause: InvalidationCause }>(),
	);
	/** @internal Domain-service collaboration only. */
	readonly invalidated = this.invalidatedEvent.asObservable();

	constructor(
		private readonly gateway: DeviceGateway,
		private readonly session: BackendSessionService,
		private readonly devices: DeviceService,
	) {
		[this.resource, this.setResource] = createSignal<
			EntityResource<DiagnosisEntity, DiagnosisParent>
		>({ state: "idle" });
		observeDomainEvent(
			this.disposableStack,
			this.devices.enumerationChanged,
			(event) => this.invalidate("enumerationChanged", event.enumerationId),
		);
		observeDomainEvent(
			this.disposableStack,
			this.devices.enumerationInvalidated,
			(event) => {
				this.activeParent = undefined;
				this.generation += 1;
				this.setResource((current) => invalidateResource(current, event.cause));
				this.invalidatedEvent.emit({ cause: event.cause });
			},
		);
		observeDomainEvent(
			this.disposableStack,
			this.devices.selectionChanged,
			(event) => {
				this.activeParent = {
					enumerationId: event.enumerationId,
					deviceId: event.deviceId,
				};
				this.invalidate("deviceSelectionChanged", event.deviceId);
			},
		);
		observeDomainEvent(
			this.disposableStack,
			this.devices.selectionInvalidated,
			(event) => {
				this.activeParent = undefined;
				this.generation += 1;
				this.setResource((current) => invalidateResource(current, event.cause));
				this.invalidatedEvent.emit({ cause: event.cause });
			},
		);
		observeDomainEvent(
			this.disposableStack,
			this.session.reconciled,
			(event) => {
				const current = entityOf(this.resource());
				if (current && event.latestDiagnosisId !== current.diagnosisId) {
					this.invalidate("backendDiagnosisChanged", event.latestDiagnosisId);
				}
			},
		);
	}

	async resolve(): Promise<OperationResult> {
		const parent = this.activeParent;
		if (!parent) {
			return {
				ok: false,
				error: {
					code: "DEVICE_SELECTION_REQUIRED",
					message: "select a device from the current enumeration",
				},
			};
		}
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.generation;
		const invalidation = cause(
			"diagnosisStarted",
			entityOf(this.resource())?.diagnosisId ?? null,
			this.session.revision(),
		);
		this.setResource({
			state: "resolving",
			requestId,
			parent,
			startedAtRevision: this.session.revision(),
		});
		this.invalidatedEvent.emit({ cause: invalidation });
		try {
			const entity = await this.gateway.resolveDiagnosis(
				parent.enumerationId,
				parent.deviceId,
			);
			if (
				requestGeneration !== this.generation ||
				this.activeParent?.enumerationId !== parent.enumerationId ||
				this.activeParent.deviceId !== parent.deviceId
			) {
				return { ok: true };
			}
			if (
				entity.enumerationId !== parent.enumerationId ||
				entity.deviceId !== parent.deviceId
			) {
				const error = {
					code: "SESSION_ENTITY_MISMATCH",
					message: "diagnosis does not belong to its device selection",
				};
				this.setResource({ state: "failed", requestId, parent, error });
				return { ok: false, error };
			}
			this.setResource({ state: "resolved", entity, parent });
			this.session.observeRevision(entity.sessionRevision, entity.diagnosisId);
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.generation) {
				this.setResource({ state: "failed", requestId, parent, error });
			}
			return { ok: false, error };
		}
	}

	invalidate(
		kind: string,
		sourceId: string | null = entityOf(this.resource())?.diagnosisId ?? null,
	): void {
		this.generation += 1;
		const invalidation = cause(kind, sourceId, this.session.revision());
		this.setResource((current) => invalidateResource(current, invalidation));
		this.invalidatedEvent.emit({ cause: invalidation });
	}

	[Symbol.dispose](): void {
		if (this.disposableStack.disposed) {
			return;
		}
		this.generation += 1;
		this.disposableStack.dispose();
	}
}
