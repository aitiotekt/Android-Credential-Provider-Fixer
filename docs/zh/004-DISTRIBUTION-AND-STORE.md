# 分发与商店准备

受支持的桌面发布目标是 macOS 13.3 或更高版本（Apple Silicon 与 Intel）以及 Windows x64。macOS 部署目标与 Tailwind CSS 4 界面所需的 Safari 16.4 时代 CSS 基线保持一致。发布流水线生成两个 DMG 和一个 NSIS 安装包。稳定版 macOS 构建必须使用 Developer ID 签名、Hardened Runtime、notarization 与 stapling；稳定版 Windows 构建必须使用 Authenticode 签名和时间戳。alpha/beta 只有在版本化项目元数据明确指定时才允许未签名，签名失败绝不会降级为未签名产物。

原生 CLI 归档覆盖 macOS ARM64/x64、Windows x64 和 Linux GNU ARM64/x64。Linux 源码构建继续受支持，但不生成 AppImage、Deb 或 RPM，因为目前不能保证 WebKitGTK 与应用打包的可移植性。这是项目的分发决定，并不表示 Tauri 不支持 Linux。

应用不捆绑 ADB、驱动或 updater。商店描述必须在开头披露外部 Android SDK Platform-Tools 依赖。引导式 Demo 允许审核人员在没有设备时查看诊断、计划、模拟 Pin、快照和模拟 Restore；它持续标记为模拟状态，使用内置 fixture，不能执行真实 ADB 操作。

`0.1.0-alpha.6` 增加发布与文档流水线。每个 Release 包含 `SHA256SUMS`、schema v1 构建 manifest、GUI/CLI 第三方许可证声明和 GitHub artifact attestations。发布候选必须绑定精确的成功 Tests run 与源码 SHA；release 分支只能发布 alpha/beta，稳定版要求精确版本 tag、受保护审批和强制平台签名。具备流水线不代表某个产物已经发布，实际可用性及签名/notarization 状态应以对应 GitHub Release 为准。

文档站从 `main` 部署到 [acp-fixer.aitiotekt.com](https://acp-fixer.aitiotekt.com/)。应用商店、MSI/MSIX、macOS universal binary、Linux GUI 包、自动更新和 package registry 仍不在当前范围内。

[English](../en/004-DISTRIBUTION-AND-STORE.md) | [中文](004-DISTRIBUTION-AND-STORE.md)
