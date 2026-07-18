import { render } from "@solidjs/web";
import { afterEach, describe, expect, it } from "vitest";
import { translations } from "../i18n/translations";
import { ChangeRow } from "./App";

describe("change preview layout", () => {
	let dispose: (() => void) | undefined;

	afterEach(() => dispose?.());

	it("renders each setting as a vertical before and after section", () => {
		const container = document.createElement("div");
		dispose = render(
			() => (
				<>
					<ChangeRow
						label="credential_service"
						before="com.google.android.gms/.AReallyLongCredentialProviderServiceName"
						after="com.x8bit.bitwarden/.Autofill.CredentialProviderService"
						messages={translations.en}
					/>
					<ChangeRow
						label="credential_service_primary"
						before="Missing"
						after="com.x8bit.bitwarden/.Autofill.CredentialProviderService"
						messages={translations.en}
					/>
				</>
			),
			container,
		);

		const sections = [...container.querySelectorAll("[data-setting-section]")];
		expect(sections).toHaveLength(2);
		for (const section of sections) {
			const children = [...section.children];
			expect(children[0]?.tagName).toBe("H2");
			expect(children[1]?.textContent).toContain("Before");
			expect(children[2]?.textContent).toContain("After");
			expect(section.querySelectorAll("[data-change-value]")).toHaveLength(2);
			expect(section.querySelector("code")?.className).toContain(
				"overflow-wrap:anywhere",
			);
		}
	});
});
