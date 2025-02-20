
const _LIFECYCLE = [];
const _CONTEXT = [[]];
const _ACCESS = [];

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

const _unfold = fn => {
	let depth = 0;
	return () => {
		if (depth < 2) {
			depth++;
		}
		if (depth === 1) {
			try {
				while (depth > 0) {
					fn();
					depth--;
				}
			} finally {
				depth = 0;
			}
		}
	};
};

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

export const $ = value => {
	const hooks = new Set();
	const notify = () => {
		const record = [...hooks];
		hooks.clear();
		record.forEach(_call);
	};
	const fn = function(next) {
		if (!arguments.length) {
			_head(_ACCESS)?.(hooks);
		} else if (!Object.is(value, next)) {
			value = next;
			notify();
		}
		return value;
	};
	fn.notify = notify;
	return fn;
};

export const watch = (expr, cb) => {
	let value;
	let dispose;
	const entry = _unfold(Context.wrap(() => {
		clear();
		value = _in(_ACCESS, access, get, expr);
		dispose?.();
		dispose = capture(cb, value);
	}));
	const signals = [];
	const clear = () => signals.splice(0).forEach(s => s.delete(entry));
	const access = hooks => {
		signals.push(hooks);
		hooks.add(entry);
	};
	teardown(() => {
		clear();
		dispose?.();
	});
	entry();
};

export const untrack = fn => _in(_ACCESS, () => {}, fn);

export const get = expr => typeof expr === "function" ? expr() : expr;
