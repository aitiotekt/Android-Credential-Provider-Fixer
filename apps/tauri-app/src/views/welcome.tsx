import { type Messages } from "../i18n/translations";
import { Badge, Button, Card, Panel } from "../ui/primitives";

export function WelcomeView(props: {
	messages: Messages;
	onStart: () => void;
	onDemo: () => void;
}) {
	return (
		<Panel class="grid gap-6">
			<Badge tone="accent">{props.messages.appReady}</Badge>
			<div class="grid max-w-3xl gap-3">
				<h1 class="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
					{props.messages.welcomeTitle}
				</h1>
				<p class="text-base leading-7 text-fg-muted">
					{props.messages.welcomeBody}
				</p>
			</div>
			<div class="flex flex-wrap gap-3">
				<Button variant="solid" size="lg" onClick={props.onStart}>
					{props.messages.startDiagnosis}
				</Button>
				<Button size="lg" onClick={props.onDemo}>
					{props.messages.openDemo}
				</Button>
			</div>
			<div class="grid gap-4 md:grid-cols-2">
				<Card>
					<h2 class="font-semibold">{props.messages.localOnly}</h2>
					<p class="mt-2 text-sm leading-6 text-fg-muted">
						{props.messages.localOnlyBody}
					</p>
				</Card>
				<Card>
					<h2 class="font-semibold">{props.messages.safetyTitle}</h2>
					<p class="mt-2 text-sm leading-6 text-fg-muted">
						{props.messages.safetyBody}
					</p>
				</Card>
			</div>
		</Panel>
	);
}
