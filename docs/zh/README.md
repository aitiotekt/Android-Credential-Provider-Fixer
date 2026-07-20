# Android Credential Provider Fixer

Android Credential Provider Fixer 是一个独立、默认仅在本地工作的桌面与命令行项目，用于诊断并安全修复 Android 设置界面显示的凭据提供方状态与凭据管理器框架实际状态之间的不一致。

> [!IMPORTANT]
> `0.1.0-alpha.6` 新增可复现检查、原生 CLI 归档、Tauri 安装包流水线、发布证明与双语文档部署。设备安全边界没有变化：诊断结果只能在当前会话上下文中使用；有限的“锁定单一凭据提供方”与恢复仍要求明确目标、检查变更、本地原子快照、最新状态复核和逐字段回读验证。

## 项目背景

在部分 Android 14 及以上设备中，OEM 设置界面可能显示某个密码管理器为首选，但该凭据提供方没有进入凭据管理器实际使用的已启用状态。本应用会明确展示这种不一致，并可通过短期操作计划把用户明确选择的凭据提供方设为唯一提供方；执行前保存原状态，每次受限写入后都会回读验证，以支持自动恢复和手动恢复。

最初验证来自 Xiaomi HyperOS 上的 Bitwarden 问题。现有证据更符合状态同步异常，但不足以认定 Bitwarden、Android 或所有 Xiaomi 设备普遍存在缺陷。

唯一可写值是明确选择的前台 Android user 的 `credential_service` 和 `credential_service_primary`；`autofill_service` 永不修改。CLI `pin` 与 `restore` 缺少 `--apply` 时始终是 dry-run。

## 仓库结构

| 路径 | 职责 |
| --- | --- |
| `packages/core` | 与平台无关的 DTO、错误、端口和应用编排 |
| `packages/storage` | GUI 与 CLI 共用的原子本地快照 adapter |
| `apps/tauri-app` | SolidJS 2 与 Tauri 2 桌面应用 |
| `apps/cli` | `acp-fixer` 命令行应用 |
| `docs` | 英文与中文项目文档 |
| `docsite` | 独立的 VitePress 文档 workspace |

## 开发

项目通过 [mise](https://mise.jdx.dev/) 管理 Node 26.1.0、pnpm 12.1.0、Rust 1.98.0、Just 和 prek。

```sh
mise trust
just setup
just verify
just release-check
```

运行桌面应用或 CLI：

```sh
just dev
just dev-cli --help
just dev-cli devices --no-interactive
just dev-cli diagnose --device SERIAL --no-interactive
just dev-cli pin --device SERIAL --provider COMPONENT --no-interactive
just dev-cli snapshots --json
just dev-cli restore --snapshot ID --device SERIAL --no-interactive
just dev-cli demo --json
```

桌面构建只暴露收敛的发现、检查、opaque plan/snapshot、onboarding 与 Demo IPC。前端不能提交可执行路径、raw component、serial、user ID、setting key 或命令参数，也没有 shell、dialog 或 filesystem plugin 权限。

桌面界面使用 Tailwind CSS 4、本地 Solid 组件原语以及 Slate/Teal 语义 token。外观支持跟随系统、浅色和深色三种模式，偏好保存在应用私有配置文件中；跟随系统时会实时响应操作系统主题变化，不使用 `localStorage` 保存主题。当前要求 macOS 13.3 或更高版本。

## 下载与发布校验

GitHub Releases 提供 macOS Apple Silicon/Intel DMG、Windows x64 NSIS 安装包，以及面向 macOS、Windows 和 Linux GNU x64/ARM64 的原生 CLI 归档。alpha/beta 平台包可能未签名，每个 Release 都会明确标识；稳定版 macOS 和 Windows 产物必须通过平台签名，macOS 产物还必须通过 notarization。

每个 Release 都包含 `SHA256SUMS`、`release-manifest.json`、第三方许可证声明和 GitHub artifact attestations。可使用以下命令验证：

```sh
gh attestation verify PATH_TO_DOWNLOAD --repo aitiotekt/Android-Credential-Provider-Fixer
```

应用仍要求用户单独安装 Android SDK Platform-Tools，不捆绑 ADB 或 updater。项目文档发布于 [acp-fixer.aitiotekt.com](https://acp-fixer.aitiotekt.com/)。

图标源按平台区分：`assets/icons/app-icon.png` 用于通用图标和 macOS 26 Icon Composer 图稿，`assets/icons/app-icon-macos-legacy.png` 使用旧版 macOS safe zone，用于 `tauri dev` 显示和旧系统的 `icon.icns` 回退。修改任一主图后运行 `just sync-icons`。

## 变更安全模型

修复模式是明确的**锁定单一凭据提供方**：选择的已注册凭据提供方会同时成为已启用和主要提供方，恢复保存配置前其他备用提供方可能消失。操作计划五分钟过期且只能使用一次；设备序列号、Android 用户、凭据提供方集合或设置状态漂移都会中止执行，部分失败会触发反向恢复。

项目不会提供任意 ADB 终端，不会修改 `autofill_service`、读取保险库、删除 passkey、静默安装 ADB 或上传诊断信息。

## 文档

- [项目概览](000-OVERVIEW.md)
- [架构](001-ARCHITECTURE.md)
- [ADB 行为与安全](002-ADB-BEHAVIOR-AND-SAFETY.md)
- [支持设备与排障](003-SUPPORT-AND-TROUBLESHOOTING.md)
- [分发与商店准备](004-DISTRIBUTION-AND-STORE.md)
- [路线图](100-ROADMAP.md)
- [变更日志](CHANGELOG.md)

## 独立性与隐私

Android Credential Provider Fixer 与 Google、Xiaomi、Bitwarden、Microsoft 或 Apple 没有隶属、认可或赞助关系。详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

项目使用 MIT License，详见 [LICENSE](../../LICENSE)。

[English](../../README.md) | [中文](README.md)
