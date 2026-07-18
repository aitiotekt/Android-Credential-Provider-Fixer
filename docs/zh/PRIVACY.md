# 隐私政策

Android Credential Provider Fixer 在本地执行所有工作，不收集、传输、出售或共享设备标识、凭据、passkey、应用清单或诊断日志。

应用只读取所选设备的 serial 与连接状态、厂商、型号、codename、Android/API 版本、前台 user ID、已注册 Credential Provider component，以及三个文档列明的 Credential Manager/Autofill setting。它不会读取 build fingerprint、密码管理器保险库、passkey 材料、账号或无关应用清单。

所选 ADB 路径、引导状态、外观偏好（跟随系统、浅色或深色）以及每台设备最近 20 个普通快照保存在应用私有配置目录。快照包含原始设备序列号、前台 Android 用户 ID、凭据提供方组件标识和两个受管设置项的变更前后值；尚未恢复的已应用或恢复失败快照不受普通上限影响。外观偏好不会保存在浏览器 `localStorage` 中。数据不会上传，当前没有报告导出。

应用不包含分析统计或崩溃上传 SDK。网络链接只会在用户主动操作后打开，ADB 永远不会被静默下载。

[English](../../PRIVACY.md) | [中文](PRIVACY.md)
