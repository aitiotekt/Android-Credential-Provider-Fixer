import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { DiagnosisService } from "../domain/diagnosis-service";
import { en, zh } from "../i18n/messages";

export function App() {
	const service = new DiagnosisService(location.origin);
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
	const busy = () =>
		state().kind === "creating" || state().kind === "verifying";
	const canVerify = () => {
		const value = state();
		return (
			value.kind === "registered" ||
			(value.kind === "failed" && value.canVerify)
		);
	};
	const stage = () =>
		state().kind === "success"
			? 2
			: canVerify() || state().kind === "verifying"
				? 1
				: 0;
	const error = () => {
		const value = state();
		return value.kind === "failed" ? text().errors[value.error] : undefined;
	};

	return (
		<main class="mx-auto max-w-3xl space-y-6 px-5 py-8 sm:px-8 sm:py-12">
			<header class="flex flex-wrap items-center justify-between gap-4">
				<h1 class="text-3xl font-semibold tracking-tight">{text().title}</h1>
				<label class="flex items-center gap-2 text-sm">
					{text().language}
					<select
						value={language()}
						onChange={(e) => setLanguage(e.currentTarget.value)}
					>
						<option value="en">English</option>
						<option value="zh">中文</option>
					</select>
				</label>
			</header>
			<p class="text-muted">{text().intro}</p>
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
			<section
				class="space-y-5 rounded-2xl border border-line bg-panel p-5 sm:p-8"
				aria-busy={busy() ? "true" : "false"}
			>
				<h2 class="text-xl font-semibold" aria-live="polite">
					{busy()
						? text().working
						: state().kind === "success"
							? text().success
							: canVerify()
								? text().registered
								: text().ready}
				</h2>
				<Show when={error()}>
					{(message) => (
						<p role="alert" class="rounded-lg border border-line p-4">
							{message()}
						</p>
					)}
				</Show>
				<Show when={"name" in state()}>
					<p class="break-all font-mono text-sm text-muted">
						{text().testName}:{" "}
						{"name" in state() ? (state() as { name: string }).name : ""}
					</p>
				</Show>
				<Show when={canVerify()}>
					<p>{text().registeredHelp}</p>
				</Show>
				<Show when={state().kind === "success"}>
					<p role="status">{text().successHelp}</p>
				</Show>
				<Show when={!canVerify() && state().kind !== "success"}>
					<label class="flex items-start gap-3 rounded-lg bg-surface p-4 leading-relaxed">
						<input
							type="checkbox"
							checked={consent()}
							disabled={busy()}
							onChange={(e) => setConsent(e.currentTarget.checked)}
							class="mt-1 size-5 shrink-0 accent-teal-700"
						/>
						{text().consent}
					</label>
					<button
						type="button"
						disabled={!consent() || busy()}
						onClick={() => void service.register()}
					>
						{text().create}
					</button>
				</Show>
				<Show when={canVerify() || state().kind === "verifying"}>
					<button
						type="button"
						disabled={busy()}
						onClick={() => void service.authenticate()}
					>
						{text().verify}
					</button>
				</Show>
				<button
					type="button"
					class="secondary"
					onClick={() => {
						service.clear();
						setConsent(false);
					}}
				>
					{text().clear}
				</button>
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
