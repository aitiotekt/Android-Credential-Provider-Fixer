import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("shared visual tokens", () => {
	it("keeps the tutorial close control large, opaque, and theme-aware", () => {
		expect(styles).toContain(".driver-popover-close-btn");
		expect(styles).toContain("width: 32px");
		expect(styles).toContain("height: 32px");
		expect(styles).toContain("opacity: 1");
		expect(styles).toContain("background: var(--surface)");
		expect(styles).toContain("focus-visible");
	});

	it("defines separate light and dark semantic palettes", () => {
		expect(styles).toContain(':root[data-theme="light"]');
		expect(styles).toContain(':root[data-theme="dark"]');
		expect(styles).toContain("--accent:");
		expect(styles).toContain("--fg-muted:");
	});
});
