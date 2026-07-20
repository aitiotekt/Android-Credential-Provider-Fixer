build:
    pnpm build
    cargo build --workspace --all-features

build-tauri:
    pnpm --filter @aitiotekt/acp-fixer-tauri-app tauri build --debug --no-bundle

build-cli:
    cargo build -p acp-fixer-cli

release-notices:
    env MISE_ENV=release mise exec -- node scripts/dev-cli.mts release notices --output-directory=temp/release/notices

stage-cli-release: release-notices
    cargo build --release -p acp-fixer-cli
    node scripts/dev-cli.mts release stage-current-cli --notices=temp/release/notices/THIRD_PARTY_NOTICES-CLI.html --output-directory=temp/release/local

build-tauri-release: release-notices
    node scripts/dev-cli.mts release tauri-config --notices=temp/release/notices/THIRD_PARTY_NOTICES-GUI.html --output=apps/tauri-app/src-tauri/target/release-resources/tauri.release.json
    pnpm --filter @aitiotekt/acp-fixer-tauri-app tauri build --config src-tauri/target/release-resources/tauri.release.json

build-docs:
    cd docsite && pnpm build
