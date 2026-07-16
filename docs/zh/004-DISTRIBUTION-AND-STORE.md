# 分发与商店准备

首批受支持二进制面向 macOS Apple Silicon、macOS Intel 与 Windows x64。GitHub Releases 将包含已签名安装包、校验和、release notes 和签名信息。macOS 构建需要 Developer ID 签名、Hardened Runtime、notarization 与 stapling；Windows 构建需要 Authenticode 签名，Microsoft Store 在与最终 Tauri 打包流程兼容时优先使用 MSIX。

Linux 允许并测试源码构建，但首个版本不计划提供 AppImage、Deb 或 RPM，因为目前不能保证 WebKitGTK 与应用打包的可移植性。这是项目的分发决定，并不表示 Tauri 不支持 Linux。

工程基线不捆绑 ADB、驱动或 updater。商店描述必须在开头披露外部 Android SDK Platform-Tools 依赖。未来 Demo Mode 会让审核人员无需设备即可查看完整流程，但必须明确标记为模拟状态，并且不能执行 ADB。

`0.1.0-alpha.1` 只有 CI 构建验证，没有 release workflow、签名 secret 接口、notarization job、文档部署或已发布安装包。在签名产物完成手工验证前，不得把这些 Phase 4 工作描述为已完成。

[English](../en/004-DISTRIBUTION-AND-STORE.md) | [中文](004-DISTRIBUTION-AND-STORE.md)
