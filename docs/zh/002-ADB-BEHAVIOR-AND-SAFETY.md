# ADB 行为与安全

ADB 由用户自行安装和提供。应用未来会搜索 GUI 进程环境和文档列明的平台路径，通过 `adb version` 验证所选可执行文件，展示解析后的路径，并支持用户明确选择文件。应用永远不会下载或安装 Platform-Tools。

每条设备命令都必须使用 `adb -s SERIAL`。serial 只能来自当前 `adb devices -l` 结果，不能由前端自由输入。多设备时必须显式选择；unauthorized、offline、no-permission 和未发现设备是不同状态。当前 Android user 来自设备查询，并必须解析为非负整数。

只有 package service enumeration 针对 `android.service.credentials.CredentialProviderService` 返回的 component 才能成为候选。注册 service 不等于已经证明支持 passkey、当前环境兼容或保险库已解锁。

## 规划中的写操作

唯一规划的写模式是 Exclusive Provider Pin：把选择的 component 同时写为 `credential_service` 与 `credential_service_primary`，不修改 `autofill_service`，也不保留未经验证的 fallback 编码。

写操作需要两次明确确认，以及后端生成的一次性短期 plan；plan 绑定设备、user、component 和 before state。执行前重新验证所有输入，状态变化时中止，随后原子保存快照、逐字段写入并回读。任何部分失败都会恢复两个受管字段。原 setting 不存在时使用 `settings delete` 恢复，绝不写入字符串 `null`。

CI 和常规测试不会调用 ADB。真实设备只读测试需要显式环境开关；写测试还需要第二个独立开关，并且不会进入自动 CI。

[English](../en/002-ADB-BEHAVIOR-AND-SAFETY.md) | [中文](002-ADB-BEHAVIOR-AND-SAFETY.md)
