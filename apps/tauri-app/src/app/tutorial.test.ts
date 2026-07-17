import { beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "../i18n/translations";

const mock = vi.hoisted(() => ({
	driver: vi.fn(),
	drive: vi.fn(),
	destroy: vi.fn(),
	config: undefined as Record<string, unknown> | undefined,
}));

vi.mock("driver.js", () => ({
	driver: (config: Record<string, unknown>) => {
		mock.config = config;
		mock.driver(config);
		return { drive: mock.drive, destroy: mock.destroy };
	},
}));

import { startTutorial, stopTutorial } from "./tutorial";

describe("tutorial", () => {
	beforeEach(() => {
		stopTutorial();
		mock.driver.mockReset();
		mock.drive.mockReset();
		mock.destroy.mockReset();
		mock.config = undefined;
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: () => ({ matches: true }),
		});
		Object.defineProperty(window, "requestAnimationFrame", {
			configurable: true,
			value: (callback: FrameRequestCallback) => {
				callback(0);
				return 1;
			},
		});
	});

	it("uses reduced motion and records completion", () => {
		const completed = vi.fn();
		const dismissed = vi.fn();

		startTutorial(translations.en, { completed, dismissed });

		expect(mock.driver).toHaveBeenCalledOnce();
		expect(mock.drive).toHaveBeenCalledOnce();
		expect(mock.config?.animate).toBe(false);
		expect(mock.config?.duration).toBe(0);
		const onDoneClick = mock.config?.onDoneClick as () => void;
		onDoneClick();
		expect(completed).toHaveBeenCalledOnce();
		expect(dismissed).not.toHaveBeenCalled();
		expect(mock.destroy).toHaveBeenCalledOnce();
	});

	it("destroys an active tour during cleanup", () => {
		startTutorial(translations.zh, {
			completed: vi.fn(),
			dismissed: vi.fn(),
		});

		stopTutorial();

		expect(mock.destroy).toHaveBeenCalledOnce();
	});
});
