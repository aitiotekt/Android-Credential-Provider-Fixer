# WebAuthn 诊断配套应用

[English](../en/005-WEBAUTHN-DIAGNOSIS.md)

原生 Android 应用 **WebAuthn 诊断**（`com.aitiotekt.webauthndiagnosis`）引导用户完成准备、浏览器测试与结果确认。它不读取提供方设置、不枚举应用、不运行 ADB，也不修复设备。最低支持 Android 9/API 28，第三方提供方说明区分 Android 14 及以上。在 Android 14+ 优先通过 AndroidX CredentialManager 打开凭据提供方设置，仅使用自身应用身份；较旧系统或启动失败时回退到系统设置，并明确提示手动搜索。返回不代表设置成功；实际 OEM 页面路由仍需设备验证。

[测试网站](/webauthn/) 创建名称明确的真实测试通行密钥，再在本地验证认证签名。创建前必须由用户明确同意；凭据可能由密码管理器同步。网站不识别实际提供方品牌，需要用户观察浏览器提示。

## 隐私和边界

页面仅在内存保存当前随机测试身份、公钥与挑战值，不上传 WebAuthn 响应，不使用 cookie、localStorage、sessionStorage、IndexedDB 或分析 SDK。会话最多一小时，单次操作最多五分钟。刷新、关闭或清除页面即丢弃测试记录，**不会删除真实通行密钥**：请自行在密码管理器中删除 `acp-fixer.aitiotekt.com` 下以 `WebAuthn test …` 命名的条目。

静态资源由 GitHub Pages 提供，托管方可能处理 IP 地址和访问日志；密码管理器同步适用其自身政策。`/webauthn/` 与文档站同源，不构成独立 RP 或存储安全边界。

验证只是浏览器本地诊断，不是服务端认证、提供方安全证明或其他应用正常的保证。Android 没有自动结果回传；成功视图代表用户确认网站两步都已完成。

## 开发和发布

Android 发布历史见 [Android 变更日志](CHANGELOG-ANDROID.md)，独立于桌面版本维护。

Android 工具链使用 JDK 26、Gradle 9.7.1、AGP 9.4.0 和 Kotlin/Compose 2.4.20，采用内置 Kotlin。Android Studio 需支持 AGP 9.4（Quail 4/2026.1.4 或后续兼容版本）。构建运行时 JDK 不改变应用 Java/Kotlin 目标 17 或 Android SDK 兼容范围。

在 Android Studio 中打开仓库根目录。根 Gradle multi-project build 将 `:webauthn-diagnosis` 映射至 `apps/android-app/app` 下的 Kotlin/Compose 模块；使用根 Wrapper，通过根目录的本地 `local.properties` 或 `ANDROID_HOME` 指定 SDK。Android 仍独立管理版本与商店发布。`apps/webauthn-web` 使用 Solid/Tailwind 和桌面的兼容配置，不引入桌面 IPC 或领域服务。本地 mise 默认安装 Java、Gradle；CI 只有 Android job 启用它们。`just check-android` 执行无设备 JVM 测试、Lint 和编译；安装 Playwright 浏览器后使用 `just check-web` 验证网站。

`just set-version VERSION`（或 `--app default` / `--app desktop`）更新桌面、CLI 和 Web package 版本。`--app android` 仅更新 Android，新版本自动增加 versionCode；Android 重构建可用 `--version-code N` 显式指定更大编号。Android 独立维护双语变更日志，Web 变更仍进入根变更日志；命令不会自动搬移 Unreleased 内容。

Web 流水线合并 VitePress 与 SPA 为一个 Pages 产物，仅 main 部署，release 和 PR 只验证。Android 流水线由维护者在 main/release 手动触发，默认 `build-only`，签名 AAB 在 Actions 保留 30 天，不发布 APK 或 Android GitHub Release。元数据 `internal` 策略在保存产物后上传 Play 内部测试；上传失败使任务失败，保留 AAB，不盲目重试可能已提交的发布。

维护者需要配置 Play App Signing、上传密钥与受保护的 `android-release` Environment；API 上传另需最小授权的 Play 服务账号。首次 Console 初始化与上传、商店材料、隐私/Data safety 和账号相关测试条件仍需人工处理。仅商店分发不禁止开发者编译本地 debug APK，但不提供侧载分发渠道。

## 验收状态

自动化通过 Playwright Credentials 在 Chromium、Firefox 和 WebKit 中替换虚拟认证器，验证应用流程及签名拒绝逻辑，不代表真实系统、Google 或 Bitwarden 集成已通过。真实集成、设备上的无障碍和生命周期、Play 上传及审核均需维护者另行验证。普通检查不启动 ADB，也不创建真实通行密钥。
