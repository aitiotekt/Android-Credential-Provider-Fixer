import { render } from "@solidjs/web";
import { App } from "./app/App";
import { applyTheme } from "./theme/theme";
import "./styles.css";

applyTheme(
	window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
);

const root = document.getElementById("root");

if (!root) {
	throw new Error("Application root element is missing");
}

render(() => <App />, root);
