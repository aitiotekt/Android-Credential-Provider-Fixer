dev:
    pnpm --filter @aitiotekt/acp-fixer-tauri-app tauri dev

dev-cli *args:
    cargo run -p acp-fixer-cli -- {{args}}

dev-docs:
    cd docsite && pnpm dev

dev-web:
    pnpm --filter @aitiotekt/webauthn-web dev

[unix]
[positional-arguments]
dev-android *args:
    exec node scripts/dev-cli.mts android dev "$@"

# Just prepends the recipe name to shell arguments; forward only user arguments.
[windows]
[positional-arguments]
dev-android *args:
    $ErrorActionPreference = 'Stop'; $forwardedArgs = @($args | Select-Object -Skip 1); node scripts/dev-cli.mts android dev @forwardedArgs; exit $LASTEXITCODE
