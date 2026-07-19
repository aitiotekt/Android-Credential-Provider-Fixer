import { describe, expect, it } from "vitest";
import { translations } from "../translations";

describe("GUI translations", () => {
	it("keeps English and Chinese message keys symmetric", () => {
		const paths = (value: object, prefix = ""): string[] =>
			Object.entries(value).flatMap(([key, entry]) => {
				const path = prefix ? `${prefix}.${key}` : key;
				return typeof entry === "object" && entry !== null
					? paths(entry, path)
					: [path];
			});
		expect(paths(translations.zh).sort()).toEqual(
			paths(translations.en).sort(),
		);
	});

	it("does not expose mixed implementation terminology in Chinese copy", () => {
		const copy = JSON.stringify(translations.zh);
		for (const forbidden of [
			"Exclusive",
			"fallback provider",
			"before-state",
			"after-state",
			"Versioned",
			"Phase 2",
			"Core connected",
		]) {
			expect(copy).not.toContain(forbidden);
		}
	});

	it("keeps read-only behavior in supporting copy instead of workflow labels", () => {
		for (const messages of [translations.en, translations.zh]) {
			for (const label of [
				messages.startDiagnosis,
				messages.runDiagnosis,
				messages.resultTitle,
				messages.progressDiagnosis,
			]) {
				expect(label.toLowerCase()).not.toContain("read-only");
				expect(label).not.toContain("只读");
			}
			expect(messages.diagnosisReadOnlyNote).toMatch(/only reads|只读取/);
		}
	});
});
