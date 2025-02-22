// @ts-check
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { suite, test } from "node:test";
import { $, capture, Context, inject, teardown, untrack, watch, wrap } from "./kaon.js";

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

/**
 * @param {unknown[]} events
 * @param {unknown[]} expected
 */
function assertEvents(events, expected) {
	deepStrictEqual(events, expected);
	events.length = 0;
}
