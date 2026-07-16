# 架构

仓库采用端口与适配器结构，但不会把每个小函数机械拆成独立层。

```text
SolidJS WebView -> 收敛的 Tauri IPC -> Tauri app adapter -> core use case
                                                        -> CommandRunner port
CLI presentation ------------------> CLI app adapter ----> CommandRunner port
```

## Core

`packages/core` 包含应用 DTO、领域状态、稳定错误码、use-case 编排和 adapter trait，不依赖 Tauri、Clap 或具体进程实现。`CommandRequest` 保存原生可执行路径、参数数组、超时与聚合输出上限；`CommandOutput` 以字节保存 stdout 和 stderr，避免非 UTF-8 设备输出被静默破坏。

未来 ADB use case 只能使用已发现的 serial、解析后的非负 user ID、已枚举的 provider component、固定 setting key allowlist 和固定 URL 构造请求。通用 runner 只是 Rust 内部端口，不会成为 IPC 或 CLI 用户输入面。

## 应用

Tauri app 使用 `tauri-plugin-shell` 的 Rust API 实现 `CommandRunner`，不安装 JavaScript binding，WebView capability 中也没有 shell 权限。CLI 使用 `tokio::process::Command` 实现相同端口。两个 adapter 都使用参数数组、有限字节收集、超时和子进程终止。

前端负责展示、选择、确认、本地化与无障碍交互，不解析 ADB 输出，也不判断写入是否成功。初始应用只暴露 `get_app_info`；未来 IPC 将是 `create_fix_plan(plan inputs)`、`apply_fix(plan_id)` 这类收敛 use-case endpoint。

[English](../en/001-ARCHITECTURE.md) | [中文](001-ARCHITECTURE.md)
