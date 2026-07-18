# 架构

仓库采用端口与适配器结构，但不会把每个小函数机械拆成独立层。

```text
SolidJS WebView -> 收敛的 Tauri IPC -> Tauri app adapter -> core use case
                                                        -> CommandRunner port
CLI presentation ------------------> CLI app adapter ----> CommandRunner port
```

## Core

`packages/core` 包含应用 DTO、领域状态、稳定错误码、use-case 编排和 adapter trait，不依赖 Tauri、Clap 或具体进程实现。`CommandRequest` 保存原生可执行路径、参数数组、超时与聚合输出上限；`CommandOutput` 以字节保存 stdout 和 stderr，避免非 UTF-8 设备输出被静默破坏。

Phase 1 ADB use case 只能使用已验证的 ADB 路径、当前设备快照中的 serial、解析后的非负 user ID、固定 Credential Provider service action 和三个 setting 的读取 allowlist 构造请求。通用 runner 只是 Rust 内部端口，不会成为 IPC 或 CLI 用户输入面。

Phase 2 新增 Core 所有的 change state machine 与抽象 snapshot store；`packages/storage` 是 GUI 与 CLI 共用的本地文件 adapter。Plan 会把准确 before-state 与注册 Provider 集合绑定五分钟，只有 Core executor 能构造两个受管 key 的写入。Tauri 只暴露 opaque provider、preview、plan 与 snapshot ID，不暴露 raw 命令材料。

## 应用

Tauri app 使用 `tauri-plugin-shell` 的 Rust API 实现 `CommandRunner`，不安装 JavaScript binding，WebView capability 中也没有 shell 权限。CLI 使用 `tokio::process::Command` 实现相同端口。两个 adapter 都使用参数数组、有限字节收集、超时和子进程终止。

前端负责展示、不透明候选项与设备选择、确认、本地化、主题和无障碍交互，不解析 ADB 输出。Tailwind CSS 4 使用 CSS-first 语义 token，本地 Solid 组件原语提供一致的尺寸、variant、嵌套圆角、焦点状态和间距，不增加组件运行时依赖。Park UI 仅作为设计规范参考；工作流组件不依赖 Park UI、Ark UI 或 Panda CSS。

IPC 仅覆盖启动状态、外观偏好、ADB 发现与选择、原生 ADB 文件选择、设备列表与检查、引导状态和确定性的演示 fixture。原生路径与设备序列号保留在后端会话中；跟随系统、浅色和深色偏好由后端验证并保存在应用私有偏好文件中，WebView 不获得文件系统权限。演示模式使用同一报告 DTO，但不能调用真实适配器。

[English](../en/001-ARCHITECTURE.md) | [中文](001-ARCHITECTURE.md)
