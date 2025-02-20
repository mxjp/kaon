
const _LIFECYCLE = [];
const _CONTEXT = [[]];

const _in = (stack, frame, fn, ...args) => {
	try {
		stack.push(frame);
		return fn(...args);
	} finally {
		stack.pop();
	}
};

const _head = stack => stack[stack.length - 1];

const _call = fn => fn();

const _dispose = hooks => hooks.toReversed().forEach(_call);

export const teardown = hook => void _head(_LIFECYCLE)?.push(hook);

export const capture = (fn, ...args) => {
	const hooks = [];
	try {
		_in(_LIFECYCLE, hooks, fn, ...args);
	} catch (e) {
		_dispose(hooks);
		throw e;
	}
	return () => _dispose(hooks);
};

export class Context {
	#stack = [];
	#window = 0;

	constructor(value) {
		this.default = value;
	}

	get() {
		return this.#window === _CONTEXT.length
			? _head(this.#stack) ?? this.default
			: this.default;
	}

	with(value) {
		return [this, value];
	}

	inject(value, fn, ...args) {
		const window = _head(_CONTEXT);
		const parent = this.#window;
		const stack = this.#stack;
		try {
			this.#window = _CONTEXT.length;
			window.push(this);
			stack.push(value);
			return fn(...args);
		} finally {
			stack.pop();
			window.pop();
			this.#window = parent;
		}
	}

	static window(fn, ...args) {
		return _in(_CONTEXT, [], fn, ...args);
	}

	static inject([state, ...rest], fn, ...args) {
		return state ? state[0].inject(state[1], Context.inject, rest, fn, ...args) : fn(...args);
	}

	static capture() {
		return _head(_CONTEXT).map(c => [c, c.get()]);
	}

	static wrap(fn) {
		const states = Context.capture();
		return (...args) => Context.window(Context.inject, states, fn, ...args);
	}
}
