import { invoke } from "@tauri-apps/api/core";

export type AppInfo = {
	productName: string;
	version: string;
	developmentPhase: string;
	adbOperationsEnabled: boolean;
};

export function getAppInfo(): Promise<AppInfo> {
	return invoke<AppInfo>("get_app_info");
}
