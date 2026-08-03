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

# Script arguments avoid PowerShell -Command reparsing and preserve native exit codes.
[windows]
[script("pwsh.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "RemoteSigned", "-File")]
[extension(".ps1")]
[positional-arguments]
dev-android *args:
    $ErrorActionPreference = 'Stop'
    $PSNativeCommandArgumentPassing = 'Standard'
    & node scripts/dev-cli.mts android dev @args
    exit $LASTEXITCODE
