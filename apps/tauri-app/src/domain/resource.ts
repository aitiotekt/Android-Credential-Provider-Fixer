import { type ErrorEnvelope } from "../lib/tauri";

export type ParentReference = object;

export type InvalidationCause = {
	eventId: string;
	kind: string;
	sourceEntityId: string | null;
	sourceRevision: number;
	occurredAtUnixMs: number;
};

export type EntityResource<
	T,
	Parent extends ParentReference = ParentReference,
> =
	| { state: "idle" }
	| {
			state: "resolving";
			requestId: string;
			parent: Parent;
			startedAtRevision: number;
	  }
	| { state: "resolved"; entity: T; parent: Parent }
	| {
			state: "failed";
			requestId: string;
			parent: Parent;
			error: ErrorEnvelope;
	  }
	| {
			state: "invalidated";
			lastEntity?: T;
			parent?: Parent;
			cause: InvalidationCause;
	  };

export function entityOf<T, Parent extends ParentReference>(
	resource: EntityResource<T, Parent>,
): T | undefined {
	return resource.state === "resolved" ? resource.entity : undefined;
}

export function lastEntityOf<T, Parent extends ParentReference>(
	resource: EntityResource<T, Parent>,
): T | undefined {
	if (resource.state === "resolved") {
		return resource.entity;
	}
	return resource.state === "invalidated" ? resource.lastEntity : undefined;
}

export function invalidateResource<T, Parent extends ParentReference>(
	resource: EntityResource<T, Parent>,
	cause: InvalidationCause,
): EntityResource<T, Parent> {
	if (resource.state === "idle") {
		return resource;
	}
	if (resource.state === "invalidated") {
		return { ...resource, cause };
	}
	return {
		state: "invalidated",
		lastEntity: resource.state === "resolved" ? resource.entity : undefined,
		parent: resource.parent,
		cause,
	};
}

export function cause(
	kind: string,
	sourceEntityId: string | null,
	sourceRevision: number,
): InvalidationCause {
	return {
		eventId: crypto.randomUUID(),
		kind,
		sourceEntityId,
		sourceRevision,
		occurredAtUnixMs: Date.now(),
	};
}

export type OperationResult =
	| { ok: true }
	| { ok: false; error: ErrorEnvelope };

export function errorFrom(reason: unknown): ErrorEnvelope {
	if (
		typeof reason === "object" &&
		reason !== null &&
		"code" in reason &&
		"message" in reason
	) {
		return reason as ErrorEnvelope;
	}
	return {
		code: "UNEXPECTED_ERROR",
		message: reason instanceof Error ? reason.message : String(reason),
	};
}
