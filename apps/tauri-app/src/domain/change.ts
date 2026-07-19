import { type Accessor, createSignal, type Setter } from "solid-js";
import {
	type ChangeExecution,
	type ChangePlan,
	type ChangePreview,
	type ProviderChoice,
	type SnapshotRecord,
} from "../lib/tauri";
import { type BackendSessionService } from "./backend-session";
import { type DiagnosisService } from "./diagnosis";
import { observeDomainEvent } from "./event";
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

type PreviewParent = { diagnosisId: string; sourceId: string };
type PlanParent = { diagnosisId: string; previewId: string };
type ExecutionParent = { diagnosisId: string; planId: string };

export class ChangeService implements Disposable {
	readonly preview: Accessor<EntityResource<ChangePreview, PreviewParent>>;
	readonly plan: Accessor<EntityResource<ChangePlan, PlanParent>>;
	readonly execution: Accessor<
		EntityResource<ChangeExecution, ExecutionParent>
	>;
	readonly riskConfirmed: Accessor<boolean>;
	readonly allowUnparsed: Accessor<boolean>;
	readonly deviceConfirmed: Accessor<boolean>;
	private readonly setPreview: Setter<
		EntityResource<ChangePreview, PreviewParent>
	>;
	private readonly setPlan: Setter<EntityResource<ChangePlan, PlanParent>>;
	private readonly setExecution: Setter<
		EntityResource<ChangeExecution, ExecutionParent>
	>;
	private readonly setRiskConfirmedState: Setter<boolean>;
	private readonly setAllowUnparsedState: Setter<boolean>;
	private readonly setDeviceConfirmedState: Setter<boolean>;
	private previewGeneration = 0;
	private planGeneration = 0;
	private executionGeneration = 0;
	private readonly disposableStack = new DisposableStack();

	constructor(
		private readonly gateway: DeviceGateway,
		private readonly session: BackendSessionService,
		private readonly diagnoses: DiagnosisService,
	) {
		[this.preview, this.setPreview] = createSignal<
			EntityResource<ChangePreview, PreviewParent>
		>({ state: "idle" });
		[this.plan, this.setPlan] = createSignal<
			EntityResource<ChangePlan, PlanParent>
		>({ state: "idle" });
		[this.execution, this.setExecution] = createSignal<
			EntityResource<ChangeExecution, ExecutionParent>
		>({ state: "idle" });
		[this.riskConfirmed, this.setRiskConfirmedState] = createSignal(false);
		[this.allowUnparsed, this.setAllowUnparsedState] = createSignal(false);
		[this.deviceConfirmed, this.setDeviceConfirmedState] = createSignal(false);
		observeDomainEvent(
			this.disposableStack,
			this.diagnoses.invalidated,
			(event) => this.propagatePreviewInvalidation(event.cause, true),
		);
	}

	setRiskConfirmed(value: boolean): void {
		this.setRiskConfirmedState(value);
	}

	setAllowUnparsed(value: boolean): void {
		this.setAllowUnparsedState(value);
	}

	setDeviceConfirmed(value: boolean): void {
		this.setDeviceConfirmedState(value);
	}

	async preparePin(provider: ProviderChoice): Promise<OperationResult> {
		const diagnosis = entityOf(this.diagnoses.resource());
		if (
			!diagnosis ||
			provider.diagnosisId !== diagnosis.diagnosisId ||
			!diagnosis.providers.some(
				(item) => item.providerId === provider.providerId,
			)
		) {
			return {
				ok: false,
				error: {
					code: "CHANGE_DIAGNOSIS_UNAVAILABLE",
					message: "provider does not belong to the current diagnosis",
				},
			};
		}
		this.invalidatePreview("pinTargetChanged", provider.providerId);
		return this.prepare(
			{ diagnosisId: diagnosis.diagnosisId, sourceId: provider.providerId },
			() =>
				this.gateway.preparePin(
					diagnosis.diagnosisId,
					provider.providerId,
					false,
				),
		);
	}

	async prepareRestore(snapshot: SnapshotRecord): Promise<OperationResult> {
		const diagnosis = entityOf(this.diagnoses.resource());
		if (!diagnosis) {
			return {
				ok: false,
				error: {
					code: "CHANGE_DIAGNOSIS_UNAVAILABLE",
					message: "restore requires a current diagnosis",
				},
			};
		}
		this.invalidatePreview("restoreTargetChanged", snapshot.snapshotId);
		return this.prepare(
			{ diagnosisId: diagnosis.diagnosisId, sourceId: snapshot.snapshotId },
			() =>
				this.gateway.prepareRestore(diagnosis.diagnosisId, snapshot.snapshotId),
		);
	}

