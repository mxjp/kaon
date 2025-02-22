// @ts-check
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { suite, test } from "node:test";
import { $, capture, Context, e, inject, iter, nest, render, teardown, untrack, View, watch, wrap, XMLNS } from "./kaon.js";

await suite("lifecycle", async () => {
	await test("basic usage", () => {
		const events = [];
		const dispose = capture(() => {
			events.push(0);
			teardown(() => events.push(1));
			teardown(() => events.push(2));
			events.push(3);
		});
		assertEvents(events, [0, 3]);
		dispose();
		assertEvents(events, [2, 1]);
		dispose();
		assertEvents(events, [2, 1]);
	});

	await test("ignore", () => {
		const events = [];
		const dispose = capture(() => {
			capture(() => {
				teardown(() => events.push(0));
			});
			teardown(() => events.push(1));
		});
		dispose();
		assertEvents(events, [1]);
	});

	await test("error handling", () => {
		const events = [];
		throws(() => {
			capture(() => {
				teardown(() => events.push(0));
				teardown(() => events.push(1));
				throw new Error("test");
			});
		});
		assertEvents(events, [1, 0]);
	});
});

await suite("context", async () => {
	await test("basic usage", () => {
		const ctx = new Context(42);
		strictEqual(ctx.get(), 42);
		strictEqual(ctx.inject(77, () => {
			strictEqual(ctx.get(), 77);
			strictEqual(ctx.inject(null, () => {
				strictEqual(ctx.get(), 42);
				return "b";
			}), "b");
			strictEqual(ctx.inject(undefined, () => {
				strictEqual(ctx.get(), 42);
				return "c";
			}), "c");
			strictEqual(ctx.get(), 77);
			return "a";
		}), "a");
		strictEqual(ctx.get(), 42);
	});

	await test("inject", () => {
		const a = new Context(1);
		const b = new Context(2);
		strictEqual(inject([
			a.with(42),
		], () => {
			strictEqual(a.get(), 42);
			strictEqual(b.get(), 2);
			strictEqual(inject([
				a.with(17),
				b.with(77),
			], () => {
				strictEqual(a.get(), 17);
				strictEqual(b.get(), 77);
				return "b";
			}), "b");
			strictEqual(a.get(), 42);
			strictEqual(b.get(), 2);
			strictEqual(inject([
				a.with(7),
				a.with(8),
				a.with(9),
			], () => {
				strictEqual(a.get(), 9);
				return "b";
			}), "b");
			strictEqual(a.get(), 42);
			strictEqual(b.get(), 2);
			return "a";
		}), "a");
	});

	await test("wrap", () => {
		const a = new Context(1);
		const b = new Context(2);
		const inner = () => [a.get(), b.get()];
		const fns = inject([
			a.with(3),
			b.with(4),
		], () => {
			return [
				wrap(inner),
				b.inject(5, () => wrap(inner)),
			];
		});
		deepStrictEqual(inner(), [1, 2]);
		deepStrictEqual(fns[0](), [3, 4]);
		deepStrictEqual(fns[1](), [3, 5]);
		a.inject(6, () => {
			deepStrictEqual(inner(), [6, 2]);
			deepStrictEqual(fns[0](), [3, 4]);
			deepStrictEqual(fns[1](), [3, 5]);
		});
	});
});

