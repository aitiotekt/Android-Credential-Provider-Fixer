# 安全政策

## 当前状态

`0.1.0-alpha.6` 只允许文档列明的读取，以及对 `credential_service` 和 `credential_service_primary` 的有限写入。写入要求当前诊断实体、与该诊断绑定的五分钟一次性操作计划、schema v2 原子快照、精确状态复核、回读验证和自动恢复；`autofill_service` 始终只读。演示模式的前端会话只能从其子 Injector 解析 fixture gateway，无法回退到真实 Tauri 设备 gateway。

发布流水线绝不调用 ADB。稳定版 macOS 和 Windows 产物必须通过平台签名，发布 job 只使用 Environment 范围内的凭据，每个下载产物都有 checksum、manifest 与 GitHub provenance attestation。未签名预发布版必须明确标识，签名失败时绝不静默降级。

后端会拒绝失效的父实体 ID 和迟到的异步结果。首次可能写入前必须先保存 `executing` 快照；取消、过期、状态漂移和执行结果都是终态。旧 v1 快照文件保持原样且不能用于恢复。

## 安全边界

- WebView 永远不能获得通用进程或 shell API。
- 可执行文件和参数必须分开传递，禁止拼接 shell 命令字符串。
- 设备 serial、Android user、provider component、setting key、package 和 URL 必须来自后端控制的枚举结果或固定 allowlist。
- WebView 只选择不透明的 ADB candidate ID 和 device ID；原生路径与解析后的 serial 只由 Rust 后端处理。
- Demo Mode 只使用内置数据，绝不能回退到真实 ADB 操作。
- 常规测试只使用 mock 或 fake executable，不能使用宿主机 ADB server。
- 诊断数据保留在本地，仅在用户主动导出时生成脱敏内容。

## 报告漏洞

请使用本仓库 GitHub private security advisory 功能，不要提交真实凭据、passkey、完整设备 serial 或未脱敏日志。报告应包括受影响版本、平台、复现条件和被突破的安全边界。

完成初步处置前，请勿创建公开 issue。

[English](../../SECURITY.md) | [中文](SECURITY.md)
