# 分发与商店准备

## 下载与依赖

在 [GitHub Releases](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/releases) 中选择匹配操作系统和架构的已发布产物，实际可用内容以发布说明和附件为准。

受支持的桌面发布目标是 macOS 13.3 或更高版本（Apple Silicon 与 Intel）以及 Windows x64。macOS 部署目标与 Tailwind CSS 4 界面所需的 Safari 16.4 时代 CSS 基线保持一致。发布流水线生成两个 DMG 和一个 NSIS 安装包。稳定版 macOS 构建必须使用 Developer ID 签名、Hardened Runtime、notarization 与 stapling；Windows 所有渠道（包括 alpha/beta）均采用 GitHub Artifact Attestation 与 SHA-256，无需 Authenticode 或 CA 凭据，仍可能出现 Unknown Publisher 或 SmartScreen 警告。macOS alpha/beta 同样遵循元数据中的显式策略，签名失败绝不会降级为未签名产物。

原生 CLI 归档覆盖 macOS ARM64/x64、Windows x64 和 Linux GNU ARM64/x64。Linux 源码构建继续受支持，但不生成 AppImage、Deb 或 RPM，因为目前不能保证 WebKitGTK 与应用打包的可移植性。这是项目的分发决定，并不表示 Tauri 不支持 Linux。

应用不捆绑 ADB、驱动或 updater。商店描述必须在开头披露外部 Android SDK Platform-Tools 依赖。引导式 Demo 允许审核人员在没有设备时查看诊断、计划、模拟 Pin、快照和模拟 Restore；它持续标记为模拟状态，使用内置 fixture，不能执行真实 ADB 操作。

## 校验下载

每个发布包含 `SHA256SUMS`、`release-manifest.json`（schema v1）和 GitHub Artifact Attestation。计算下载文件的 SHA-256 摘要，与 `SHA256SUMS` 中的对应记录比较。使用 GitHub CLI 校验构建来源：

```sh
gh attestation verify PATH_TO_DOWNLOAD --repo aitiotekt/Android-Credential-Provider-Fixer
```

来源证明不能提供 Windows“已验证的发布者”身份，manifest 的 `signed` 字段仅表示平台代码签名。

## 发布与商店策略

发布候选必须绑定精确的成功 Tests run 与源码 SHA；release 分支只能发布 alpha/beta，稳定版要求精确版本 tag、受保护审批和强制 macOS 签名/notarization；Windows 稳定版同样必须生成来源证明和校验文件；manifest 的 `signed` 保持 false，因为它表示平台代码签名，不代表来源证明。具备流水线不代表某个产物已经发布，实际可用性及签名/notarization 状态应以对应 GitHub Release 为准。

文档站从 `main` 部署到 [acp-fixer.aitiotekt.com](https://acp-fixer.aitiotekt.com/)。桌面应用商店、MSI/MSIX、macOS universal binary、Linux GUI 包、自动更新和 package registry 仍不在当前范围内。Android 配套应用具有独立的仅商店发布流程，详见 [WebAuthn 配套应用指南](005-WEBAUTHN-DIAGNOSIS.md#开发和发布)。发布准备命令见[贡献指南](CONTRIBUTING.md#发布维护)，历史变化见[变更日志](CHANGELOG.md)。

[English](../en/004-DISTRIBUTION-AND-STORE.md) | [中文](004-DISTRIBUTION-AND-STORE.md)
