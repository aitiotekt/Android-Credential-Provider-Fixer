import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	type Setter,
} from "solid-js";
import { type ThemePreference } from "../lib/tauri";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(
	preference: ThemePreference,
	systemDark: boolean,
): ResolvedTheme {
	return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function applyTheme(theme: ResolvedTheme) {
	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;
}

export class ThemeController implements Disposable {
	readonly preference: Accessor<ThemePreference>;
	readonly resolved: Accessor<ResolvedTheme>;
	private readonly setPreferenceState: Setter<ThemePreference>;
	private readonly media: MediaQueryList;
	private readonly onSystemThemeChange: (event: MediaQueryListEvent) => void;
	private disposed = false;

	constructor() {
		this.media = window.matchMedia("(prefers-color-scheme: dark)");
		const [systemDark, setSystemDark] = createSignal(this.media.matches);
		[this.preference, this.setPreferenceState] =
			createSignal<ThemePreference>("system");
		this.resolved = createMemo(() =>
			resolveTheme(this.preference(), systemDark()),
		);
		this.onSystemThemeChange = (event: MediaQueryListEvent) => {
			setSystemDark(event.matches);
		};

		this.media.addEventListener("change", this.onSystemThemeChange);
		createEffect(this.resolved, applyTheme);
		onCleanup(() => this[Symbol.dispose]());
	}

	setPreference(preference: ThemePreference): void {
		this.setPreferenceState(preference);
	}

	[Symbol.dispose](): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.media.removeEventListener("change", this.onSystemThemeChange);
	}
}
