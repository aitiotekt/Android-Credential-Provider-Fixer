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

# Check managed versions and matching English/Chinese changelog sections.
check-version:
    node scripts/dev-cli.mts version check

# Set all managed versions; add the English/Chinese changelog sections afterward.
set-version version:
    node scripts/dev-cli.mts version set {{quote(version)}}

# Set macOS prerelease signing to signed or unsigned; stable releases require signed.
set-macos-signing policy:
    node scripts/dev-cli.mts release signing set macos {{quote(policy)}}

# Validate release metadata, artifact definitions, and workflow policy locally.
release-check:
    node scripts/dev-cli.mts release check

check-security:
    node scripts/dev-cli.mts security check

check-architecture:
    node scripts/dev-cli.mts architecture check

verify: format-check lint typecheck test build build-docs check-docs check-icons check-version release-check check-security check-architecture
