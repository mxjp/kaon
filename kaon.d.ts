
type Fn = (...args: any) => any;

export type TeardownHook = () => void;

/**
 * Register a teardown hook to be {@link capture called later}.
 */
export function teardown(hook: TeardownHook): void;

/**
 * Call a function while capturing {@link teardown teardown hooks}.
 *
 * If the specified function throws an error, registered hooks are called in reverse order before the error is re-thrown.
 *
 * @param fn The function to call.
 * @param args Arguments to pass to the function.
 * @returns A function to call all registered hooks in reverse order.
 */
export function capture<F extends Fn>(fn: F, ...args: Parameters<F>): TeardownHook;

export type ContextState<T> = [Context<T>, T];

/**
 * Allows passing arbitrary values down the synchronous call stack.
 *
 * @example
 * ```js
 * const MESSAGE = new Context();
 *
 * MESSAGE.inject("Hello World!", () => {
 *   console.log(MESSAGE.get());
 * });
 * ```
 */
export class Context<T> {
	constructor(defaultValue: T);
	constructor(...defaultValue: T extends undefined ? [] : [T]);

	/**
	 * Get the current value of this context.
	 */
	get(): T;

	/**
	 * Create a state from this context with a value.
	 *
	 * @example
	 * ```js
	 * Context.inject([
	 *   CONTEXT_A.with(42),
	 *   CONTEXT_B.with(77),
	 * ], () => {
	 *   ...
	 * });
	 * ```
	 */
	with(value: T): ContextState<T>;

	/**
	 * Run a function while injecting a value in this context.
	 *
	 * @param value The value to inject.
	 * @param fn The function to run.
	 */
	inject<F extends Fn>(value: T | null | undefined, fn: F, ...args: Parameters<F>): ReturnType<F>;
}

/**
 * Run a function while injecting into multiple contexts.
 */
export function inject<F extends Fn>(states: ContextState<unknown>[], fn: F, ...args: Parameters<F>): ReturnType<F>;

/**
 * Wrap a function to always run in the current context.
 */
export function wrap<F extends Fn>(fn: F): F;

export interface Signal<T> {
	/**
	 * Access the signal's current value.
	 */
	(): T;

	/**
	 * Update the signal's value & notify observers.
	 *
	 * Observers are not notified if the new value is the current value.
	 *
	 * @returns The updated value.
	 */
	(nextValue: T): T;

	/**
	 * Manually notify observers.
	 */
	notify(): void;
}

/**
 * Create a new signal.
 */
export function $(): Signal<void>;
export function $<T>(value: T): Signal<T>;

export type Expression<T> = T | (() => T);
export type ExpressionResult<T> = T extends Expression<infer R> ? R : never;

/**
 * Watch the specified expression.
 */
export function watch<T>(expr: Expression<T>, callback: (value: T) => void): void;

/**
 * Run a function while ignoring signal accesses.
 */
export function untrack<T>(fn: () => T): T;

/**
 * Evaluate the specified expression.
 */
export function get<T>(expr: Expression<T>): T;

export type ViewUpdateFn = (first: Node, last: Node) => void;
export type ViewInit = (update: ViewUpdateFn, self: View) => void;

/**
 * Represents a sequence of at least one DOM node.
 *
 * Consumers of the API need to guarantee that:
 * + The sequence of nodes is not modified from the outside.
 * + If there are multiple nodes, all nodes have a common parent node at all time.
 */
export class View {
	/**
	 * Create a new view.
	 *
	 * View implementations need to guarantee that:
	 * + The view doesn't break when the parent node is replaced or when a view consisting of only a single node is detached from it's parent.
	 * + The boundary is updated immediately after the first or last node has been updated.
	 * + If there are multiple nodes, all nodes remain in the current parent.
	 * + If there are multiple nodes, the initial nodes must have a common parent.
	 */
	constructor(init: ViewInit);

	/**
	 * Set the owner of this view until the current lifecycle is disposed.
	 */
	own(owner: ViewUpdateFn): void;

	/**
	 * Add all nodes of this view to the specified parent.
	 *
	 * @param parent The parent to add nodes to.
	 * @param before If specified nodes are inserted before this node and appended otherwise.
	 */
	attach(parent: Node, before?: Node | null): void;

	/**
	 * Detach all nodes of this view from the current parent.
	 *
	 * @returns A document fragment containing all removed nodes.
	 */
	detach(): DocumentFragment;
}

/**
 * Watch an expression and render content from it's result.
 *
 * This can be used for arbitrary conditional rendering.
 *
 * @example
 * ```js
 * const count = $(42);
 *
 * nest(count, count => {
 *   if (count > 77) {
 *     return e("h1").append("Hello World!");
 *   }
 * })
 * ```
 */
export function nest<T>(expr: Expression<T>, component: (value: T) => unknown): View;
export function nest(expr: Expression<(() => unknown) | null | undefined>): View;

/**
 * Render content for each unique value in an iterable.
 *
 * @example
 * ```js
 * const items = $([1, 2, 3]);
 *
 * e("ul").append(
 *   forEach(items, (item, index) => e("li").append("value=", item, ", index=", index))
 * )
 * ```
 */
export function iter<T>(expr: Expression<Iterable<T>>, component: (value: T, index: Signal<number>) => unknown): View;

export type EventListener<E extends Event> = (event: E) => void;

export class Builder<E extends Element> extends View {
	/**
	 * The target element this builder is modifying.
	 */
	elem: E;

	/**
	 * Create a new element builder for the specified element.
	 *
	 * For also creating an element, use the {@link e} shorthand.
	 */
	constructor(elem: Element);

	/**
	 * Set an attribute.
	 *
	 * `null`, `undefined` and `false` removes the attribute.
	 *
	 * @example
	 * ```js
	 * e("img").set("src", url).set("alt", "Example")
	 * ```
	 */
	set(name: string, expr: Expression<unknown>): this;

	/**
	 * Set a property.
	 *
	 * @example
	 * ```js
	 * e("input").prop("value", someSignal)
	 * ```
	 */
	prop<K extends keyof E>(key: K, expr: Expression<E[K]>): this;

	/**
	 * Append an event listener.
	 *
	 * @example
	 * ```js
	 * e("button").on("click", event => { ... })
	 * ```
	 */
	on<K extends keyof HTMLElementEventMap>(type: K, listener: EventListener<HTMLElementEventMap[K]>, options?: AddEventListenerOptions): this;
	on<E extends Event>(type: string, listener: EventListener<E>, options?: AddEventListenerOptions): this;
	append(...content: unknown[]): this;
}

export type TagNameMap = HTMLElementTagNameMap & SVGElementTagNameMap & MathMLElementTagNameMap;

export type XMLNS = "http://www.w3.org/1999/xhtml" | "http://www.w3.org/2000/svg" | "http://www.w3.org/1998/Math/MathML";
export const XMLNS: Context<XMLNS>;

/**
 * Create a new element & builder.
 *
 * This uses the current {@link XMLNS} value to determine the namespace.
 *
 * @example
 * ```js
 * e("h1").append("Hello World!")
 *
 * XMLNS.inject("http://www.w3.org/2000/svg", () => {
 *   return e("svg").set("viewbox", "0 0 ...")
 * })
 */
export function e<K extends keyof TagNameMap>(tagName: K): Builder<TagNameMap[K]>;
export function e<E extends Element>(tagName: string): Builder<E>;
