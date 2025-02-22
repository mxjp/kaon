// @ts-check
import { deepStrictEqual, throws } from "node:assert";
import { suite, test } from "node:test";
import { capture, teardown } from "./kaon.js";

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

/**
 * @param {unknown[]} events
 * @param {unknown[]} expected
 */
function assertEvents(events, expected) {
	deepStrictEqual(events, expected);
	events.length = 0;
}