await suite("signals", async () => {
	await test("inert usage", () => {
		const count = $(0);
		strictEqual(count(), 0);
		count(1);
		strictEqual(count(), 1);
		strictEqual(count(count() + 1), 2);
		strictEqual(count(), 2);
		count.notify();
		strictEqual(count(), 2);
	});

	await test("watch usage", () => {
		const events = [];
		const count = $(0);
		const dispose = capture(() => {
			watch(count, value => events.push(value));
		});
		assertEvents(events, [0]);
		count(1);
		assertEvents(events, [1]);
		count(1);
		assertEvents(events, []);
		count(2);
		assertEvents(events, [2]);
		dispose();
		count(3);
		assertEvents(events, []);
		strictEqual(count(), 3);
		dispose();
		count(4);
		assertEvents(events, []);
		strictEqual(count(), 4);
	});

	await test("watch unfolding", () => {
		const events = [];
		const count = $(0);
		watch(count, value => {
			events.push(value);
			if (value < 3) {
				count(count() + 1);
				events.push("u");
			}
		});
		strictEqual(count(), 3);
		assertEvents(events, [0, "u", 1, "u", 2, "u", 3]);
	});

	await test("context", () => {
		const events = [];
		const ctx = new Context(7);
		const count = $(0);
		ctx.inject(11, () => {
			watch(() => {
				return count() + ctx.get();
			}, value => {
				strictEqual(count() + ctx.get(), value);
				events.push(value);
			});
		});
		assertEvents(events, [11]);
		count(1);
		assertEvents(events, [12]);
		ctx.inject(77, () => {
			count(2);
			assertEvents(events, [13]);
		});
	});

	await test("untrack", () => {
		const events = [];
		const a = $(0);
		const b = $(1);
		watch(() => [a(), untrack(b)], v => events.push(v));
		assertEvents(events, [[0, 1]]);
		a(2);
		assertEvents(events, [[2, 1]]);
		b(3);
		assertEvents(events, []);
		a(4);
		assertEvents(events, [[4, 3]]);
	});
});

await suite("render", async () => {
	await test("empty", () => {
		strictEqual(viewText(render()), "");
		strictEqual(viewText(render([])), "");
		strictEqual(viewText(render(null)), "");
		strictEqual(viewText(render([null, [undefined], []])), "");

		const view = render();
		strictEqual(view.first, view.last);
		strictEqual(view.first.nodeType, Node.COMMENT_NODE);
	});

	await test("static text", () => {
		strictEqual(viewText(render("test")), "test");
		strictEqual(viewText(render(() => "test")), "test");
		strictEqual(viewText(render(42)), "42");
		strictEqual(viewText(render(false)), "false");
	});

	await test("signal", () => {
		const count = $(0);
		const view = render(count);
		strictEqual(viewText(view), "0");
		count(1);
		strictEqual(viewText(view), "1");
	});

	await test("node", () => {
		strictEqual(viewText(render(e("div").append("test").elem)), "test");
	});

	await test("static view", () => {
		strictEqual(viewText(render(e("div").append("test"))), "test");
	});

	await test("single dynamic view", () => {
		const events = [];
		const count = $(0);
		const view = render(nest(count, value => value));
		view.own((first, last) => events.push([first.textContent, last.textContent]));
		strictEqual(viewText(view), "0");
		assertEvents(events, []);
		count(1);
		strictEqual(viewText(view), "1");
		assertEvents(events, [["1", "1"]]);
	});

	await test("first dynamic view", () => {
		const events = [];
		const count = $(0);
		const view = render(nest(count, value => value), "a", "b");
		view.own((first, last) => events.push([first.textContent, last.textContent]));
		strictEqual(viewText(view), "0ab");
		assertEvents(events, []);
		count(1);
		strictEqual(viewText(view), "1ab");
		assertEvents(events, [["1", "b"]]);
	});

	await test("last dynamic view", () => {
		const events = [];
		const count = $(0);
		const view = render("a", "b", nest(count, value => value));
		view.own((first, last) => events.push([first.textContent, last.textContent]));
		strictEqual(viewText(view), "ab0");
		assertEvents(events, []);
		count(1);
		strictEqual(viewText(view), "ab1");
		assertEvents(events, [["a", "1"]]);
	});

	await test("middle dynamic view", () => {
		const events = [];
		const count = $(0);
		const view = render("a", nest(count, value => value), "b");
		view.own((first, last) => events.push([first.textContent, last.textContent]));
		strictEqual(viewText(view), "a0b");
		assertEvents(events, []);
		count(1);
		strictEqual(viewText(view), "a1b");
		assertEvents(events, []);
	});
});

