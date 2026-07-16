export const translations = {
	en: {
		language: "Language",
		english: "English",
		chinese: "中文",
		eyebrow: "Local Android diagnostics",
		title: "Android Credential Provider Fixer",
		summary:
			"A transparent desktop tool for diagnosing and safely repairing Android Credential Provider state.",
		baselineTitle: "Engineering baseline",
		baselineBody:
			"The application shell, security boundary, and shared core are ready. ADB diagnostics and repair operations are not implemented in this build.",
		localOnly: "Local-only by design",
		localOnlyBody:
			"No analytics, credential access, silent downloads, or remote data transfer.",
		backend: "Core connection",
		connecting: "Connecting…",
		connected: "Connected",
		unavailable: "Unavailable",
		version: "Version",
		phase: "Phase",
		readOnlyNotice:
			"This build cannot execute ADB operations or modify a device.",
	},
	zh: {
		language: "语言",
		english: "English",
		chinese: "中文",
		eyebrow: "本地 Android 诊断",
		title: "Android Credential Provider Fixer",
		summary:
			"用于诊断并安全修复 Android Credential Provider 状态的透明桌面工具。",
		baselineTitle: "工程基线",
		baselineBody:
			"应用外壳、安全边界和共享核心已经就绪。本构建尚未实现 ADB 诊断或修复操作。",
		localOnly: "默认仅在本地工作",
		localOnlyBody: "不含分析统计、凭据访问、静默下载或远程数据传输。",
		backend: "核心连接",
		connecting: "正在连接…",
		connected: "已连接",
		unavailable: "不可用",
		version: "版本",
		phase: "阶段",
		readOnlyNotice: "本构建不能执行 ADB 操作，也不能修改设备。",
	},
} as const;

export type Locale = keyof typeof translations;
export type Messages = {
	[Key in keyof (typeof translations)["en"]]: string;
};
