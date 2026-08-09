# Android artwork

The Android identity uses a teal fingerprint and golden diagnostic magnifier on white. The WebAuthn site shares this diagnostic icon; desktop and documentation use the same design family with a repair wrench. Artwork was generated with the built-in image generation tool; [the prompts](PROMPTS.md) retain its design brief.

## Google Play uploads

| File | Size | Encoding | Purpose |
| --- | --- | --- | --- |
| [google-play-icon.png](google-play-icon.png) | 512 × 512 | 32-bit RGBA PNG, opaque white background | App icon, below 1 MB |
| [google-play-feature.png](google-play-feature.png) | 1024 × 500 | 24-bit RGB PNG, no alpha | Feature graphic, below 15 MB |

Upload these two files directly. Rounded corners and outer icon shadows are not baked into the artwork. The feature graphic uses pale teal to distinguish it from the store background. Suggested feature-graphic alt text: “WebAuthn Diagnosis beside a teal fingerprint examined through a golden magnifying glass.”

Sources: [Google Play preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en), [Android adaptive icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

## Masters and exports

- [icon-foreground-master.png](icon-foreground-master.png): full-resolution transparent foreground; reuse over white for store exports.
- [feature-graphic-master.png](feature-graphic-master.png): full-resolution landscape artwork with English app name.
- `../app/src/main/res/drawable-nodpi/ic_diagnosis_foreground.png`: 432 × 432 adaptive foreground, with the master fitted to a centered 240 × 240 area. Padding protects the magnifier handle under launcher masks.
- `../app/src/main/res/drawable-nodpi/ic_diagnosis_monochrome.png`: the same alpha silhouette for Android 13 themed icons. Android supplies its theme colors.

The app's minimum API is 28, so its default icon can use an adaptive drawable. Its monochrome layer is used by Android 13 and later; older versions retain the color layers. The system supplies the final launcher mask; the background layer is white.

To re-export after replacing a master, use ImageMagick 7 from the repository root (an optional artwork-authoring tool, not a runtime or CI dependency):

```sh
magick apps/android-app/artwork/icon-foreground-master.png -resize 512x512 -background white -alpha remove -alpha on -depth 8 PNG32:apps/android-app/artwork/google-play-icon.png
magick apps/android-app/artwork/feature-graphic-master.png -resize '1024x500^' -gravity center -extent 1024x500 -background white -alpha remove -alpha off -depth 8 PNG24:apps/android-app/artwork/google-play-feature.png
magick apps/android-app/artwork/icon-foreground-master.png -resize 240x240 -gravity center -background none -extent 432x432 -depth 8 PNG32:apps/android-app/app/src/main/res/drawable-nodpi/ic_diagnosis_foreground.png
magick apps/android-app/app/src/main/res/drawable-nodpi/ic_diagnosis_foreground.png -channel RGB -evaluate set 100% +channel -depth 8 PNG32:apps/android-app/app/src/main/res/drawable-nodpi/ic_diagnosis_monochrome.png
```

Inspect the exported icon at small sizes and under circular masks after changing its geometry, then run `mise exec -- just check-android`. Master files are editing sources, not Console uploads.
