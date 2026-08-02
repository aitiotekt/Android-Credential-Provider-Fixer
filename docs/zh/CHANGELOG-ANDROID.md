# Android 变更日志

[English](../en/CHANGELOG-ANDROID.md)

<!--
## Unreleased

- Android 14+ 优先通过 AndroidX CredentialManager 打开凭据提供方专项设置；旧系统或启动失败时明确提示回退系统设置，不将返回视为提供方已启用。
- 将英文变更日志移至仓库根目录，多语言版本放在 docs 下，并接入文档站双语入口。
- 升级至 JDK 26、Gradle 9.7.1、AGP 9.4.0 与 Kotlin/Compose 2.4.20；采用内置 Kotlin，字节码目标及 Android SDK 兼容范围不变，Android Studio 需支持 AGP 9.4。
- 通过 `:webauthn-diagnosis` Gradle 模块和根 Wrapper 支持 Android Studio 打开仓库根目录；应用身份和发布版本体系保持不变。

在此记录后续变更，发布时移入新版本章节。
-->

## 0.1.0-alpha.1

- 引入 WebAuthn 诊断：系统设置指引、浏览器测试、用户确认结果与排障流程。
- Android 独立版本，仅通过商店分发，手动触发签名 AAB 构建；默认不上传 Play。
- 真实提供方和商店分发验收仍需维护者操作。
