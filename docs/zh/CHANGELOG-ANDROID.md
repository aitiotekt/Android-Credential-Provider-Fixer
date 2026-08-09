# Android 变更日志

[English](../en/CHANGELOG-ANDROID.md)

<!--
## Unreleased

- 新增常驻步骤菜单与系统返回导航。返回准备或测试页面会清除应用内上一轮测试状态；导航不会生成确认结果，迟到的浏览器返回也不会恢复旧结果。
- 移除应用页面中的版本号，便于截图与录屏；Android 安装包版本元数据保持不变。

在此记录后续变更，发布时移入新版本章节。
-->

## 0.1.0-beta.2

- 新增白底自适应启动图标，以青绿色指纹和金色放大镜表达诊断，支持 Android 13 主题图标，并提供可直接上传 Google Play 的美术素材。
- 与 WebAuthn 网站 favicon 共用诊断图标，并统一桌面修复图标的白底、青绿色与金色设计；保留高清母版和导出说明。

## 0.1.0-beta.1

- 通过 Custom Tabs 或浏览器回退，以 Android 引导场景打开 WebAuthn 网站，并在成功后提示返回。
- Android 14+ 优先通过 AndroidX CredentialManager 打开凭据提供方设置，否则回退系统设置。从设置返回不代表提供方已启用。
- 新增 `just dev-android`，在选定设备上安装并启动 debug 应用。Android Studio 打开仓库根目录（`:webauthn-diagnosis`），工具链为 JDK 26、Gradle 9.7.1、AGP 9.4.0 与 Kotlin/Compose 2.4.20，应用 SDK 目标不变。

## 0.1.0-alpha.1

- 引入 WebAuthn 诊断：系统设置指引、浏览器测试和用户确认结果。
- 使用独立 Android 版本，以及手动触发、仅商店分发的签名 AAB 流程。默认不上传 Play；真实提供方和商店验收仍由维护者完成。
