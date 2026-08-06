# Android 变更日志

[English](../en/CHANGELOG-ANDROID.md)

<!--
## Unreleased

在此记录后续变更，发布时移入新版本章节。
-->

## 0.1.0-beta.1

- 通过 Custom Tabs 或浏览器回退，以 Android 引导场景打开 WebAuthn 网站，并在成功后提示返回。
- Android 14+ 优先通过 AndroidX CredentialManager 打开凭据提供方设置，否则回退系统设置。从设置返回不代表提供方已启用。
- 新增 `just dev-android`，在选定设备上安装并启动 debug 应用。Android Studio 打开仓库根目录（`:webauthn-diagnosis`），工具链为 JDK 26、Gradle 9.7.1、AGP 9.4.0 与 Kotlin/Compose 2.4.20，应用 SDK 目标不变。

## 0.1.0-alpha.1

- 引入 WebAuthn 诊断：系统设置指引、浏览器测试和用户确认结果。
- 使用独立 Android 版本，以及手动触发、仅商店分发的签名 AAB 流程。默认不上传 Play；真实提供方和商店验收仍由维护者完成。
