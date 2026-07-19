import { type Accessor, createSignal, type Setter } from "solid-js";
import {
	type AdbCandidate,
	type AdbDiscovery,
	type AdbSelection,
} from "../lib/tauri";
import { type BackendSessionService } from "./backend-session";
import { DomainEvent } from "./event";
import { type DeviceGateway } from "./gateways";
import {
	cause,
	type EntityResource,
	entityOf,
	errorFrom,
	type InvalidationCause,
	invalidateResource,
	lastEntityOf,
	type OperationResult,
} from "./resource";

type DiscoveryParent = { sessionRevision: number };
type SelectionParent = { discoveryId: string | null };

export class AdbService implements Disposable {
	readonly discovery: Accessor<EntityResource<AdbDiscovery, DiscoveryParent>>;
	readonly selection: Accessor<EntityResource<AdbSelection, SelectionParent>>;
	private readonly setDiscovery: Setter<
		EntityResource<AdbDiscovery, DiscoveryParent>
	>;
	private readonly setSelection: Setter<
		EntityResource<AdbSelection, SelectionParent>
	>;
	private discoveryGeneration = 0;
	private selectionGeneration = 0;
	private readonly disposableStack = new DisposableStack();
	private readonly selectionChangedEvent = this.disposableStack.use(
		new DomainEvent<{ selectionId: string; revision: number }>(),
	);
	private readonly selectionInvalidatedEvent = this.disposableStack.use(
		new DomainEvent<{ cause: InvalidationCause }>(),
	);
	/** @internal Domain-service collaboration only. */
	readonly selectionChanged = this.selectionChangedEvent.asObservable();
	/** @internal Domain-service collaboration only. */
	readonly selectionInvalidated = this.selectionInvalidatedEvent.asObservable();

	constructor(
		private readonly gateway: DeviceGateway,
		private readonly session: BackendSessionService,
		initialSelection?: AdbSelection,
	) {
		[this.discovery, this.setDiscovery] = createSignal<
			EntityResource<AdbDiscovery, DiscoveryParent>
		>({ state: "idle" });
		[this.selection, this.setSelection] = createSignal<
			EntityResource<AdbSelection, SelectionParent>
		>(
			initialSelection
				? {
						state: "resolved",
						entity: initialSelection,
						parent: { discoveryId: initialSelection.discoveryId },
					}
				: { state: "idle" },
		);
	}

	async discover(): Promise<OperationResult> {
		const previous = lastEntityOf(this.selection());
		const previousPath = previous?.adb.resolvedPath;
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.discoveryGeneration;
		this.invalidateSelection("discoveryStarted", previous?.selectionId ?? null);
		this.setDiscovery({
			state: "resolving",
			requestId,
			parent: { sessionRevision: this.session.revision() },
			startedAtRevision: this.session.revision(),
		});
		try {
			const entity = await this.gateway.discoverAdb();
			if (requestGeneration !== this.discoveryGeneration) {
				return { ok: true };
			}
			this.setDiscovery({
				state: "resolved",
				entity,
				parent: { sessionRevision: entity.sessionRevision },
			});
			this.session.observeRevision(entity.sessionRevision);
			const replacement = entity.candidates.find(
				(candidate) => candidate.adb.resolvedPath === previousPath,
			);
			return replacement
				? await this.selectCandidate(replacement, entity)
				: { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.discoveryGeneration) {
				this.setDiscovery({
					state: "failed",
					requestId,
					parent: { sessionRevision: this.session.revision() },
					error,
				});
			}
			return { ok: false, error };
		}
	}

	async select(candidate: AdbCandidate): Promise<OperationResult> {
		const current = entityOf(this.discovery());
		if (!current) {
			return {
				ok: false,
				error: { code: "ADB_SELECTION_STALE", message: "discovery is stale" },
			};
		}
		this.invalidateSelection("adbCandidateSelected", candidate.candidateId);
		return this.selectCandidate(candidate, current);
	}

	async chooseExecutable(): Promise<OperationResult> {
		const requestGeneration = ++this.selectionGeneration;
		try {
			const entity = await this.gateway.chooseAdbExecutable();
			if (!entity || requestGeneration !== this.selectionGeneration) {
				return { ok: true };
			}
			this.invalidateSelection("adbExecutableSelected", entity.selectionId);
			this.setSelection({
				state: "resolved",
				entity,
				parent: { discoveryId: entity.discoveryId },
			});
			this.session.observeRevision(entity.sessionRevision);
			this.selectionChangedEvent.emit({
				selectionId: entity.selectionId,
				revision: entity.sessionRevision,
			});
			return { ok: true };
		} catch (reason) {
			return { ok: false, error: errorFrom(reason) };
		}
	}

	clearForNavigation(): void {
		this.invalidateSelection(
			"navigationToAdb",
			entityOf(this.selection())?.selectionId ?? null,
		);
	}

	[Symbol.dispose](): void {
		if (this.disposableStack.disposed) {
			return;
		}
		this.discoveryGeneration += 1;
		this.selectionGeneration += 1;
		this.disposableStack.dispose();
	}

	private invalidateSelection(kind: string, sourceId: string | null): void {
		this.selectionGeneration += 1;
		const invalidation = cause(kind, sourceId, this.session.revision());
		this.setSelection((current) => invalidateResource(current, invalidation));
		this.selectionInvalidatedEvent.emit({
			cause: invalidation,
		});
	}

	private async selectCandidate(
		candidate: AdbCandidate,
		discovery: AdbDiscovery,
	): Promise<OperationResult> {
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.selectionGeneration;
		const parent = { discoveryId: discovery.discoveryId };
		this.setSelection({
			state: "resolving",
			requestId,
			parent,
			startedAtRevision: discovery.sessionRevision,
		});
		try {
			const entity = await this.gateway.selectAdbCandidate(
				discovery.discoveryId,
				candidate.candidateId,
			);
			if (requestGeneration !== this.selectionGeneration) {
				return { ok: true };
			}
			if (entity.discoveryId !== discovery.discoveryId) {
				const error = {
					code: "SESSION_ENTITY_MISMATCH",
					message: "ADB selection does not belong to its discovery",
				};
				this.setSelection({ state: "failed", requestId, parent, error });
				return { ok: false, error };
			}
			this.setSelection({ state: "resolved", entity, parent });
			this.session.observeRevision(entity.sessionRevision);
			this.selectionChangedEvent.emit({
				selectionId: entity.selectionId,
				revision: entity.sessionRevision,
			});
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.selectionGeneration) {
				this.setSelection({ state: "failed", requestId, parent, error });
			}
			return { ok: false, error };
		}
	}
}
