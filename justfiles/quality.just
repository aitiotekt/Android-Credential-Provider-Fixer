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

check-docs:
    node scripts/dev-cli.mts docs check

sync-docs:
    node scripts/dev-cli.mts docs sync

check-icons:
    node scripts/dev-cli.mts icons check

sync-icons:
    node scripts/dev-cli.mts icons sync

check-version:
    node scripts/dev-cli.mts version check

check-security:
    node scripts/dev-cli.mts security check

verify: format-check lint typecheck test build build-docs check-docs check-icons check-version check-security
