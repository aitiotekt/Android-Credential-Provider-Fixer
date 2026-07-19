import { type Accessor, createSignal, type Setter } from "solid-js";
import { type SessionContext } from "../lib/tauri";
import { DomainEvent } from "./event";
import { type DeviceGateway } from "./gateways";
import {
	type EntityResource,
	errorFrom,
	type OperationResult,
} from "./resource";

type SessionParent = Record<never, never>;

export class BackendSessionService implements Disposable {
	readonly context: Accessor<EntityResource<SessionContext, SessionParent>>;
	private readonly setContext: Setter<
		EntityResource<SessionContext, SessionParent>
	>;
	private readonly disposableStack = new DisposableStack();
	private readonly reconciledEvent = this.disposableStack.use(
		new DomainEvent<{ revision: number; latestDiagnosisId: string | null }>(),
	);
	/** @internal Domain-service collaboration only. */
	readonly reconciled = this.reconciledEvent.asObservable();
	private generation = 0;

	constructor(private readonly gateway: DeviceGateway) {
		[this.context, this.setContext] = createSignal<
			EntityResource<SessionContext, SessionParent>
		>({ state: "idle" });
	}

	revision(): number {
		const current = this.context();
		return current.state === "resolved" ? current.entity.sessionRevision : 0;
	}

	observeRevision(revision: number, latestDiagnosisId?: string | null): void {
		const current = this.context();
		if (
			current.state === "resolved" &&
			current.entity.sessionRevision > revision
		) {
			return;
		}
		const previous = current.state === "resolved" ? current.entity : undefined;
		const next: SessionContext = {
			schemaVersion: previous?.schemaVersion ?? 2,
			sessionRevision: revision,
			selectionId: previous?.selectionId ?? null,
			enumerationId: previous?.enumerationId ?? null,
			latestDiagnosisId:
				latestDiagnosisId === undefined
					? (previous?.latestDiagnosisId ?? null)
					: latestDiagnosisId,
		};
		this.setContext({ state: "resolved", entity: next, parent: {} });
	}

	async reconcile(): Promise<OperationResult> {
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.generation;
		this.setContext({
			state: "resolving",
			requestId,
			parent: {},
			startedAtRevision: this.revision(),
		});
		try {
			const entity = await this.gateway.getSessionContext();
			if (requestGeneration !== this.generation) {
				return { ok: true };
			}
			this.setContext({ state: "resolved", entity, parent: {} });
			this.reconciledEvent.emit({
				revision: entity.sessionRevision,
				latestDiagnosisId: entity.latestDiagnosisId,
			});
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.generation) {
				this.setContext({ state: "failed", requestId, parent: {}, error });
			}
			return { ok: false, error };
		}
	}

	[Symbol.dispose](): void {
		if (this.disposableStack.disposed) {
			return;
		}
		this.generation += 1;
		this.disposableStack.dispose();
	}
}
