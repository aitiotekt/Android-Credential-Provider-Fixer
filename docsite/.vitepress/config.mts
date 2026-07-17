import { defineConfig } from "vitepress";

const repositoryUrl =
	"https://github.com/aitiotekt/Android-Credential-Provider-Fixer";

const documents = [
	{ slug: "000-OVERVIEW", en: "Overview", zh: "项目概览" },
	{ slug: "001-ARCHITECTURE", en: "Architecture", zh: "架构" },
	{
		slug: "002-ADB-BEHAVIOR-AND-SAFETY",
		en: "ADB behavior and safety",
		zh: "ADB 行为与安全",
	},
	{
		slug: "003-SUPPORT-AND-TROUBLESHOOTING",
		en: "Support and troubleshooting",
		zh: "支持设备与排障",
	},
	{
		slug: "004-DISTRIBUTION-AND-STORE",
		en: "Distribution and store",
		zh: "分发与商店准备",
	},
	{ slug: "100-ROADMAP", en: "Roadmap", zh: "路线图" },
] as const;

function sidebar(prefix: string, language: "en" | "zh") {
	return [
		{
			text: language === "en" ? "Project documentation" : "项目文档",
			items: documents.map((document) => ({
				text: document[language],
				link: `${prefix}/${document.slug}`,
			})),
		},
	];
}

function rewriteLocalHref(href: string, sourcePath: string): string {
	if (
		!href ||
		href.startsWith("#") ||
		href.startsWith("/") ||
		/^[a-z][a-z0-9+.-]*:/i.test(href)
	) {
		return href;
	}
	const separator = href.search(/[?#]/);
	const path = separator === -1 ? href : href.slice(0, separator);
	const suffix = separator === -1 ? "" : href.slice(separator);
	const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
	const chineseSource = /\/(?:docs\/)?zh\//.test(
		sourcePath.replace(/\\/g, "/"),
	);
	const root = chineseSource ? "/zh" : "";

	if (/^README\.md$/i.test(normalized)) {
		return `/${suffix}`;
	}
	const rootConvention = normalized.match(
		/^(?:\.\.\/){2}(README|SECURITY|PRIVACY|CONTRIBUTING|CHANGELOG)\.md$/i,
	);
	if (rootConvention) {
		return rootConvention[1].toUpperCase() === "README"
			? `/${suffix}`
			: `/${rootConvention[1].toLowerCase()}${suffix}`;
	}
	const policy = normalized.match(
		/^(SECURITY|PRIVACY|CONTRIBUTING|CHANGELOG)\.md$/i,
	);
	if (policy) {
		return `${root}/${policy[1].toLowerCase()}${suffix}`;
	}
	if (/^(?:\.\.\/){2}LICENSE$/i.test(normalized)) {
		return `/zh/license${suffix}`;
	}
	if (/^LICENSE$/i.test(normalized)) {
		return `${root}/license${suffix}`;
	}
	const repoDoc = normalized.match(/^docs\/(en|zh)\/([^/]+)\.md$/i);
	if (repoDoc) {
		return `${repoDoc[1].toLowerCase() === "zh" ? "/zh" : ""}/docs/${repoDoc[2]}${suffix}`;
	}
	const siblingDoc = normalized.match(/^\.\.\/(en|zh)\/([^/]+)\.md$/i);
	if (siblingDoc) {
		return `${siblingDoc[1].toLowerCase() === "zh" ? "/zh" : ""}/docs/${siblingDoc[2]}${suffix}`;
	}
	const localDoc = normalized.match(/^([^/]+)\.md$/i);
	if (localDoc && /^\d{3}-/.test(localDoc[1])) {
		return `${root}/docs/${localDoc[1]}${suffix}`;
	}
	if (localDoc && /\/docs\/(?:en|zh)\//.test(sourcePath.replace(/\\/g, "/"))) {
		return `${root}/docs/${localDoc[1]}${suffix}`;
	}
	return href;
}

export default defineConfig({
	title: "Android Credential Provider Fixer",
	description: "Local-first diagnostics for Android Credential Provider state.",
	cleanUrls: true,
	lastUpdated: true,
	vite: {
		resolve: { preserveSymlinks: true },
	},
	markdown: {
		config(markdown) {
			const fallback = markdown.renderer.rules.link_open;
			markdown.renderer.rules.link_open = (
				tokens,
				index,
				options,
				environment,
				self,
			) => {
				const token = tokens[index];
				const hrefIndex = token.attrIndex("href");
				if (hrefIndex >= 0 && token.attrs) {
					const href = token.attrs[hrefIndex][1];
					token.attrs[hrefIndex][1] = rewriteLocalHref(
						href,
						String(environment.path ?? environment.realPath ?? ""),
					);
				}
				return fallback
					? fallback(tokens, index, options, environment, self)
					: self.renderToken(tokens, index, options);
			};
		},
	},
	themeConfig: {
		logo: "/icon.png",
		search: { provider: "local" },
		socialLinks: [{ icon: "github", link: repositoryUrl }],
		footer: {
			message: "Independent open-source project · MIT License",
			copyright: "Copyright © 2026 Zhou Yeheng",
		},
	},
	locales: {
		root: {
			label: "English",
			lang: "en",
			themeConfig: {
				nav: [
					{ text: "Home", link: "/" },
					{ text: "Docs", link: "/docs/000-OVERVIEW", activeMatch: "^/docs/" },
					{ text: "Security", link: "/security" },
					{ text: "Privacy", link: "/privacy" },
					{ text: "Changelog", link: "/changelog" },
				],
				sidebar: { "/docs/": sidebar("/docs", "en") },
			},
		},
		zh: {
			label: "中文",
			lang: "zh",
			link: "/zh/",
			themeConfig: {
				nav: [
					{ text: "首页", link: "/zh/" },
					{
						text: "文档",
						link: "/zh/docs/000-OVERVIEW",
						activeMatch: "^/zh/docs/",
					},
					{ text: "安全", link: "/zh/security" },
					{ text: "隐私", link: "/zh/privacy" },
					{ text: "变更日志", link: "/zh/changelog" },
				],
				sidebar: { "/zh/docs/": sidebar("/zh/docs", "zh") },
			},
		},
	},
});
