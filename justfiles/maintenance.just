sync-docs:
    node scripts/dev-cli.mts docs sync

sync-icons:
    node scripts/dev-cli.mts icons sync

# Set all managed versions; add the English/Chinese changelog sections afterward.
set-version version *args:
    node scripts/dev-cli.mts version set {{quote(version)}} {{args}}

# Set macOS prerelease signing to signed or unsigned; stable releases require signed.
set-macos-signing policy:
    node scripts/dev-cli.mts release signing set macos {{quote(policy)}}

set-android-publish policy:
    node scripts/android-release.mts policy {{quote(policy)}}
