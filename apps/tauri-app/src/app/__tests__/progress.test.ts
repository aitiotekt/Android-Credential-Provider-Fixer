import { describe, expect, it } from "vitest";
import { translations } from "../../i18n/translations";
import { progressItems, type WorkflowStep } from "../App";

describe("workflow progress", () => {
	const expectedIndex: Record<WorkflowStep, number> = {
		welcome: 0,
		adb: 0,
		devices: 1,
		confirm: 2,
		diagnosing: 2,
		result: 2,
		plan: 3,
		planConfirm: 3,
		applying: 3,
		snapshots: 3,
		outcome: 4,
	};

	for (const [step, currentIndex] of Object.entries(expectedIndex)) {
		it(`marks exactly one current stage for ${step}`, () => {
			const items = progressItems(step as WorkflowStep, false, translations.en);
			expect(items.filter((item) => item.state === "current")).toHaveLength(1);
			expect(items[currentIndex]?.state).toBe("current");
			expect(
				items
					.slice(0, currentIndex)
					.every((item) => item.state === "completed"),
			).toBe(true);
			expect(
				items
					.slice(currentIndex + 1)
					.every((item) => item.state === "upcoming"),
			).toBe(true);
		});
	}

	it("uses the restore label for the fourth stage", () => {
		expect(progressItems("plan", true, translations.zh)[3]?.label).toBe("恢复");
	});
});
