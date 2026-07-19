# 项目概览

Android Credential Provider Fixer 处理 Android 14 及以上系统中的一种特定故障：OEM 设置界面显示某个 provider 为首选，但 Credential Manager 实际使用的 enabled-provider 状态仍指向其他 provider 或不完整。此时 passkey 请求可能回退到其他 provider，或者表现为没有响应。

项目刻意保持本地、透明和范围收敛。它会发现用户自行安装的 ADB，确认用户明确选择的设备与当前 Android user，枚举已注册的 `CredentialProviderService`，读取相关状态并解释不一致。后续修复阶段只会提供一种模式：把用户选择的 component 固定为唯一 enabled 和 primary provider。

## 当前版本

`0.1.0-alpha.5` 保留诊断与有限的凭据提供方变更，并明确建模每次发现、选择、枚举、诊断、预览、操作计划、执行与快照之间的关系。注入的前端领域服务持有这些资源并派生唯一当前视图；只含 fixture gateway 的演示子 Injector 无法解析真实设备 gateway。GUI IPC、CLI JSON 和快照统一使用 schema v2；失效实体 ID 与迟到的异步结果不能替换当前上下文。凭据提供方刷新、强制停止、WebAuthn 启动、报告导出和物理设备写入尚未实现。

## 产品边界

项目不会安装 ADB 或驱动、请求 root、提供任意终端、读取保险库、读取或删除 passkey、修改 `autofill_service`、猜测多 provider 序列化格式或上传数据。Android secure setting 名称始终被视为实现细节，而不是稳定公开 API。

首个受支持发行版面向 macOS Apple Silicon、macOS Intel 与 Windows x64。Linux 可以从源码构建，但在 WebKitGTK 和打包可移植性得到保证前不提供预编译产物。

[English](../en/000-OVERVIEW.md) | [中文](000-OVERVIEW.md)
