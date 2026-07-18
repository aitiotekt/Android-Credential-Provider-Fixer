# 变更日志

项目的重要变化记录在这里。当前仍是预发布软件，不承诺 alpha 版本之间的诊断 JSON schema 保持稳定。

## 0.1.0-alpha.3

- 桌面界面改用 Tailwind CSS 4 与本地 Solid 组件原语，加入响应式五阶段进度模型，以及适合长值的纵向变更预览。
- 新增可持久化的跟随系统、浅色和深色外观偏好，实时响应系统主题，并统一 Driver.js 的明暗主题；macOS 最低版本提升到 13.3，Web 构建目标提升到 Safari 16.4。
- 全面调整英中文案，并本地化设备、发现来源、快照、阻止原因和执行结果状态，不再直接显示内部枚举值。
- 明确诊断相关文案；已经唯一启用的凭据提供方会显示为不可重复操作的当前状态；已选 ADB 直接呈现在去重后的候选列表中，不再单独重复展示。
- 新增明确的凭据提供方选择、变更前后预览、五分钟一次性操作计划、版本化原子快照、锁定单一凭据提供方、回读验证、自动恢复和受保护的手动恢复。
- CLI 新增默认 dry-run 的 `pin`、`snapshots` 和 `restore`；只有 `--apply` 才授权设备写入。
- 隔离双语演示扩展到模拟锁定与恢复。Driver.js 的“下一步/上一步”现在会在跨视图边界时驱动对应的 Solid 演示场景，同时保留直接操作高亮控件的方式；关闭按钮采用高对比度样式。
- 写入仍只允许 `credential_service` 与 `credential_service_primary`；自动填充服务、凭据提供方刷新、强制停止、WebAuthn 启动、报告和物理设备写入仍不在范围内。

## 0.1.0-alpha.2

- 新增只读 ADB 发现与验证、设备枚举、Android 兼容性检查、前台 user 检查、Credential Provider 枚举和状态诊断。
- 新增功能对等的 `devices`、`diagnose` 与 `demo` CLI 命令，以及交互和 JSON 模式。
- 新增双语桌面工作流、ADB 选择持久化、保守诊断结论，以及基于脱敏 Xiaomi/HyperOS 调查的隔离引导式 Demo。
- Android setting 写入、快照、恢复、报告导出、签名与分发仍不在当前范围内。

## 0.1.0-alpha.1

- 建立 Tauri/SolidJS、CLI、共享 Core、文档、工具链、图标与 CI 工程基线。

[English](../../CHANGELOG.md) | [中文](CHANGELOG.md)
