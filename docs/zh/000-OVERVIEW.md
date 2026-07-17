# 项目概览

Android Credential Provider Fixer 处理 Android 14 及以上系统中的一种特定故障：OEM 设置界面显示某个 provider 为首选，但 Credential Manager 实际使用的 enabled-provider 状态仍指向其他 provider 或不完整。此时 passkey 请求可能回退到其他 provider，或者表现为没有响应。

项目刻意保持本地、透明和范围收敛。它会发现用户自行安装的 ADB，确认用户明确选择的设备与当前 Android user，枚举已注册的 `CredentialProviderService`，读取相关状态并解释不一致。后续修复阶段只会提供一种模式：把用户选择的 component 固定为唯一 enabled 和 primary provider。

## 当前版本

`0.1.0-alpha.2` 已在 GUI 与 CLI 中实现 Phase 1 只读诊断：验证 ADB、枚举设备状态、检查 Android/API 与前台 user、枚举注册 provider、读取 enabled/primary/Autofill 状态并给出保守结论。引导式 Demo 与真实 ADB 隔离；setting 写入、快照、恢复和报告导出尚未实现。

## 产品边界

项目不会安装 ADB 或驱动、请求 root、提供任意终端、读取保险库、读取或删除 passkey、修改 `autofill_service`、猜测多 provider 序列化格式或上传数据。Android secure setting 名称始终被视为实现细节，而不是稳定公开 API。

首个受支持发行版面向 macOS Apple Silicon、macOS Intel 与 Windows x64。Linux 可以从源码构建，但在 WebKitGTK 和打包可移植性得到保证前不提供预编译产物。

[English](../en/000-OVERVIEW.md) | [中文](000-OVERVIEW.md)
