# Android Credential Provider Fixer

诊断并修复 Android 密码管理器设置与通行密钥实际使用的凭据提供方状态之间的不一致。桌面应用和命令行工具在本地运行，执行前展示变更，并保存原配置以便恢复。

## 可以做什么

- **诊断提供方选择：** 查看预期的密码管理器是否已在 Android 设备上注册并启用。
- **检查并应用修复：** 明确选择一个提供方，查看拟议变更，并在需要时恢复保存的配置。
- **在浏览器中测试通行密钥：** 使用独立的 WebAuthn 工具创建和认证测试通行密钥，无需 ADB。

最初的调查来自 Xiaomi HyperOS 上的 Bitwarden 问题。相似症状并不能确定某个密码管理器或设备存在故障，详见[支持设备与排障](003-SUPPORT-AND-TROUBLESHOOTING.md)。

## 开始使用

| 工具 | 用途 | 使用入口 |
| --- | --- | --- |
| 桌面应用 | 引导式设备诊断、修复预览和配置恢复 | [下载](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/releases) · [安装与校验](004-DISTRIBUTION-AND-STORE.md) |
| 命令行工具 | 在终端中完成相同的设备操作流程 | [下载](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/releases) · [命令行用法](003-SUPPORT-AND-TROUBLESHOOTING.md#命令行用法) |
| WebAuthn 网站 | 在当前浏览器中注册和认证通行密钥 | [打开测试工具](https://acp-fixer.aitiotekt.com/webauthn/) · [测试指南](005-WEBAUTHN-DIAGNOSIS.md) |
| Android 配套应用 | 设置指引、浏览器测试和手动确认结果 | [Android 配套应用指南](005-WEBAUTHN-DIAGNOSIS.md) |

进行设备诊断前，请单独安装 Android SDK Platform-Tools，开启 USB 调试，并在手机上授权当前电脑。应用不会代为安装 ADB。也可以先使用桌面的演示模式，无需连接设备或修改设置。

可用发布、支持平台、安装提示和下载校验请查看[分发指南](004-DISTRIBUTION-AND-STORE.md)。[文档网站](https://acp-fixer.aitiotekt.com/zh/)提供中英文内容。

## 应用修复前

锁定操作会将选中的密码管理器设为唯一启用和主要的凭据提供方。恢复保存的配置前，其他提供方可能不再出现。每次变更都需经过确认；应用会检查设备状态、保存快照、验证结果，并在写入失败时尝试恢复。

设备工具不会修改自动填充设置、读取保险库或删除通行密钥。浏览器测试仅在你同意后创建真实测试通行密钥，测试结束后需要在密码管理器中自行删除。详见[变更安全指南](002-ADB-BEHAVIOR-AND-SAFETY.md)和 [WebAuthn 清理说明](005-WEBAUTHN-DIAGNOSIS.md#隐私和边界)。

## 进一步了解

- **工具使用：** [项目概览](000-OVERVIEW.md)介绍适用范围，[排障指南](003-SUPPORT-AND-TROUBLESHOOTING.md)说明设备支持和常见症状。
- **安全与隐私：** [安全政策](SECURITY.md)介绍防护措施和漏洞报告方式，[隐私政策](PRIVACY.md)说明数据处理方式。
- **参与贡献：** [贡献指南](CONTRIBUTING.md)介绍环境配置、开发、检查和发布维护，[架构指南](001-ARCHITECTURE.md)说明代码结构及职责边界。
- **变化与计划：** 查看[桌面与 Web 变更日志](CHANGELOG.md)、[Android 变更日志](CHANGELOG-ANDROID.md)和[路线图](100-ROADMAP.md)。

## 关于项目

本项目独立于 Google、Xiaomi、Bitwarden、Microsoft 和 Apple，与这些组织没有隶属、认可或赞助关系。项目采用 [MIT 许可证](../../LICENSE)。

[English](../../README.md) | [中文](README.md)