	async createPlan(): Promise<OperationResult> {
		let current = entityOf(this.preview());
		if (!current || !this.riskConfirmed()) {
			return {
				ok: false,
				error: {
					code: "CHANGE_PREVIEW_BLOCKED",
					message: current
						? "preview risk is not confirmed"
						: "preview is unavailable",
				},
			};
		}
		const diagnosis = entityOf(this.diagnoses.resource());
		if (diagnosis?.diagnosisId !== current.sourceDiagnosisId) {
			return {
				ok: false,
				error: {
					code: "CHANGE_DIAGNOSIS_UNAVAILABLE",
					message: "diagnosis changed",
				},
			};
		}
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.planGeneration;
		const parent = {
			diagnosisId: current.sourceDiagnosisId,
			previewId: current.previewId,
		};
		this.setPlan({
			state: "resolving",
			requestId,
			parent,
			startedAtRevision: this.session.revision(),
		});
		try {
			const previewResource = this.preview();
			const previewParent =
				previewResource.state === "resolved"
					? previewResource.parent
					: undefined;
			if (
				current.kind === "pin" &&
				current.requiresUnparsedConfirmation &&
				this.allowUnparsed()
			) {
				current = await this.gateway.authorizePinPreview(current.previewId);
				if (requestGeneration !== this.planGeneration) {
					return { ok: true };
				}
				if (
					current.previewId !== parent.previewId ||
					current.sourceDiagnosisId !== parent.diagnosisId
				) {
					const error = {
						code: "SESSION_ENTITY_MISMATCH",
						message: "authorized preview does not match the current preview",
					};
					this.setPlan({ state: "failed", requestId, parent, error });
					return { ok: false, error };
				}
				if (!previewParent) {
					return { ok: true };
				}
				this.setPreview({
					state: "resolved",
					entity: current,
					parent: previewParent,
				});
			}
			if (current.blockers.length > 0) {
				const error = {
					code: "CHANGE_PREVIEW_BLOCKED",
					message: "preview contains blockers",
				};
				this.setPlan({ state: "failed", requestId, parent, error });
				return { ok: false, error };
			}
			const entity =
				current.kind === "pin"
					? await this.gateway.createPinPlan(current.previewId)
					: await this.gateway.createRestorePlan(current.previewId);
			if (requestGeneration !== this.planGeneration) {
				return { ok: true };
			}
			if (
				entity.sourcePreviewId !== current.previewId ||
				entity.sourceDiagnosisId !== parent.diagnosisId
			) {
				const error = {
					code: "SESSION_ENTITY_MISMATCH",
					message: "plan does not belong to its preview and diagnosis",
				};
				this.setPlan({ state: "failed", requestId, parent, error });
				return { ok: false, error };
			}
			this.setPlan({ state: "resolved", entity, parent });
			this.consumePreview(current);
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.planGeneration) {
				this.invalidatePreview("planCreationFailed", current.previewId);
			}
			return { ok: false, error };
		}
	}

	async execute(): Promise<OperationResult> {
		const current = entityOf(this.plan());
		if (!current || !this.deviceConfirmed()) {
			return {
				ok: false,
				error: {
					code: "CHANGE_PLAN_UNAVAILABLE",
					message: "plan is unavailable or unconfirmed",
				},
			};
		}
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.executionGeneration;
		const parent = {
			diagnosisId: current.sourceDiagnosisId,
			planId: current.planId,
		};
		this.setExecution({
			state: "resolving",
			requestId,
			parent,
			startedAtRevision: this.session.revision(),
		});
		try {
			const entity =
				current.kind === "pin"
					? await this.gateway.executePinPlan(current.planId)
					: await this.gateway.executeRestorePlan(current.planId);
			if (requestGeneration !== this.executionGeneration) {
				return { ok: true };
			}
			if (
				entity.planId !== current.planId ||
				entity.sourceDiagnosisId !== current.sourceDiagnosisId
			) {
				const error = {
					code: "SESSION_ENTITY_MISMATCH",
					message: "execution does not belong to its plan and diagnosis",
				};
				this.setExecution({ state: "failed", requestId, parent, error });
				this.finishPlan(current, "executionResponseMismatch");
				return { ok: false, error };
			}
			this.setExecution({ state: "resolved", entity, parent });
			this.finishPlan(current, "executionCompleted");
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.executionGeneration) {
				this.setExecution({ state: "failed", requestId, parent, error });
				this.finishPlan(current, "executionFailed");
			}
			return { ok: false, error };
		}
	}

	async cancelPlan(): Promise<OperationResult> {
		const current = entityOf(this.plan());
		if (!current) {
			return { ok: true };
		}
		try {
			const entity = await this.gateway.cancelChangePlan(current.planId);
			if (
				entity.planId !== current.planId ||
				entity.sourceDiagnosisId !== current.sourceDiagnosisId
			) {
				this.invalidatePreview("cancellationResponseMismatch", current.planId);
				return {
					ok: false,
					error: {
						code: "SESSION_ENTITY_MISMATCH",
						message: "cancellation does not belong to its plan",
					},
				};
			}
			const parent = {
				diagnosisId: current.sourceDiagnosisId,
				planId: current.planId,
			};
			this.setExecution({ state: "resolved", entity, parent });
			this.invalidatePreview("planCancelled", current.planId);
			return { ok: true };
		} catch (reason) {
			this.invalidatePreview("planCancellationFailed", current.planId);
			return { ok: false, error: errorFrom(reason) };
		}
	}

	closePreview(): void {
		this.invalidatePreview(
			"previewClosed",
			entityOf(this.preview())?.previewId ?? null,
		);
	}

	clearExecution(): void {
		this.invalidateExecution(
			"executionAcknowledged",
			entityOf(this.execution())?.executionId ?? null,
		);
	}

	[Symbol.dispose](): void {
		if (this.disposableStack.disposed) {
			return;
		}
		this.previewGeneration += 1;
		this.planGeneration += 1;
		this.executionGeneration += 1;
		this.disposableStack.dispose();
	}

	private async prepare(
		parent: PreviewParent,
		load: () => Promise<ChangePreview>,
	): Promise<OperationResult> {
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.previewGeneration;
		this.invalidatePlan("previewStarted", parent.sourceId);
		this.setRiskConfirmedState(false);
		this.setAllowUnparsedState(false);
		this.setDeviceConfirmedState(false);
		this.setPreview({
			state: "resolving",
			requestId,
			parent,
			startedAtRevision: this.session.revision(),
		});
		try {
			const entity = await load();
			const diagnosis = entityOf(this.diagnoses.resource());
			if (
				requestGeneration !== this.previewGeneration ||
				diagnosis?.diagnosisId !== parent.diagnosisId
			) {
				return { ok: true };
			}
			if (entity.sourceDiagnosisId !== parent.diagnosisId) {
				const error = {
					code: "SESSION_ENTITY_MISMATCH",
					message: "preview does not belong to its diagnosis",
				};
				this.setPreview({ state: "failed", requestId, parent, error });
				return { ok: false, error };
			}
			this.setPreview({ state: "resolved", entity, parent });
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.previewGeneration) {
				this.setPreview({ state: "failed", requestId, parent, error });
			}
			return { ok: false, error };
		}
	}

	private invalidateExecution(kind: string, sourceId: string | null): void {
		this.propagateExecutionInvalidation(
			cause(kind, sourceId, this.session.revision()),
		);
	}

	private propagateExecutionInvalidation(
		invalidation: InvalidationCause,
		preserveTerminal = false,
	): void {
		this.executionGeneration += 1;
		if (preserveTerminal && this.execution().state === "resolved") {
			return;
		}
		this.setExecution((current) => invalidateResource(current, invalidation));
	}

	private invalidatePlan(kind: string, sourceId: string | null): void {
		this.propagatePlanInvalidation(
			cause(kind, sourceId, this.session.revision()),
		);
	}

	private propagatePlanInvalidation(
		invalidation: InvalidationCause,
		preserveTerminalExecution = false,
	): void {
		this.planGeneration += 1;
		this.setPlan((current) => invalidateResource(current, invalidation));
		this.propagateExecutionInvalidation(
			invalidation,
			preserveTerminalExecution,
		);
	}

	private invalidatePreview(kind: string, sourceId: string | null): void {
		this.propagatePreviewInvalidation(
			cause(kind, sourceId, this.session.revision()),
		);
	}

	private propagatePreviewInvalidation(
		invalidation: InvalidationCause,
		preserveTerminalExecution = false,
	): void {
		this.previewGeneration += 1;
		this.setPreview((current) => invalidateResource(current, invalidation));
		this.setRiskConfirmedState(false);
		this.setAllowUnparsedState(false);
		this.setDeviceConfirmedState(false);
		this.propagatePlanInvalidation(invalidation, preserveTerminalExecution);
	}

	private finishPlan(current: ChangePlan, kind: string): void {
		this.planGeneration += 1;
		const invalidation = cause(kind, current.planId, this.session.revision());
		this.setPlan((resource) => invalidateResource(resource, invalidation));
	}

	private consumePreview(current: ChangePreview): void {
		this.previewGeneration += 1;
		const invalidation = cause(
			"previewConsumed",
			current.previewId,
			this.session.revision(),
		);
		this.setPreview((resource) => invalidateResource(resource, invalidation));
		this.setRiskConfirmedState(false);
		this.setAllowUnparsedState(false);
	}
}
