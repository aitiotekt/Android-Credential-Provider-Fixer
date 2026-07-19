# 变更日志

项目的重要变化记录在这里。当前仍是预发布软件，不承诺 alpha 版本之间的诊断 JSON schema 保持稳定。

## 0.1.0-alpha.5

- 主流平台继续使用 mise 为 pnpm 选择的默认 backend，仅在 Intel macOS 上改用 pnpm 官方 GitHub Release 产物，绕过 Aqua registry 缺少 `darwin/amd64` 映射的问题。
- 将桌面前端集中式的页面、IPC 与跨视图 signal 图重构为 `injection-js` 领域服务；只使用显式 token、factory provider 和依赖列表，不使用装饰器或反射元数据。
- 有状态的应用服务改为 class，以构造函数注入依赖，以 private 字段保存生命周期状态，并使用原型方法；闭包工厂仅保留在 controller、adapter 与类库构造边界。
- 前端订阅与会话 scope 采用 TC39 显式资源管理，以幂等的 `[Symbol.dispose]()`、词法作用域 `using` 和 `DisposableStack` 管理聚合清理。
- 统一 Vite 与 Vitest 的 Solid-first `unplugin-swc` 兼容转换，并将其放在打包用 `src` 图之外：SWC lowering `using` 并根据实际用法注入精确的 core-js polyfill；Vite 继续保留如实声明的最终构建 target 与 Oxc 压缩，不再并行运行顶层 Oxc 源码转换。
- 共享事件总线替换为各服务持有、类型精确的 RxJS `DomainEvent<T>` Subject；下游领域服务只接收只读 Observable，渲染层仍只消费状态与快照。
- 将 `WorkflowService.view` 设为唯一页面来源，并按领域拆分页面容器与只接收 props 的展示组件。
- 每次真实或演示流程都使用可统一释放的子 Injector；根 Injector 不提供设备 gateway，演示模式只能解析确定性的 fixture adapter。
- 将所有 Tauri `invoke` 收敛到真实 gateway adapter，并新增 gateway、Injector、装饰器、渲染层事件、signal 所有权和独立导航边界的架构检查。
- 父实体 ID 不匹配会作为稳定会话错误拒绝；被后续请求取代的异步响应会丢弃；创建计划后预览即被消费；结果不确定的执行失败也不会留下可重放计划。
- 英文与中文文案拆为独立真源，同时保留递归 key 对称性检查和实体生命周期状态本地化。
- 前端单元测试移动到各模块的 `__tests__/` 目录，并新增架构检查，防止测试文件再次与生产源码混排。
- 教程导航改为按目标场景重放领域意图，支持跨视图后退以及完整的模拟变更与恢复生命周期。
- 将 Chrome、Edge 与 Safari 的具体版本设为唯一兼容性真源，并由其派生 Vite 与 SWC target；运行时目标不再混入 ECMAScript 年度版本。
- 全局教程入口在替换真实或演示流程前会明确确认，同时处理计划取消、写入中禁止切换，并等待演示初始 DOM 挂载后再启动 Driver.js。
- 将演示标识与“退出演示模式”提升到 session shell，使其在连接、诊断、变更、结果和快照等所有视图中持续可用。
- Session scope 变化时重建使用子 Injector 的界面组件，确保切换或重新开始教程进入隔离演示的第一个视图，不再保留之前的工作流画面。
- 恢复锁定单一凭据提供方操作完成后的快照恢复教程路径，补齐两处遗漏的设备确认步骤，并让 Driver 进度随当前高亮控件的成功交互同步推进。完整教程现包含 24 个步骤；通过“完成并重新诊断”离开时会干净地结束当前教程。
- Tauri IPC、Core DTO、CLI schema v2 与 snapshot schema v2 均与 alpha.4 保持兼容。

## 0.1.0-alpha.4

- 将 ADB 发现、ADB 选择、设备枚举、诊断、预览、操作计划、执行与快照重构为具有强类型不透明 ID 和明确父关系的实体。
- 后端会话新增单调 revision 与最新诊断 ID；迟到的异步结果会被拒绝，凭据提供方、预览和计划不能跨诊断上下文复用。
- `DiagnosisReport.status` 更名为 `completeness`，GUI IPC、CLI JSON 和快照统一升级为 schema v2。
- Preview、Plan、Execution 与 Snapshot 使用显式生命周期。首次可能写入前先持久化 `executing`；取消、过期、漂移和所有执行结果均为不可重放的终态。
- 旧 v1 快照文件不会删除或覆盖，只在清单中作为不支持警告展示；不迁移早期开发数据。
- 前端新增判别联合工作流 reducer 与诊断资源状态；只有诊断 ID 与会话最新诊断一致时才显示结果，操作完成后会重新诊断，不再回显旧报告。
- 演示 fixture 使用确定性的因果 ID 与相同生命周期投影，同时保持与真实 ADB IPC 完全隔离。
- 每次重新发现 ADB 时都会将已保存选择重新绑定到新的发现实体，不再把过期选择显示为当前选择；选择失效后会回到可操作的候选列表。
- 设备刷新和诊断会在请求开始时立即开启新的会话 revision，使旧异步结果、预览和操作计划在覆盖当前上下文前失效。
- 桌面界面会本地化应用、执行、设置和快照错误，不再直接显示内部稳定错误码。

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
