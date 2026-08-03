build:
    pnpm build
    cargo build --workspace --all-features

build-tauri:
    pnpm --filter @aitiotekt/acp-fixer-tauri-app tauri build --debug --no-bundle

build-cli:
    cargo build -p acp-fixer-cli

stage-cli-release:
    cargo build --release -p acp-fixer-cli
    node scripts/dev-cli.mts release stage-current-cli --output-directory=temp/release/local

build-tauri-release:
    pnpm --filter @aitiotekt/acp-fixer-tauri-app tauri build

build-docs:
    cd docsite && pnpm build

build-web: build-docs
    pnpm --filter @aitiotekt/webauthn-web build
    node scripts/build-web.mts

build-android-release:
    node scripts/dev-cli.mts version check --app android
    {{if os() == "windows" { ".\\gradlew.bat" } else { "./gradlew" }}} :webauthn-diagnosis:bundleRelease
