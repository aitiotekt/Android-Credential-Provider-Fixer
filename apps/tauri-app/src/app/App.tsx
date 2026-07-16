import { createSignal, onSettled } from "solid-js";
import { createLocaleController } from "../i18n/locale";
import { type Messages } from "../i18n/translations";
import { type AppInfo, getAppInfo } from "../lib/tauri";

type ConnectionState =
	| { kind: "connecting" }
	| { kind: "connected"; info: AppInfo }
	| { kind: "error" };

function ConnectionPanel(props: {
	state: ConnectionState;
	messages: Messages;
}) {
	return (
		<section class="connection-panel" aria-live="polite">
			<div>
				<p class="connection-label">{props.messages.backend}</p>
				<strong
					class={`connection-state ${
						props.state.kind === "connecting"
							? "is-pending"
							: props.state.kind === "connected"
								? "is-connected"
								: "is-error"
					}`}
				>
					{props.state.kind === "connecting"
						? props.messages.connecting
						: props.state.kind === "connected"
							? props.messages.connected
							: props.messages.unavailable}
				</strong>
			</div>
			{props.state.kind === "connected" ? (
				<dl class="metadata">
					<div>
						<dt>{props.messages.version}</dt>
						<dd>{props.state.info.version}</dd>
					</div>
					<div>
						<dt>{props.messages.phase}</dt>
						<dd>{props.state.info.developmentPhase}</dd>
					</div>
				</dl>
			) : null}
		</section>
	);
}

export function App() {
	const i18n = createLocaleController();
	const text = i18n.messages;
	const [connection, setConnection] = createSignal<ConnectionState>({
		kind: "connecting",
	});

	onSettled(() => {
		void getAppInfo()
			.then((info) => setConnection({ kind: "connected", info }))
			.catch(() => setConnection({ kind: "error" }));
	});

	return (
		<main class="app-shell">
			<header class="app-header">
				<img class="brand-mark" src="/app-icon.png" alt="" />
				<label class="language-picker">
					<span>{text().language}</span>
					<select
						value={i18n.locale()}
						onInput={(event) =>
							i18n.setLocale(event.currentTarget.value as "en" | "zh")
						}
					>
						<option value="en">{text().english}</option>
						<option value="zh">{text().chinese}</option>
					</select>
				</label>
			</header>

			<section class="hero" aria-labelledby="page-title">
				<p class="eyebrow">{text().eyebrow}</p>
				<h1 id="page-title">{text().title}</h1>
				<p class="summary">{text().summary}</p>
			</section>

			<section class="status-grid" aria-label={text().baselineTitle}>
				<article class="status-card status-card-primary">
					<div class="status-icon" aria-hidden="true">
						01
					</div>
					<h2>{text().baselineTitle}</h2>
					<p>{text().baselineBody}</p>
				</article>
				<article class="status-card">
					<div class="status-icon" aria-hidden="true">
						02
					</div>
					<h2>{text().localOnly}</h2>
					<p>{text().localOnlyBody}</p>
				</article>
			</section>

			<ConnectionPanel state={connection()} messages={text()} />

			<footer>{text().readOnlyNotice}</footer>
		</main>
	);
}
