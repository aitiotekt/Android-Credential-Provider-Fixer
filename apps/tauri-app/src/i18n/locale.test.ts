import { describe, expect, it } from "vitest";
import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
	it("prefers a saved supported locale", () => {
		expect(resolveLocale("en", "zh-CN")).toBe("en");
	});

	it("detects Chinese without requiring a region", () => {
		expect(resolveLocale(null, "zh-Hans-CN")).toBe("zh");
	});

	it("falls back to English for unknown languages", () => {
		expect(resolveLocale(null, "de-DE")).toBe("en");
	});
});
