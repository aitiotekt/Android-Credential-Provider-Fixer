import { beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "../i18n/translations";

const mock = vi.hoisted(() => ({
	driver: vi.fn(),
	drive: vi.fn(),
	destroy: vi.fn(),
	moveNext: vi.fn(),
	moveTo: vi.fn(),
	activeIndex: 0,
	instance: undefined as Record<string, unknown> | undefined,
	config: undefined as Record<string, unknown> | undefined,
}));

vi.mock("driver.js", () => ({
	driver: (config: Record<string, unknown>) => {
		mock.config = config;
		mock.driver(config);
		mock.instance = {
			drive: mock.drive,
			destroy: mock.destroy,
			moveNext: mock.moveNext,
			moveTo: mock.moveTo,
			getActiveIndex: () => mock.activeIndex,
			getConfig: () => mock.config,
			isActive: () => true,
		};
		return mock.instance;
	},
}));

import { advanceTutorial, startTutorial, stopTutorial } from "./tutorial";

describe("tutorial", () => {
	beforeEach(() => {
		stopTutorial();
		mock.driver.mockReset();
		mock.drive.mockReset();
		mock.destroy.mockReset();
		mock.moveNext.mockReset();
		mock.moveTo.mockReset();
		mock.activeIndex = 0;
		mock.instance = undefined;
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

	it("advances only after the next view target is mounted", () => {
		startTutorial(translations.en, {
			completed: vi.fn(),
			dismissed: vi.fn(),
		});
		const target = document.createElement("div");
		target.dataset.tour = "next-view";
		document.body.append(target);

		advanceTutorial("[data-tour='next-view']");

		expect(mock.moveTo).toHaveBeenCalledWith(1);
		target.remove();
	});

	it("keeps the tutorial active and reports a missing next-view target", () => {
		const targetMissing = vi.fn();
		const now = vi
			.spyOn(performance, "now")
			.mockReturnValueOnce(0)
			.mockReturnValue(3_001);
		startTutorial(translations.en, {
			completed: vi.fn(),
			dismissed: vi.fn(),
			targetMissing,
		});

		advanceTutorial("[data-tour='missing-view']");

		expect(mock.moveTo).not.toHaveBeenCalled();
		expect(mock.destroy).not.toHaveBeenCalled();
		expect(targetMissing).toHaveBeenCalledWith("[data-tour='missing-view']");
		now.mockRestore();
	});

	it("changes scene before moving next across a view boundary", () => {
		const sceneChanged = vi.fn((scene: string) => {
			if (scene === "devices") {
				const target = document.createElement("div");
				target.dataset.tour = "device-card";
				document.body.append(target);
			}
		});
		startTutorial(translations.en, {
			completed: vi.fn(),
			dismissed: vi.fn(),
			sceneChanged,
		});
		const onNextClick = mock.config?.onNextClick as (
			element: undefined,
			step: Record<string, never>,
			opts: Record<string, unknown>,
		) => void;

		onNextClick(undefined, {}, { driver: mock.instance, index: 2 });

		expect(sceneChanged).toHaveBeenCalledWith("devices");
		expect(mock.moveTo).toHaveBeenCalledWith(3);
		document.querySelector("[data-tour='device-card']")?.remove();
	});

	it("changes scene before moving previous across a view boundary", () => {
		const sceneChanged = vi.fn((scene: string) => {
			if (scene === "adb") {
				const target = document.createElement("div");
				target.dataset.tour = "continue-adb";
				document.body.append(target);
			}
		});
		startTutorial(translations.en, {
			completed: vi.fn(),
			dismissed: vi.fn(),
			sceneChanged,
		});
		const onPrevClick = mock.config?.onPrevClick as (
			element: undefined,
			step: Record<string, never>,
			opts: Record<string, unknown>,
		) => void;

		onPrevClick(undefined, {}, { driver: mock.instance, index: 3 });

		expect(sceneChanged).toHaveBeenCalledWith("adb");
		expect(mock.moveTo).toHaveBeenCalledWith(2);
		document.querySelector("[data-tour='continue-adb']")?.remove();
	});

	it("moves within one scene without resetting application state", () => {
		const sceneChanged = vi.fn();
		startTutorial(translations.en, {
			completed: vi.fn(),
			dismissed: vi.fn(),
			sceneChanged,
		});
		const target = document.createElement("div");
		target.dataset.tour = "continue-adb";
		document.body.append(target);
		const steps = mock.config?.steps as Array<Record<string, unknown>>;
		const onNextClick = mock.config?.onNextClick as (
			element: undefined,
			step: Record<string, unknown>,
			opts: Record<string, unknown>,
		) => void;

		onNextClick(undefined, steps[1] ?? {}, {
			driver: mock.instance,
			index: 1,
		});

		expect(sceneChanged).not.toHaveBeenCalled();
		expect(mock.moveTo).toHaveBeenCalledWith(2);
		target.remove();
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
