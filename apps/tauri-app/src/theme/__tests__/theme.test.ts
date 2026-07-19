import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { applyTheme, resolveTheme, ThemeController } from "../theme";

describe("theme", () => {
	it("uses the system theme only for the system preference", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
	});

	it("applies the resolved theme to native controls and CSS", () => {
		applyTheme("dark");
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(document.documentElement.style.colorScheme).toBe("dark");
	});

	it("tracks system changes only while the preference is system", async () => {
		let listener: ((event: MediaQueryListEvent) => void) | undefined;
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: vi.fn().mockReturnValue({
				matches: false,
				addEventListener: (_type: string, next: typeof listener) => {
					listener = next;
				},
				removeEventListener: vi.fn(),
			}),
		});

		let disposeRoot: (() => void) | undefined;
		let controller: ThemeController | undefined;
		createRoot((dispose) => {
			disposeRoot = dispose;
			const theme = new ThemeController();
			controller = theme;
			expect(theme.resolved()).toBe("light");
		});
		await Promise.resolve();
		listener?.({ matches: true } as MediaQueryListEvent);
		await Promise.resolve();
		expect(controller?.resolved()).toBe("dark");

		controller?.setPreference("light");
		listener?.({ matches: true } as MediaQueryListEvent);
		await Promise.resolve();
		expect(controller?.resolved()).toBe("light");
		expect(document.documentElement.dataset.theme).toBe("light");
		disposeRoot?.();
	});
});
