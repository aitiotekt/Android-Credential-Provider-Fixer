import { type Accessor, createSignal, type Setter } from "solid-js";
import { type DeviceChoice, type DeviceList } from "../lib/tauri";
import { type AdbService } from "./adb";
import { type BackendSessionService } from "./backend-session";
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

type EnumerationParent = { selectionId: string };
export type DeviceSelectionEntity = {
	selectionId: string;
	enumerationId: string;
	deviceId: string;
	selectedAtUnixMs: number;
	device: DeviceChoice;
};
type DeviceParent = { enumerationId: string };

export class DeviceService implements Disposable {
	readonly enumeration: Accessor<EntityResource<DeviceList, EnumerationParent>>;
	readonly selection: Accessor<
		EntityResource<DeviceSelectionEntity, DeviceParent>
	>;
	private readonly setEnumeration: Setter<
		EntityResource<DeviceList, EnumerationParent>
	>;
	private readonly setSelection: Setter<
		EntityResource<DeviceSelectionEntity, DeviceParent>
	>;
	private enumerationGeneration = 0;
	private readonly disposableStack = new DisposableStack();
	private readonly enumerationChangedEvent = this.disposableStack.use(
		new DomainEvent<{ enumerationId: string; revision: number }>(),
	);
	private readonly enumerationInvalidatedEvent = this.disposableStack.use(
		new DomainEvent<{ cause: InvalidationCause }>(),
	);
	private readonly selectionChangedEvent = this.disposableStack.use(
		new DomainEvent<{
			enumerationId: string;
			deviceId: string;
			revision: number;
		}>(),
	);
	private readonly selectionInvalidatedEvent = this.disposableStack.use(
		new DomainEvent<{ cause: InvalidationCause }>(),
	);
	/** @internal Domain-service collaboration only. */
	readonly enumerationChanged = this.enumerationChangedEvent.asObservable();
	/** @internal Domain-service collaboration only. */
	readonly enumerationInvalidated =
		this.enumerationInvalidatedEvent.asObservable();
	/** @internal Domain-service collaboration only. */
	readonly selectionChanged = this.selectionChangedEvent.asObservable();
	/** @internal Domain-service collaboration only. */
	readonly selectionInvalidated = this.selectionInvalidatedEvent.asObservable();

	constructor(
		private readonly gateway: DeviceGateway,
		private readonly session: BackendSessionService,
		private readonly adb: AdbService,
	) {
		[this.enumeration, this.setEnumeration] = createSignal<
			EntityResource<DeviceList, EnumerationParent>
		>({ state: "idle" });
		[this.selection, this.setSelection] = createSignal<
			EntityResource<DeviceSelectionEntity, DeviceParent>
		>({ state: "idle" });
		observeDomainEvent(
			this.disposableStack,
			this.adb.selectionChanged,
			(event) =>
				this.invalidateEnumeration("adbSelectionChanged", event.selectionId),
		);
		observeDomainEvent(
			this.disposableStack,
			this.adb.selectionInvalidated,
			(event) => {
				this.enumerationGeneration += 1;
				this.propagateEnumerationInvalidation(event.cause);
			},
		);
	}

	async list(): Promise<OperationResult> {
		const adbSelection = entityOf(this.adb.selection());
		if (!adbSelection) {
			return {
				ok: false,
				error: { code: "ADB_SELECTION_STALE", message: "ADB is not current" },
			};
		}
		const requestId = crypto.randomUUID();
		const requestGeneration = ++this.enumerationGeneration;
		this.invalidateSelection("enumerationStarted", adbSelection.selectionId);
		const parent = { selectionId: adbSelection.selectionId };
		this.setEnumeration({
			state: "resolving",
			requestId,
			parent,
			startedAtRevision: this.session.revision(),
		});
		try {
			const entity = await this.gateway.listDevices(adbSelection.selectionId);
			const currentAdb = entityOf(this.adb.selection());
			if (
				requestGeneration !== this.enumerationGeneration ||
				currentAdb?.selectionId !== adbSelection.selectionId
			) {
				return { ok: true };
			}
			if (entity.selectionId !== adbSelection.selectionId) {
				const error = {
					code: "SESSION_ENTITY_MISMATCH",
					message: "device enumeration does not belong to its ADB selection",
				};
				this.setEnumeration({ state: "failed", requestId, parent, error });
				return { ok: false, error };
			}
			this.setEnumeration({ state: "resolved", entity, parent });
			this.session.observeRevision(entity.sessionRevision);
			this.enumerationChangedEvent.emit({
				enumerationId: entity.enumerationId,
				revision: entity.sessionRevision,
			});
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			if (requestGeneration === this.enumerationGeneration) {
				this.setEnumeration({ state: "failed", requestId, parent, error });
			}
			return { ok: false, error };
		}
	}

	select(device: DeviceChoice): OperationResult {
		const current = entityOf(this.enumeration());
		if (!current?.devices.some((item) => item.deviceId === device.deviceId)) {
			return {
				ok: false,
				error: { code: "DEVICE_CHANGED", message: "device is not current" },
			};
		}
		if (device.state !== "device") {
			const codes = {
				unauthorized: "DEVICE_UNAUTHORIZED",
				offline: "DEVICE_OFFLINE",
				noPermissions: "DEVICE_NO_PERMISSIONS",
				unknown: "DEVICE_UNKNOWN",
			} as const;
			return {
				ok: false,
				error: { code: codes[device.state], message: device.state },
			};
		}
		this.invalidateSelection("deviceSelectionChanged", device.deviceId);
		const entity: DeviceSelectionEntity = {
			selectionId: crypto.randomUUID(),
			enumerationId: current.enumerationId,
			deviceId: device.deviceId,
			selectedAtUnixMs: Date.now(),
			device,
		};
		this.setSelection({
			state: "resolved",
			entity,
			parent: { enumerationId: current.enumerationId },
		});
		this.selectionChangedEvent.emit({
			enumerationId: current.enumerationId,
			deviceId: device.deviceId,
			revision: this.session.revision(),
		});
		return { ok: true };
	}

	clearSelection(kind = "navigationToDevices"): void {
		this.invalidateSelection(
			kind,
			entityOf(this.selection())?.deviceId ?? null,
		);
	}

	clearEnumeration(kind = "navigationToAdb"): void {
		this.invalidateEnumeration(
			kind,
			entityOf(this.enumeration())?.enumerationId ?? null,
		);
	}

	[Symbol.dispose](): void {
		if (this.disposableStack.disposed) {
			return;
		}
		this.enumerationGeneration += 1;
		this.disposableStack.dispose();
	}

	private invalidateSelection(kind: string, sourceId: string | null): void {
		this.propagateSelectionInvalidation(
			cause(kind, sourceId, this.session.revision()),
		);
	}

	private propagateSelectionInvalidation(
		invalidation: InvalidationCause,
	): void {
		this.setSelection((current) => invalidateResource(current, invalidation));
		this.selectionInvalidatedEvent.emit({
			cause: invalidation,
		});
	}

	private invalidateEnumeration(kind: string, sourceId: string | null): void {
		this.enumerationGeneration += 1;
		this.propagateEnumerationInvalidation(
			cause(kind, sourceId, this.session.revision()),
		);
	}

	private propagateEnumerationInvalidation(
		invalidation: InvalidationCause,
	): void {
		this.setEnumeration((current) => invalidateResource(current, invalidation));
		this.enumerationInvalidatedEvent.emit({
			cause: invalidation,
		});
		this.propagateSelectionInvalidation(invalidation);
	}
}
