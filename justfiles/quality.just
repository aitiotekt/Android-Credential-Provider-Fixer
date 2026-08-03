format:
    cargo fmt --all
    pnpm lint:fix

format-check:
    cargo fmt --all -- --check
    pnpm exec biome format .

lint:
    cargo clippy --workspace --all-targets --all-features -- -D warnings
    pnpm lint

typecheck:
    pnpm typecheck

check-web:
    pnpm --filter @aitiotekt/webauthn-web typecheck
    pnpm --filter @aitiotekt/webauthn-web test
    pnpm --filter @aitiotekt/webauthn-web test:browser

check-android:
    node scripts/dev-cli.mts version check --app android
    {{if os() == "windows" { ".\\gradlew.bat" } else { "./gradlew" }}} :webauthn-diagnosis:testDebugUnitTest :webauthn-diagnosis:lintDebug :webauthn-diagnosis:assembleDebug

check-docs:
    node scripts/dev-cli.mts docs check

check-icons:
    node scripts/dev-cli.mts icons check

# Check managed versions and matching English/Chinese changelog sections.
check-version *args:
    node scripts/dev-cli.mts version check {{args}}

# Validate release metadata, artifact definitions, and workflow policy locally.
release-check:
    node scripts/dev-cli.mts release check

check-security:
    node scripts/dev-cli.mts security check

check-architecture:
    node scripts/dev-cli.mts architecture check

verify: format-check lint typecheck test build build-docs check-docs check-icons check-version release-check check-security check-architecture
