import { describe, expect, it } from "vitest";
import { en, zh } from "../../i18n/messages";
import { relyingParty } from "../verification";

describe("diagnosis origin and messages", () => {
	it("does not turn a URL path into an RP ID", () => {
		expect(relyingParty("https://acp-fixer.aitiotekt.com").id).toBe(
			"acp-fixer.aitiotekt.com",
		);
		expect(relyingParty("http://localhost:1430").id).toBe("localhost");
		expect(() => relyingParty("https://attacker.example")).toThrow(
			"unsupportedOrigin",
		);
		expect(() => relyingParty("http://acp-fixer.aitiotekt.com")).toThrow(
			"unsupportedOrigin",
		);
	});
	it("keeps all translations symmetric", () => {
		expect(Object.keys(zh)).toEqual(Object.keys(en));
		expect(Object.keys(zh.errors)).toEqual(Object.keys(en.errors));
	});
});
