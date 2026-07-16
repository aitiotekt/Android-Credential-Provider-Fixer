dev:
    pnpm --filter @aitiotekt/acp-fixer-tauri-app tauri dev

dev-cli *args:
    cargo run -p acp-fixer-cli -- {{args}}

dev-docs:
    cd docsite && pnpm dev
