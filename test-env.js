import { JSDOM } from "jsdom";

const dom = new JSDOM();

for (const key of [
	"document",
	"window",
	"Node",
]) {
	globalThis[key] = dom.window[key];
}
