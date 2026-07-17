# 安全政策

## 当前状态

`0.1.0-alpha.2` 只执行 Phase 1 文档列明的 ADB 读取，不能修改 Android setting。在快照、计划、验证和恢复设计完成并经过测试前，涉及设备修改的功能不在当前范围内。

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
