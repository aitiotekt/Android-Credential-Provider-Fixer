# 隐私政策

## WebAuthn 配套应用

WebAuthn 诊断是独立的 Android 引导应用，由用户主动打开静态测试站。同意后会创建真实测试通行密钥并在本地验证响应；当前挑战、随机标识和公钥仅保存在页面内存，不上传 WebAuthn 响应。清除页面不等于删除密码管理器中的凭据，凭据可能按提供方政策同步。GitHub Pages 可能处理 IP 地址及静态访问日志；Android 结果由用户确认。保留与清理方式见[配套应用指南](005-WEBAUTHN-DIAGNOSIS.md)。

## 桌面与 CLI

Android Credential Provider Fixer 在本地执行所有工作，不收集、传输、出售或共享设备标识、凭据、passkey、应用清单或诊断日志。

应用只读取所选设备的 serial 与连接状态、厂商、型号、codename、Android/API 版本、前台 user ID、已注册 Credential Provider component，以及三个文档列明的 Credential Manager/Autofill setting。它不会读取 build fingerprint、密码管理器保险库、passkey 材料、账号或无关应用清单。

所选 ADB 路径、引导状态、外观偏好（跟随系统、浅色或深色）以及每台设备最近 20 个普通 schema-v2 快照保存在应用私有配置目录。快照包含原始设备序列号、前台 Android 用户 ID、凭据提供方组件标识、两个受管设置项的变更前后值、源诊断 ID、生命周期状态与 revision；尚未恢复的已应用、正在执行或恢复失败快照不受普通上限影响。会话诊断、预览、操作计划和执行只保存在内存中，应用重启后丢弃。旧 v1 文件仅保留为不支持警告，不参与恢复。外观偏好不会保存在浏览器 `localStorage` 中。数据不会上传，当前没有报告导出。

应用不包含分析统计或崩溃上传 SDK。网络链接只会在用户主动操作后打开，ADB 永远不会被静默下载。

发布 manifest、checksum和 provenance attestation 只包含构建元数据，不包含设备快照、ADB 路径、设备序列号、诊断或其他用户数据。CI 与发布流水线不会发现或调用 ADB。

[English](../../PRIVACY.md) | [中文](PRIVACY.md)
