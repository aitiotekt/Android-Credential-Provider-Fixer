import { type InjectionToken, type Injector } from "injection-js";
import { createContext, type ParentProps, untrack, useContext } from "solid-js";

const InjectorContext = createContext<Injector>();

export function InjectorProvider(props: ParentProps<{ injector: Injector }>) {
	const injector = untrack(() => props.injector);
	return <InjectorContext value={injector}>{props.children}</InjectorContext>;
}

export function useInjected<T>(token: InjectionToken<T>): T {
	const injector = useContext(InjectorContext);
	return injector.get(token);
}
