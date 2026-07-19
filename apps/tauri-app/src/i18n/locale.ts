import { type Accessor, createMemo, createSignal, type Setter } from "solid-js";
import { type Locale, type Messages, translations } from "./translations";

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

export class LocaleController {
	readonly locale: Accessor<Locale>;
	readonly messages: Accessor<Messages>;
	private readonly setLocaleState: Setter<Locale>;

	constructor() {
		const initialLocale = resolveLocale(
			window.localStorage.getItem(STORAGE_KEY),
			navigator.language,
		);
		[this.locale, this.setLocaleState] = createSignal<Locale>(initialLocale);
		this.messages = createMemo(() => translations[this.locale()]);
		document.documentElement.lang = initialLocale;
	}

	setLocale(nextLocale: Locale): void {
		window.localStorage.setItem(STORAGE_KEY, nextLocale);
		document.documentElement.lang = nextLocale;
		this.setLocaleState(nextLocale);
	}
}
