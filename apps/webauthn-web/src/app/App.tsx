import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import {
	DiagnosisService,
	TestMode,
	TestStateKind,
} from "../domain/diagnosis-service";
import { en, zh } from "../i18n/messages";

export function App() {
	const service = new DiagnosisService(
		location.origin,
		new URLSearchParams(location.search).get("scene"),
	);
	onCleanup(() => service[Symbol.dispose]());
	const [language, setLanguage] = createSignal(
		navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en",
	);
	const [consent, setConsent] = createSignal(false);
	const text = () => (language() === "zh" ? zh : en);
	createEffect(
		() => ({ language: language(), title: text().title }),
		(value) => {
			document.documentElement.lang = value.language;
			document.title = value.title;
		},
	);
	const state = service.state;
	const busy = () => service.isBusy();
	const explore = () => service.mode() === TestMode.Explore;
	const canVerify = () => {
		const value = state();
		return (
			value.kind === TestStateKind.Registered ||
			(value.kind === TestStateKind.Failed && value.canVerify)
		);
	};
	const clear = () => {
		service.clear();
		setConsent(false);
	};
	const stage = () =>
		state().kind === TestStateKind.Success
			? 2
			: canVerify() || state().kind === TestStateKind.Verifying
				? 1
				: 0;
	const error = () => {
		const value = state();
		return value.kind === TestStateKind.Failed
			? text().errors[value.error]
			: undefined;
	};

	const summary = () => {
		const value = state();
		switch (value.kind) {
			case TestStateKind.Failed:
				return text().errors[value.error].summary;
			case TestStateKind.Creating:
				return text().creating;
			case TestStateKind.Verifying:
				return text().verifying;
			case TestStateKind.Registered:
				return text().registered;
			case TestStateKind.Success:
				return text().success;
			case TestStateKind.Cleared:
				return text().cleared;
			case TestStateKind.Ready:
				return text().ready;
		}
	};

	return (
		<main class="mx-auto max-w-3xl space-y-6 px-5 py-8 sm:px-8 sm:py-12">
			<header class="flex flex-wrap items-center justify-between gap-4">
				<h1 class="text-3xl font-semibold tracking-tight">{text().title}</h1>
				<label class="flex items-center gap-2 text-sm">
					{text().language}
					<select
						aria-label={text().language}
						value={language()}
						onChange={(e) => setLanguage(e.currentTarget.value)}
					>
						<option value="en">English</option>
						<option value="zh">中文</option>
					</select>
				</label>
			</header>
			<p class="text-muted">{text().intro}</p>
			<fieldset
				class="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-3"
				aria-label={text().mode}
			>
				<legend class="px-2 text-sm font-medium">{text().mode}</legend>
				<For each={[TestMode.Explore, TestMode.Guided]}>
					{(mode) => (
						<button
							type="button"
							class={service.mode() === mode ? "" : "secondary"}
							aria-pressed={service.mode() === mode ? "true" : "false"}
							disabled={busy()}
							onClick={() => service.setMode(mode)}
						>
							{mode === TestMode.Explore ? text().explore : text().guided}
						</button>
					)}
				</For>
			</fieldset>
			<p class="text-muted">
				{explore() ? text().exploreHelp : text().guidedHelp}
			</p>
			<Show when={!explore()}>
				<ol class="grid grid-cols-3 gap-3" aria-label={text().title}>
					<For each={[text().stepCreate, text().stepVerify, text().stepFinish]}>
						{(label, index) => (
							<li
								aria-current={stage() === index() ? "step" : undefined}
								class={`rounded-lg border border-line p-3 text-sm ${stage() === index() ? "bg-accent text-white" : ""}`}
							>
								{index() + 1}. {label}
							</li>
						)}
					</For>
				</ol>
			</Show>
			<section
				class="space-y-5 rounded-2xl border border-line bg-panel p-5 sm:p-8"
				aria-busy={busy() ? "true" : "false"}
			>
				<div
					role={error() ? "alert" : "status"}
					aria-atomic="true"
					data-result={state().kind}
					class="test-result space-y-3 rounded-lg border border-l-4 p-4 sm:p-5"
				>
					<h2 class="text-xl font-bold sm:text-2xl">{summary()}</h2>
					<Show when={error()}>{(message) => <p>{message().detail}</p>}</Show>
					<Show when={busy()}>
						<p>{text().workingHelp}</p>
					</Show>
					<Show when={state().kind === TestStateKind.Registered}>
						<p>{text().registeredHelp}</p>
					</Show>
					<Show when={state().kind === TestStateKind.Cleared}>
						<p>{text().clearedHelp}</p>
					</Show>
					<Show when={state().kind === TestStateKind.Success}>
						<p>{text().successHelp}</p>
						<Show when={service.isAndroidScene}>
							<p>{text().androidReturn}</p>
						</Show>
					</Show>
				</div>
				<Show when={explore()}>
					<div class="space-y-2">
						<label for="test-username" class="block text-sm font-medium">
							{text().username}
						</label>
						<input
							id="test-username"
							type="text"
							autocomplete="off"
							autocapitalize="none"
							spellcheck={false}
							maxlength={64}
							placeholder={text().usernamePlaceholder}
							value={service.username()}
							disabled={busy()}
							aria-describedby="username-help"
							onInput={(event) =>
								service.setUsername(event.currentTarget.value)
							}
							class="w-full min-w-0"
						/>
						<p id="username-help" class="text-sm text-muted">
							{text().usernameHelp}
						</p>
					</div>
				</Show>
				<Show when={!explore() && service.username()}>
					<p class="break-all font-mono text-sm text-muted">
						{text().testName}: {service.username()}
					</p>
				</Show>
				<Show
					when={
						explore() ||
						(!canVerify() && state().kind !== TestStateKind.Success)
					}
				>
					<label class="flex items-start gap-3 rounded-lg bg-surface p-4 leading-relaxed">
						<input
							type="checkbox"
							checked={consent()}
							disabled={busy()}
							onChange={(e) => setConsent(e.currentTarget.checked)}
							class="mt-1 size-5 shrink-0 accent-accent"
						/>
						{text().consent}
					</label>
				</Show>
				<div class="flex flex-wrap gap-3">
					<Show
						when={
							explore() ||
							(!canVerify() && state().kind !== TestStateKind.Success)
						}
					>
						<button
							type="button"
							disabled={
								!consent() ||
								busy() ||
								(explore() && !service.username().trim())
							}
							onClick={() => void service.register()}
						>
							{text().create}
						</button>
					</Show>
					<Show
						when={
							explore() ||
							canVerify() ||
							state().kind === TestStateKind.Verifying
						}
					>
						<button
							type="button"
							disabled={!service.canAuthenticate()}
							onClick={() => void service.authenticate()}
						>
							{text().verify}
						</button>
					</Show>
					<button type="button" class="secondary" onClick={clear}>
						{!explore() && state().kind === TestStateKind.Success
							? text().restart
							: text().clear}
					</button>
				</div>
			</section>
			<section class="space-y-3 rounded-2xl border border-line p-5 text-sm leading-relaxed sm:p-8">
				<h2 class="text-lg font-semibold">{text().privacyTitle}</h2>
				<p>{text().privacy}</p>
				<p>{text().cleanup}</p>
				<p class="text-muted">{text().hosting}</p>
			</section>
			<footer class="space-y-3 text-sm text-muted">
				<p>{text().help}</p>
				<a href="/docs/000-OVERVIEW">{text().desktop}</a>
			</footer>
		</main>
	);
}
