# WebAuthn test website

Static Solid 2 / Tailwind 4 SPA, deployed at `/webauthn/` together with VitePress by **Web**. No server, cookies, analytics, application storage or WebAuthn response uploads. Browser memory holds the current test identity, challenge and public key. Refresh/clear discards these; the password manager's real test credential must be removed separately.

SimpleWebAuthn verifies the registration structure and authentication signature locally using WebCrypto. Requests require user verification and a resident credential, support ES256/RS256, and request no attestation. Vendor-attestation responses are rejected before verification can enter metadata/certificate paths. This is a local diagnostic, not server authentication or proof of provider reliability.

The RP ID is `acp-fixer.aitiotekt.com`; paths do not isolate relying parties or same-origin access. Only that HTTPS origin and HTTP localhost development origins are accepted. No history router or global Pages 404 override is needed.

```sh
mise exec -- just dev-web
mise exec -- pnpm --filter @aitiotekt/webauthn-web exec playwright install chromium firefox webkit
mise exec -- just check-web
mise exec -- just build-web
```

Playwright Credentials replaces create/get with a virtual authenticator in Chromium, Firefox and WebKit. These tests validate the workflow and verification, not native OS/provider support. Real Google and Bitwarden checks require informed human interaction. The test fixture and keys are never included in the production graph.

`build-web` stages both websites under a new `temp/web/pages-*` directory. Only main deploys to the production Pages environment; release and pull requests validate without deployment. Package versions follow desktop, not Android.
