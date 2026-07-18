import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
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

export function createThemeController() {
	const media = window.matchMedia("(prefers-color-scheme: dark)");
	const [preference, setPreference] = createSignal<ThemePreference>("system");
	const [systemDark, setSystemDark] = createSignal(media.matches);
	const resolved = createMemo(() => resolveTheme(preference(), systemDark()));
	const onSystemThemeChange = (event: MediaQueryListEvent) => {
		setSystemDark(event.matches);
	};

	media.addEventListener("change", onSystemThemeChange);
	createEffect(resolved, applyTheme);
	onCleanup(() => media.removeEventListener("change", onSystemThemeChange));

	return { preference, resolved, setPreference };
}
