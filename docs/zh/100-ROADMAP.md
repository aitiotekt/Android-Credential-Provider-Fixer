# 路线图

## 工程基线 — 已完成

- SolidJS 2 / Tauri 2 应用外壳与双语 UI
- 共享 core 契约和有限输出的进程 runner port
- Tauri Rust 与 Tokio CLI adapter
- 文档、VitePress、仓库工具和跨平台构建 CI

## Phase 1 — 诊断 — 已完成

- ADB 发现、路径选择与版本验证
- 设备枚举与明确确认
- Android 兼容性和前台 user 检查
- 已注册 Credential Provider 枚举与当前状态读取
- 模拟 ADB 数据、解析测试和明确标记的演示模式
- 功能对等的 GUI/CLI、JSON 输出与双语引导教程

Phase 1 不包含 `settings put` 或 `settings delete`。

## Phase 2 — 操作计划、快照与有限恢复 — 已完成

- 变更前后差异和短期一次性操作计划 ID
- 与设备和 Android 用户绑定的版本化原子快照
- 状态变化检测与恢复预览
- 锁定单一凭据提供方
- 每次写入后的回读验证与自动恢复
- 受保护的手动恢复
- schema v2 实体身份、父关系、会话 revision 与不可重放的终态
- GUI、Tauri IPC、CLI JSON 与隔离演示中的诊断新鲜度约束

## Phase 3 — Provider 验证辅助

- 不暴露任意 package 命令的所选 Provider refresh
- 固定 WebAuthn 测试 URL

## Phase 4 — 报告与发行

- 脱敏 Markdown 诊断报告
- Xiaomi/HyperOS 真实设备验收矩阵
- macOS 与 Windows 签名、GitHub Releases、校验和与商店准备

[English](../en/100-ROADMAP.md) | [中文](100-ROADMAP.md)
