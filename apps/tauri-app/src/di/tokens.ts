import { InjectionToken } from "injection-js";
import { type AppService } from "../application/app-service";
import { type AdbService } from "../domain/adb";
import { type BackendSessionService } from "../domain/backend-session";
import { type ChangeService } from "../domain/change";
import { type DeviceService } from "../domain/devices";
import { type DiagnosisService } from "../domain/diagnosis";
import { type AppGateway, type DeviceGateway } from "../domain/gateways";
import { type SnapshotService } from "../domain/snapshots";
import { type TutorialService } from "../domain/tutorial-service";
import { type WorkflowService } from "../domain/workflow";
import { type AdbSelection } from "../lib/tauri";

export const APP_GATEWAY = new InjectionToken<AppGateway>("APP_GATEWAY");
export const APP_SERVICE = new InjectionToken<AppService>("APP_SERVICE");
export const DEVICE_GATEWAY = new InjectionToken<DeviceGateway>(
	"DEVICE_GATEWAY",
);
export const INITIAL_ADB_SELECTION = new InjectionToken<
	AdbSelection | undefined
>("INITIAL_ADB_SELECTION");
export const BACKEND_SESSION_SERVICE =
	new InjectionToken<BackendSessionService>("BACKEND_SESSION_SERVICE");
export const ADB_SERVICE = new InjectionToken<AdbService>("ADB_SERVICE");
export const DEVICE_SERVICE = new InjectionToken<DeviceService>(
	"DEVICE_SERVICE",
);
export const DIAGNOSIS_SERVICE = new InjectionToken<DiagnosisService>(
	"DIAGNOSIS_SERVICE",
);
export const CHANGE_SERVICE = new InjectionToken<ChangeService>(
	"CHANGE_SERVICE",
);
export const SNAPSHOT_SERVICE = new InjectionToken<SnapshotService>(
	"SNAPSHOT_SERVICE",
);
export const WORKFLOW_SERVICE = new InjectionToken<WorkflowService>(
	"WORKFLOW_SERVICE",
);
export const TUTORIAL_SERVICE = new InjectionToken<TutorialService>(
	"TUTORIAL_SERVICE",
);
