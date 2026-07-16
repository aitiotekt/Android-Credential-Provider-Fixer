build:
    pnpm build
    cargo build --workspace --all-features

build-tauri:
    pnpm --filter @aitiotekt/acp-fixer-tauri-app tauri build --debug --no-bundle

build-cli:
    cargo build -p acp-fixer-cli

build-docs:
    cd docsite && pnpm build
