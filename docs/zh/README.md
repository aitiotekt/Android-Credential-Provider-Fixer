# Android Credential Provider Fixer

Android Credential Provider Fixer 是一个独立、默认仅在本地工作的桌面与命令行项目，用于诊断并安全修复 Android 设置界面显示的 Credential Provider 状态与 Credential Manager 框架实际状态之间的不一致。

> [!IMPORTANT]
> 当前 `0.1.0-alpha.2` 已实现 Phase 1 只读诊断：验证用户安装的 ADB、检查明确选择的 Android 设备并解释 Credential Provider 状态，但**不能**修改设备。

## 项目背景

在部分 Android 14 及以上设备中，OEM 设置界面可能显示某个密码管理器为首选，但该 provider 没有进入 Credential Manager 实际使用的 enabled 状态。Phase 1 会明确展示这种不一致；后续阶段才会生成变更计划、保存原状态、验证写入并提供恢复。

最初验证来自 Xiaomi HyperOS 上的 Bitwarden 问题。现有证据更符合状态同步异常，但不足以认定 Bitwarden、Android 或所有 Xiaomi 设备普遍存在缺陷。

## 仓库结构

| 路径 | 职责 |
| --- | --- |
| `packages/core` | 与平台无关的 DTO、错误、端口和应用编排 |
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
```

运行桌面应用或 CLI：

```sh
just dev
just dev-cli --help
just dev-cli devices --no-interactive
just dev-cli diagnose --device SERIAL --no-interactive
just dev-cli demo --json
```

当前桌面构建只暴露收敛的发现、选择、检查、onboarding 与 Demo IPC。前端不能提交可执行路径、serial、user ID 或命令参数，也没有 shell、dialog 或 filesystem plugin 权限。

图标源按平台区分：`assets/icons/app-icon.png` 用于通用图标和 macOS 26 Icon Composer 图稿，`assets/icons/app-icon-macos-legacy.png` 使用旧版 macOS safe zone，用于 `tauri dev` 显示和旧系统的 `icon.icns` 回退。修改任一主图后运行 `just sync-icons`。

## 规划中的安全模型

未来的修复模式是明确的 **Exclusive Provider Pin**：选择的已注册 provider 将同时成为 enabled 和 primary provider，其他 fallback provider 可能在恢复原配置前消失。启用该功能前，项目必须完成设备与用户确认、一次性 plan、原子快照、状态变化检测、回读验证和自动恢复。

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
