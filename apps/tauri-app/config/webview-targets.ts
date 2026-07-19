// Runtime engines are the compatibility source of truth. An ECMAScript edition
// is not equivalent to a browser release and must not be mixed into this list.
export const WEBVIEW_ENGINE_TARGETS = {
	chrome: "111",
	edge: "111",
	safari: "16.4",
} as const;

// SWC accepts a browser/version map while Vite accepts concatenated target
// strings. Derive both forms so the two transformation stages cannot drift.
export const WEBVIEW_SWC_TARGETS = WEBVIEW_ENGINE_TARGETS;

export const WEBVIEW_TARGETS = Object.entries(WEBVIEW_ENGINE_TARGETS).map(
	([engine, version]) => `${engine}${version}`,
);
