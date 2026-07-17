# 支持设备与排障

## 当前诊断支持范围

| 环境 | 状态 |
| --- | --- |
| Android 14 / API 34 及以上 | Phase 1 只读诊断 |
| Xiaomi HyperOS | 初始调查与 Demo 场景 |
| 其他 OEM 设备 | 保守只读诊断；陌生值保持未解析 |
| Android 13 及以下 | 只显示设备信息，不支持修复 |
| 工作资料与其他 user | Phase 1 只读取明确检测到的前台 user |

## 常见症状

- 密码管理器显示为首选，但 Google Password Manager 接管 passkey 创建。
- Autofill 正常，而 Credential Manager 没有绑定 provider。
- 禁用另一个 provider 后，WebAuthn 操作看起来没有响应。
- `credential_service_primary` 指向的 provider 不在 `credential_service` 中。

这些症状本身不能确定责任组件。service 注册、enabled 状态、primary 状态、autofill 状态、浏览器行为、provider 锁定状态和 OEM framework 行为都是不同事实。

## 低风险检查

更新密码管理器、浏览器与系统组件；通过密码管理器支持的入口进入 provider 设置；切换到其他选项再切回；重启设备；解锁一次 provider；然后分别重试 passkey 创建与登录。不要把删除已有 passkey 当作排障步骤。

ADB 缺失时，UI 会展示可复制的安装说明，但不会运行 Homebrew、Winget、Scoop 或 Chocolatey。unauthorized 设备需要解锁并接受 USB 调试授权；offline 设备应优先重新连接，而不是直接重启全局 ADB 服务。CLI 可通过 `acp-fixer devices` 查看相同状态。

[English](../en/003-SUPPORT-AND-TROUBLESHOOTING.md) | [中文](003-SUPPORT-AND-TROUBLESHOOTING.md)
