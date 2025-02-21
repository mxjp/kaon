const _DOCUMENT = document;
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
		if (depth < 2 && !depth++) {
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
	function fn(next) {
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

const _frag = () => _DOCUMENT.createDocumentFragment();
const _empty = () => _DOCUMENT.createComment("");
const _text = () => expr => {
	const text = _DOCUMENT.createTextNode("");
	watch(expr, v => text.textContent = v ?? "");
	return text;
};

export const render = (...content) => new View((update, self) => {
	content = content.flat(Infinity);
	const empty = _empty();
	const parent = _frag();
	for (let i = 0; i < content.length; i++) {
		const part = content[i];
		if (part instanceof Node) {
			parent.appendChild(part);
		} else if (part instanceof View) {
			part.appendTo(parent);
			if (content.length === 1) {
				part.setOwner(update);
			} else if (i === 0) {
				part.setOwner((n, _) => update(n, self.last));
			} else if (i === content.length - 1) {
				part.setOwner((_, n) => update(self.first, n));
			}
		} else {
			parent.appendChild(_text(part));
		}
	}
	update(parent.firstChild ?? empty, parent.lastChild ?? empty);
});

export class View {
	#owner;

	constructor(init) {
		init((first, last) => {
			this.first = first;
			this.last = last;
			this.#owner?.(first, last);
		}, this);
	}

	setOwner(owner) {
		this.#owner = owner;
		teardown(() => this.#owner = undefined);
	}

	appendTo(parent) {
		let { first, last } = this;
		for (;;) {
			const next = first.nextSibling;
			parent.appendChild(first);
			if (first === last) break;
			first = next;
		}
	}

	insertBefore(parent, ref) {
		let { first, last } = this;
		for (;;) {
			const next = first.nextSibling;
			parent.insertBefore(first, ref);
			if (first === last) break;
			first = next;
		}
	}

	insertAfter(parent, ref) {
		const next = ref.nextSibling;
		if (next) {
			this.insertBefore(parent, next);
		} else {
			this.appendTo(parent);
		}
	}

	detach() {
		const { first, last } = this;
		if (first === last) {
			first.parentNode?.removeChild(first);
			return first;
		} else {
			const frag = _frag();
			this.appendTo(frag);
			return frag;
		}
	}
}

export const nest = (expr, component = _call) => new View((update, self) => {
	watch(expr, value => {
		const last = self.last;
		const parent = last?.parentNode;
		let view;
		if (parent) {
			const anchor = last.nextSibling;
			self.detach();
			view = render(component(value));
			if (anchor) {
				view.insertBefore(parent, anchor);
			} else {
				view.appendTo(parent);
			}
		}
		update(view.first, view.last);
		view.setOwner(update);
	});
});

export const iter = (expr, component) => new View(update => {
	let cycle = 0;
	const first = _empty();
	const instances = new Map();
	teardown(() => instances.forEach(v => v.d()));
	watch(expr, values => {
		cycle++;
		let index = 0;
		let last = first;
		let parent = first.parentNode;
		if (!parent) {
			(parent = _frag()).appendChild(first);
		}
		for (const value of values) {
			let instance = instances.get(value);
			if (!instance) {
				instance = { c: cycle, i: $(index) };
				instance.d = capture(() => {
					instance.v = render(component(value, instance.i));
				});
				instances.set(value, instance);
			} else {
				instance.c = cycle;
				instance.i(index);
			}
			if (last.nextSibling !== instance.v.first) {
				instance.v.insertAfter(parent, last);
			}
			last = instance.v.last;
			index++;
		}
		for (const [value, instance] of instances) {
			if (instance.c !== cycle) {
				instances.delete(value);
				instance.d();
				instance.v.detach();
			}
		}
		update(first, last);
	});
});

export class Builder extends View {
	constructor(elem) {
		super(update => update(elem, elem));
		this.elem = elem;
	}

	set(name, expr) {
		watch(expr, value => {
			if ((value ?? false) === false) {
				this.elem.removeAttribute(name);
			} else {
				this.elem.setAttribute(name, String(value));
			}
		});
		return this;
	}

	prop(name, expr) {
		watch(expr, value => this.elem[name] = value);
		return this;
	}

	on(event, fn, opts) {
		this.elem.addEventListener(event, fn, opts);
		return this;
	}

	append(...content) {
		render(...content).appendTo(this.elem);
		return this;
	}
}

export const XMLNS = new Context("http://www.w3.org/1999/xhtml");
export const e = tag => new Builder(_DOCUMENT.createElementNS(XMLNS.get(), tag));
