import { render } from "@solidjs/web";
import { App } from "./app/App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing root");
}
render(() => <App />, root);
