import { render } from "@solidjs/web";
import { App } from "./app/App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
	throw new Error("Application root element is missing");
}

render(() => <App />, root);