await suite("nest", async () => {
	await test("basic usage", async () => {
		const events = [];
		const count = $(0);
		const view = nest(count, value => {
			events.push(`+${value}`);
			teardown(() => events.push(`-${value}`));
			return value;
		});
		textBoundaryEvents(view, events);
		strictEqual(viewText(view), "0");
		assertEvents(events, ["+0"]);
		count(count() + 1);
		strictEqual(viewText(view), "1");
		assertEvents(events, ["-0", "+1", "1"]);
	});

	await test("inner boundary updates", async () => {
		const events = [];
		const count = $(0);
		const access = $();

		let view;
		const dispose = capture(() => {
			view = nest(access, () => {
				events.push("+");
				teardown(() => events.push("-"));
				return nest(count, c => c);
			});
		});
		assertEvents(events, ["+"]);
		// @ts-ignore
		textBoundaryEvents(view, events);
		count(count() + 1);
		assertEvents(events, ["1"]);
		count(count() + 1);
		assertEvents(events, ["2"]);
		access.notify();
		assertEvents(events, ["-", "+", "2"]);
		count(count() + 1);
		assertEvents(events, ["3"]);
		dispose();
		assertEvents(events, ["-"]);
		count(count() + 1);
		access.notify();
		assertEvents(events, []);
	});

	await test("omit component", async () => {
		const events = [];
		/** @type {import("./kaon.js").Signal<any>} */
		const comp = $();
		const view = nest(comp);
		strictEqual(viewText(view), "");
		comp(() => {
			events.push("+a");
			teardown(() => events.push("-a"));
			return "a";
		});
		strictEqual(viewText(view), "a");
		assertEvents(events, ["+a"]);
		comp(null);
		strictEqual(viewText(view), "");
		assertEvents(events, ["-a"]);
	});

	await test("update leading", async () => {
		const count = $(0);
		const view = nest(count, c => c);
		const parent = render(view, "a", "b");
		strictEqual(viewText(parent), "0ab");
		count(count() + 1);
		strictEqual(viewText(parent), "1ab");
	});

	await test("update middle", async () => {
		const count = $(0);
		const view = nest(count, c => c);
		const parent = render("a", view, "b");
		strictEqual(viewText(parent), "a0b");
		count(count() + 1);
		strictEqual(viewText(parent), "a1b");
	});

	await test("update trailing", async () => {
		const count = $(0);
		const view = nest(count, c => c);
		const parent = render("a", "b", view);
		strictEqual(viewText(parent), "ab0");
		count(count() + 1);
		strictEqual(viewText(parent), "ab1");
	});
});

await test("iter", async () => {
	const events = [];
	const items = $([1, 2, 3, 4, 5]);
	let view;
	const dispose = capture(() => {
		view = iter(items, value => {
			events.push(`+${value}`);
			teardown(() => events.push(`-${value}`));
			return value;
		});
	});
	if (!view) throw new Error();
	strictEqual(viewText(view), "12345");
	assertUnorderedEvents(events, ["+1", "+2", "+3", "+4", "+5"]);

	items([2, 4]);
	strictEqual(viewText(view), "24");
	assertUnorderedEvents(events, ["-1", "-3", "-5"]);

	items([1, 4, 3, 2, 5]);
	strictEqual(viewText(view), "14325");
	assertUnorderedEvents(events, ["+1", "+3", "+5"]);

	items([]);
	strictEqual(viewText(view), "");
	assertUnorderedEvents(events, ["-2", "-4", "-1", "-3", "-5"]);

	items([1, 2, 3, 4, 5]);
	strictEqual(viewText(view), "12345");
	assertUnorderedEvents(events, ["+1", "+2", "+3", "+4", "+5"]);

	items([5, 3, 1]);
	strictEqual(viewText(view), "531");
	assertUnorderedEvents(events, ["-2", "-4"]);

	items([2, 4]);
	strictEqual(viewText(view), "24");
	assertUnorderedEvents(events, ["+2", "+4", "-1", "-3", "-5"]);

	items([1, 2, 3, 4, 5, 6, 7]);
	strictEqual(viewText(view), "1234567");
	assertUnorderedEvents(events, ["+1", "+3", "+5", "+6", "+7"]);

	items([2, 9, 10, 7, 8, 1, 5]);
	strictEqual(viewText(view), "29107815");
	assertUnorderedEvents(events, ["+9", "+10", "+8", "-4", "-3", "-6"]);

	items([2, 2, 1, 1, 5, 5]);
	strictEqual(viewText(view), "215");
	assertUnorderedEvents(events, ["-7", "-9", "-10", "-8"]);

	items([2, 1, 5, 3, 2, 1, 3, 5, 2, 5, 1]);
	strictEqual(viewText(view), "3251");
	assertUnorderedEvents(events, ["+3"]);

	items([3, 5, 1, 2]);
	strictEqual(viewText(view), "3512");
	assertUnorderedEvents(events, []);

	dispose();
	strictEqual(viewText(view), "3512");
	assertUnorderedEvents(events, ["-2", "-1", "-5", "-3"]);

	dispose();
	// This is currently intentional:
	assertUnorderedEvents(events, ["-2", "-1", "-5", "-3"]);
});

