import { type Accessor, createSignal, type Setter } from "solid-js";
import { type AppGateway } from "../domain/gateways";
import { errorFrom, type OperationResult } from "../domain/resource";
import { LocaleController } from "../i18n/locale";
import { type Locale, type Messages } from "../i18n/translations";
import {
	type AppInfo,
	type DemoFixture,
	type ErrorEnvelope,
	type OnboardingStatus,
	type StartupState,
	type ThemePreference,
} from "../lib/tauri";
import { type ResolvedTheme, ThemeController } from "../theme/theme";

export type AppResource =
	| { state: "loading" }
	| { state: "ready"; info: AppInfo; startup: StartupState }
	| { state: "failed"; error: ErrorEnvelope };

export class AppService implements Disposable {
	readonly resource: Accessor<AppResource>;
	readonly messages: Accessor<Messages>;
	readonly locale: Accessor<Locale>;
	readonly themePreference: Accessor<ThemePreference>;
	readonly resolvedTheme: Accessor<ResolvedTheme>;
	readonly preferenceSaving: Accessor<boolean>;
	private readonly setResource: Setter<AppResource>;
	private readonly setPreferenceSaving: Setter<boolean>;
	private readonly i18n = new LocaleController();
	private readonly theme = new ThemeController();

	constructor(private readonly gateway: AppGateway) {
		[this.resource, this.setResource] = createSignal<AppResource>({
			state: "loading",
		});
		[this.preferenceSaving, this.setPreferenceSaving] = createSignal(false);
		this.messages = this.i18n.messages;
		this.locale = this.i18n.locale;
		this.themePreference = this.theme.preference;
		this.resolvedTheme = this.theme.resolved;
	}

	async initialize(): Promise<OperationResult> {
		try {
			const [info, startup] = await Promise.all([
				this.gateway.getAppInfo(),
				this.gateway.getStartupState(),
			]);
			this.theme.setPreference(startup.themePreference);
			this.setResource({ state: "ready", info, startup });
			return { ok: true };
		} catch (reason) {
			const error = errorFrom(reason);
			this.setResource({ state: "failed", error });
			return { ok: false, error };
		}
	}

	setLocale(locale: Locale): void {
		this.i18n.setLocale(locale);
	}

	async setTheme(preference: ThemePreference): Promise<OperationResult> {
		const previous = this.theme.preference();
		this.theme.setPreference(preference);
		this.setPreferenceSaving(true);
		try {
			const startup = await this.gateway.setThemePreference(preference);
			this.theme.setPreference(startup.themePreference);
			this.setResource((current) =>
				current.state === "ready" ? { ...current, startup } : current,
			);
			return { ok: true };
		} catch (reason) {
			this.theme.setPreference(previous);
			return { ok: false, error: errorFrom(reason) };
		} finally {
			this.setPreferenceSaving(false);
		}
	}

	async setOnboarding(status: OnboardingStatus): Promise<OperationResult> {
		try {
			const startup = await this.gateway.setOnboardingStatus(status);
			this.setResource((current) =>
				current.state === "ready" ? { ...current, startup } : current,
			);
			return { ok: true };
		} catch (reason) {
			return { ok: false, error: errorFrom(reason) };
		}
	}

	loadDemoFixture(): Promise<DemoFixture> {
		return this.gateway.getDemoFixture();
	}

	[Symbol.dispose](): void {
		this.theme[Symbol.dispose]();
	}
}
