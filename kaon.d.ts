
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

	/**
	 * Run a function in a new context window without any injected value.
	 */
	static window<F extends Fn>(fn: F, ...args: Parameters<F>): ReturnType<F>;

	/**
	 * Run a function while injecting into multiple contexts.
	 */
	static inject<F extends Fn>(states: ContextState<unknown>[], fn: F, ...args: Parameters<F>): ReturnType<F>;

	/**
	 * Capture all current context states.
	 */
	static capture(): ContextState<unknown>[];

	/**
	 * Wrap a function to always run in the current context.
	 */
	static wrap<F extends Fn>(fn: F): F;
}

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
