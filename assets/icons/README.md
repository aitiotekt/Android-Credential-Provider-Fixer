# Icon design

The desktop app and documentation site share a white background, teal fingerprint, and golden wrench. Android and the WebAuthn diagnostic site use the same visual family with a golden magnifier. Preserve existing export dimensions when replacing artwork.

`app-icon.png` is the 1024 × 1024 generic master and Icon Composer artwork. `app-icon-macos-legacy.png` is a 1024 × 1024 master retaining the legacy transparent safe zone and rounded tile mask. Run `mise exec -- just sync-icons` on macOS with full Xcode to regenerate PNG/ICO/ICNS assets and compile `apps/tauri-app/src-tauri/icons/Assets.car`. Set `DEVELOPER_DIR` for a nonstandard Xcode installation; the command can use `/Applications/Xcode.app` when the selected developer tools are Command Line Tools. `just check-icons` validates the checked-in outputs on every CI platform.

The documentation image is a managed link to the generic master. The diagnostic favicon is a managed link to Android's 512 × 512 Play icon. `just sync-docs` maintains both links.

## Generation prompt

The built-in image_gen tool produced the wrench variant using Android's white diagnostic icon as its edit reference. Raster exports retain the existing sizes; the legacy export reuses its previous alpha mask.

Use case: precise-object-edit. Edit this exact white Android WebAuthn Diagnosis icon into its desktop repair counterpart. Preserve the white background and the teal fingerprint IDENTICALLY: same flowing ridges, geometry, scale, position, teal tones, and crisp mobile-style rendering. Change ONLY the golden magnifying glass into a clearly recognizable golden repair wrench, occupying the same lower-right footprint: open-ended wrench jaw at the upper-left of the tool, short handle extending diagonally down-right with a rounded end and small circular hole. Keep its golden yellow/amber palette and restrained shading identical to the reference magnifying glass. Keep a clean narrow white separation from the fingerprint. No magnifying glass or closed lens remains. No additional elements, no text, no tile border, no outer shadow, no background gradient. Square 1024x1024 output, exact white background. This must look like one icon family where only the tool differs.
