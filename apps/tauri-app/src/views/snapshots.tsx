import { For } from "solid-js";
import { useInjected } from "../di/context";
import { WORKFLOW_SERVICE } from "../di/tokens";
import { type Messages } from "../i18n/translations";
import { type SnapshotInventory } from "../lib/tauri";
import {
	Badge,
	Button,
	Card,
	CodeValue,
	Notice,
	Panel,
} from "../ui/primitives";

export function SnapshotsView(props: {
	messages: Messages;
	inventory: SnapshotInventory;
}) {
	const workflow = useInjected(WORKFLOW_SERVICE);
	return (
		<Panel class="grid gap-5">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h1 class="text-3xl font-bold">{props.messages.snapshotHistory}</h1>
				<Button onClick={() => workflow.closeSnapshots()}>
					{props.messages.back}
				</Button>
			</div>
			<For each={props.inventory.warnings}>
				{(warning) => (
					<Notice tone="warning">
						<strong>{props.messages.snapshotWarning}</strong>
						<span>{warning.message}</span>
					</Notice>
				)}
			</For>
			<div class="grid gap-3">
				<For
					each={props.inventory.snapshots}
					fallback={<p>{props.messages.noSnapshots}</p>}
				>
					{(snapshot) => (
						<Card class="grid gap-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<Badge>
									{props.messages.snapshotStatuses[snapshot.status]}
								</Badge>
								<span class="text-xs text-fg-muted">
									{new Date(snapshot.updatedAtUnixMs).toLocaleString()}
								</span>
							</div>
							<CodeValue>{snapshot.snapshotId}</CodeValue>
							<CodeValue>{snapshot.target.flattened}</CodeValue>
							<Button
								data-tour="preview-restore"
								disabled={
									!(["applied", "recoveryFailed"] as string[]).includes(
										snapshot.status,
									) || workflow.busy()
								}
								onClick={() => void workflow.prepareRestore(snapshot)}
							>
								{props.messages.previewRestore}
							</Button>
						</Card>
					)}
				</For>
			</div>
		</Panel>
	);
}
