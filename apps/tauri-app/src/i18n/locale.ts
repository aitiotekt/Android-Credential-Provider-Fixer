import { createMemo, createSignal } from "solid-js";
import { type Locale, translations } from "./translations";

const STORAGE_KEY = "acp-fixer.locale";

export function resolveLocale(
	storedLocale: string | null,
	systemLocale: string,
): Locale {
	if (storedLocale === "en" || storedLocale === "zh") {
		return storedLocale;
	}
	return systemLocale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function createLocaleController() {
	const initialLocale = resolveLocale(
		window.localStorage.getItem(STORAGE_KEY),
		navigator.language,
	);
	const [locale, setLocaleSignal] = createSignal<Locale>(initialLocale);
	const messages = createMemo(() => translations[locale()]);

	const setLocale = (nextLocale: Locale) => {
		window.localStorage.setItem(STORAGE_KEY, nextLocale);
		document.documentElement.lang = nextLocale;
		setLocaleSignal(nextLocale);
	};

	document.documentElement.lang = initialLocale;

	return {
		locale,
		messages,
		setLocale,
	};
}
