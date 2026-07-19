import { type Provider, ReflectiveInjector } from "injection-js";
import { createRoot } from "solid-js";
import { AppService } from "../application/app-service";
import { AdbService } from "../domain/adb";
import { BackendSessionService } from "../domain/backend-session";
import { ChangeService } from "../domain/change";
import { DeviceService } from "../domain/devices";
import { DiagnosisService } from "../domain/diagnosis";
import { type AppGateway, type DeviceGateway } from "../domain/gateways";
import { SnapshotService } from "../domain/snapshots";
import { TutorialService } from "../domain/tutorial-service";
import { WorkflowService } from "../domain/workflow";
import { type AdbSelection } from "../lib/tauri";
import {
	ADB_SERVICE,
	APP_GATEWAY,
	APP_SERVICE,
	BACKEND_SESSION_SERVICE,
	CHANGE_SERVICE,
	DEVICE_GATEWAY,
	DEVICE_SERVICE,
	DIAGNOSIS_SERVICE,
	INITIAL_ADB_SELECTION,
	SNAPSHOT_SERVICE,
	TUTORIAL_SERVICE,
	WORKFLOW_SERVICE,
} from "./tokens";

export function provideAppGateway(gateway: AppGateway): Provider {
	return { provide: APP_GATEWAY, useValue: gateway };
}

export function provideAppService(): Provider {
	return {
		provide: APP_SERVICE,
		useFactory: (gateway: AppGateway) => new AppService(gateway),
		deps: [APP_GATEWAY],
	};
}

export function provideDeviceGateway(gateway: DeviceGateway): Provider {
	return { provide: DEVICE_GATEWAY, useValue: gateway };
}

export function provideBackendSessionService(): Provider {
	return {
		provide: BACKEND_SESSION_SERVICE,
		useFactory: (gateway: DeviceGateway) => new BackendSessionService(gateway),
		deps: [DEVICE_GATEWAY],
	};
}

export function provideAdbService(): Provider {
	return {
		provide: ADB_SERVICE,
		useFactory: (
			gateway: DeviceGateway,
			session: BackendSessionService,
			initialSelection?: AdbSelection,
		) => new AdbService(gateway, session, initialSelection),
		deps: [DEVICE_GATEWAY, BACKEND_SESSION_SERVICE, INITIAL_ADB_SELECTION],
	};
}

export function provideDeviceService(): Provider {
	return {
		provide: DEVICE_SERVICE,
		useFactory: (
			gateway: DeviceGateway,
			session: BackendSessionService,
			adb: AdbService,
		) => new DeviceService(gateway, session, adb),
		deps: [DEVICE_GATEWAY, BACKEND_SESSION_SERVICE, ADB_SERVICE],
	};
}

export function provideDiagnosisService(): Provider {
	return {
		provide: DIAGNOSIS_SERVICE,
		useFactory: (
			gateway: DeviceGateway,
			session: BackendSessionService,
			devices: DeviceService,
		) => new DiagnosisService(gateway, session, devices),
		deps: [DEVICE_GATEWAY, BACKEND_SESSION_SERVICE, DEVICE_SERVICE],
	};
}

export function provideChangeService(): Provider {
	return {
		provide: CHANGE_SERVICE,
		useFactory: (
			gateway: DeviceGateway,
			session: BackendSessionService,
			diagnoses: DiagnosisService,
		) => new ChangeService(gateway, session, diagnoses),
		deps: [DEVICE_GATEWAY, BACKEND_SESSION_SERVICE, DIAGNOSIS_SERVICE],
	};
}

export function provideSnapshotService(): Provider {
	return {
		provide: SNAPSHOT_SERVICE,
		useFactory: (
			gateway: DeviceGateway,
			session: BackendSessionService,
			diagnoses: DiagnosisService,
		) => new SnapshotService(gateway, session, diagnoses),
		deps: [DEVICE_GATEWAY, BACKEND_SESSION_SERVICE, DIAGNOSIS_SERVICE],
	};
}

export function provideWorkflowService(): Provider {
	return {
		provide: WORKFLOW_SERVICE,
		useFactory: (
			session: BackendSessionService,
			adb: AdbService,
			devices: DeviceService,
			diagnoses: DiagnosisService,
			changes: ChangeService,
			snapshots: SnapshotService,
		) =>
			new WorkflowService(session, adb, devices, diagnoses, changes, snapshots),
		deps: [
			BACKEND_SESSION_SERVICE,
			ADB_SERVICE,
			DEVICE_SERVICE,
			DIAGNOSIS_SERVICE,
			CHANGE_SERVICE,
			SNAPSHOT_SERVICE,
		],
	};
}

export function provideTutorialService(): Provider {
	return {
		provide: TUTORIAL_SERVICE,
		useFactory: (
			workflow: WorkflowService,
			devices: DeviceService,
			diagnoses: DiagnosisService,
			snapshots: SnapshotService,
		) => new TutorialService(workflow, devices, diagnoses, snapshots),
		deps: [
			WORKFLOW_SERVICE,
			DEVICE_SERVICE,
			DIAGNOSIS_SERVICE,
			SNAPSHOT_SERVICE,
		],
	};
}

export function createRootInjector(gateway: AppGateway): ReflectiveInjector {
	return ReflectiveInjector.resolveAndCreate([
		provideAppGateway(gateway),
		provideAppService(),
	]);
}

export type SessionScope = Disposable & {
	id: string;
	injector: ReflectiveInjector;
};

export function createSessionScope(
	parent: ReflectiveInjector,
	gateway: DeviceGateway,
	initialSelection?: AdbSelection,
): SessionScope {
	const id = crypto.randomUUID();
	return createRoot((disposeOwner) => {
		const injector = parent.resolveAndCreateChild([
			provideDeviceGateway(gateway),
			{ provide: INITIAL_ADB_SELECTION, useValue: initialSelection },
			provideBackendSessionService(),
			provideAdbService(),
			provideDeviceService(),
			provideDiagnosisService(),
			provideChangeService(),
			provideSnapshotService(),
			provideWorkflowService(),
			provideTutorialService(),
		]);
		using constructionStack = new DisposableStack();
		// Register the Solid owner first so services are released before their
		// reactive owner disappears (LIFO order).
		constructionStack.defer(disposeOwner);
		constructionStack.use(injector.get(BACKEND_SESSION_SERVICE));
		constructionStack.use(injector.get(ADB_SERVICE));
		constructionStack.use(injector.get(DEVICE_SERVICE));
		constructionStack.use(injector.get(DIAGNOSIS_SERVICE));
		constructionStack.use(injector.get(CHANGE_SERVICE));
		constructionStack.use(injector.get(SNAPSHOT_SERVICE));
		constructionStack.use(injector.get(WORKFLOW_SERVICE));
		constructionStack.use(injector.get(TUTORIAL_SERVICE));
		const disposableStack = constructionStack.move();
		return {
			id,
			injector,
			[Symbol.dispose]() {
				disposableStack.dispose();
			},
		};
	});
}
