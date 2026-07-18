import { describe, expect, it } from "vitest";
import { translations } from "../i18n/translations";
import { type ChangeBlocker } from "../lib/tauri";
import { blockerMessage } from "./App";

describe("change blocker messages", () => {
	const blockers: ChangeBlocker[] = [
		"ANDROID_VERSION_UNSUPPORTED",
		"DIAGNOSIS_UNAVAILABLE",
		"TARGET_NOT_REGISTERED",
		"UNPARSED_CONFIRMATION_REQUIRED",
		"STATE_CHANGED",
		"SNAPSHOT_NOT_RESTORABLE",
		"NO_CHANGE_REQUIRED",
	];

	it.each(blockers)(
		"localizes %s without falling back to an unknown state",
		(blocker) => {
			expect(blockerMessage(translations.en, blocker)).not.toBe(
				translations.en.unknownValue,
			);
			expect(blockerMessage(translations.zh, blocker)).not.toBe(
				translations.zh.unknownValue,
			);
		},
	);

	it("explains that an identical before and after state needs no write", () => {
		expect(blockerMessage(translations.zh, "NO_CHANGE_REQUIRED")).toContain(
			"无需写入设备或创建快照",
		);
	});
});
