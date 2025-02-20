
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