await suite("builder", async () => {
	await test("namespace", () => {
		strictEqual(e("div").elem instanceof window.HTMLElement, true);
		XMLNS.inject("http://www.w3.org/2000/svg", () => {
			strictEqual(e("div").elem instanceof window.SVGElement, true);
		});
	});

	await test("set", () => {
		/** @type {import("./kaon.js").Signal<any>} */
		const signal = $(0);
		const elem = e("div")
			.set("foo", signal)
			.set("bar", "baz")
			.elem;

		strictEqual(elem.getAttribute("foo"), "0");
		strictEqual(elem.getAttribute("bar"), "baz");

		signal(1);
		strictEqual(elem.getAttribute("foo"), "1");

		signal(undefined);
		strictEqual(elem.hasAttribute("foo"), false);

		signal(null);
		strictEqual(elem.hasAttribute("foo"), false);

		signal(false);
		strictEqual(elem.hasAttribute("foo"), false);
	});

	await test("prop", () => {
		const signal = $("foo");
		const elem = e("div").prop("title", signal).elem;
		strictEqual(elem.title, "foo");
		signal("bar");
		strictEqual(elem.title, "bar");
	});

	await test("on", () => {
		const events = [];
		const elem = e("div").on("test-event", e => {
			events.push(e);
		}, { once: true }).elem;
		elem.dispatchEvent(new window.CustomEvent("test-event"));
		strictEqual(events.length, 1);
		strictEqual(events[0] instanceof window.CustomEvent, true);
		elem.dispatchEvent(new window.CustomEvent("test-event"));
		strictEqual(events.length, 1);
	});

	await test("append", () => {
		const signal = $(0);
		const elem = e("div").append("foo", signal).elem;
		strictEqual(elem.textContent, "foo0");
		signal(1);
		strictEqual(elem.textContent, "foo1");
	});
});

/**
 * @param {unknown[]} events
 * @param {unknown[]} expected
 */
function assertEvents(events, expected) {
	deepStrictEqual(events, expected);
	events.length = 0;
}

/**
 * @param {unknown[]} events
 * @param {unknown[]} expected
 */
function assertUnorderedEvents(events, expected) {
	assertEvents(events.sort(), expected.sort());
}

/**
 * @param {View} view
 * @param {unknown[]} events
 */
function textBoundaryEvents(view, events) {
	view.own(() => {
		events.push(viewText(view));
	});
}

/**
 * @param {View} view
 */
function viewText(view) {
	let { first: node, last } = view;
	let text = "";
	for (;;) {
		if (node.nodeType !== Node.COMMENT_NODE) {
			text += node.textContent;
		}
		if (node === last) {
			break;
		}
		const next = node.nextSibling;
		if (!next) {
			throw new Error("invalid view sequence");
		}
		node = next;
	}
	return text;
}
