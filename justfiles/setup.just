setup:
    mise install
    pnpm install --frozen-lockfile
    cd docsite && pnpm install --frozen-lockfile
    cargo check --workspace --all-targets --all-features
    node scripts/dev-cli.mts docs check

install:
    pnpm install
    cd docsite && pnpm install
