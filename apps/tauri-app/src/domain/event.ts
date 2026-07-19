import { type Observable, Subject } from "rxjs";
import { flush as flushSignals } from "solid-js";

export class DomainEvent<Value> extends Subject<Value> implements Disposable {
	emit(value: Value): void {
		// A subscriber must observe the publisher's committed Solid state.
		flushSignals();
		try {
			this.next(value);
		} finally {
			// Nested invalidation handlers commit before control returns to the
			// publisher, preserving synchronous domain-event semantics.
			flushSignals();
		}
	}

	[Symbol.dispose](): void {
		if (this.closed) {
			return;
		}
		this.complete();
		this.unsubscribe();
	}
}

export function observeDomainEvent<Value>(
	disposableStack: DisposableStack,
	event: Observable<Value>,
	handler: (value: Value) => void,
): void {
	disposableStack.adopt(event.subscribe(handler), (subscription) =>
		subscription.unsubscribe(),
	);
}
