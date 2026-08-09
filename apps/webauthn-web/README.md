# WebAuthn test website

The favicon shares Android's white, teal, and gold fingerprint-and-magnifier icon through a managed public-asset link. Run `just sync-docs` to restore the link; [Android artwork](../android-app/artwork/README.md) owns the export. Desktop and documentation use the matching wrench variant.

Static Solid 2 / Tailwind 4 SPA, deployed at `/webauthn/` together with VitePress by **Web**. No server, cookies, analytics, application storage or WebAuthn response uploads. Browser memory holds the current username, test identity, challenge and public key. There is no session lifetime timer; each operation retains a five-minute deadline. Refresh/clear discards these; the password manager's real test credential must be removed separately.

Without a recognized scene, the site defaults to Explore mode: enter a username and register/authenticate in one view, including repeated authentication with fresh challenges and updated signature counters. Editing the username clears the previous local registration. The Android app supplies `?scene=webauthn-diagnosis-android-app`, defaulting to Guided mode (create → verify → complete) and enabling Android return instructions. Unknown scene values behave like a generic visit. The toolbar switches modes without discarding the current test; switching is disabled during operations.

SimpleWebAuthn verifies the registration structure and authentication signature locally using WebCrypto. Requests require user verification and a resident credential, support ES256/RS256, and request no attestation. Vendor-attestation responses are rejected before verification can enter metadata/certificate paths. This is a local diagnostic, not server authentication or proof of provider reliability.

The RP ID is `acp-fixer.aitiotekt.com`; paths do not isolate relying parties or same-origin access. Only that HTTPS origin and HTTP localhost development origins are accepted. No history router or global Pages 404 override is needed.

```sh
mise exec -- just dev-web
mise exec -- pnpm --filter @aitiotekt/webauthn-web exec playwright install chromium firefox
mise exec -- just check-web
mise exec -- just test-web-firefox
mise exec -- just build-web
```

Playwright Credentials replaces create/get with a virtual authenticator in Chromium and Firefox. WebKit coverage is temporarily disabled until Playwright's Linux WebKit virtual authenticator passes SimpleWebAuthn's `PublicKeyCredential` constructor check without a project-specific shim. These tests validate the workflow and verification, not native OS/provider support. Real Google and Bitwarden checks require informed human interaction. The test fixture and keys are never included in the production graph.

`test-web-firefox` runs only the Firefox project against a production preview. Stop `dev-web` first to free port 1430. The same Firefox project also runs in `check-web` and Tests CI.

Open local development at `http://localhost:1430/webauthn/`. IP origins such as `127.0.0.1` are rejected before starting a credential request because WebAuthn requires a valid domain for the RP ID.

`build-web` stages both websites under a new `temp/web/pages-*` directory. Tests CI validates documentation and WebAuthn. Successful Tests on main automatically trigger Web to build and deploy that exact commit; Web can also be run manually on main without an upstream Tests run. Runs skip deployment if their source is no longer the current main commit. Release branches and pull requests only run validation. Package versions follow desktop, not Android.
