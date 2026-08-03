test:
    cargo test --workspace --all-features
    pnpm test

test-rs:
    cargo test --workspace --all-features

test-ts:
    pnpm test

test-web-firefox:
    pnpm --filter @aitiotekt/webauthn-web test:browser --project=firefox
