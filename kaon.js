let _DOCUMENT = document;
let _LIFECYCLE = [];
let _CONTEXT = [[]];
let _ACCESS = [];

let _in = (stack, frame, fn, ...args) => {
	try {
		stack.push(frame);
		return fn(...args);
	} finally {
		stack.pop();
	}
};

let _head = stack => stack[stack.length - 1];
let _call = fn => fn();
let _dispose = hooks => hooks.toReversed().forEach(_call);

let _unfold = fn => {
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

export let teardown = hook => void _head(_LIFECYCLE)?.push(hook);

export let capture = (fn, ...args) => {
	let hooks = [];
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
	#window = [0];

	constructor(value) {
		this.default = value;
	}

	get() {
		return _head(this.#window) === _CONTEXT.length
			? _head(this.#stack) ?? this.default
			: this.default;
	}

	with(value) {
		return [this, value];
	}

	inject(value, fn, ...args) {
		let window = _head(_CONTEXT);
		return _in(this.#window, _CONTEXT.length, _in, window, this, _in, this.#stack, value, fn, ...args);
	}
}

export let inject = ([state, ...rest], fn, ...args) => {
	return state ? state[0].inject(state[1], inject, rest, fn, ...args) : fn(...args);
};

export let wrap = fn => {
	let states = _head(_CONTEXT).map(c => [c, c.get()]);
	return (...args) => _in(_CONTEXT, [], inject, states, fn, ...args);
};

export let $ = value => {
	let hooks = new Set();
	let notify = () => {
		let record = [...hooks];
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

export let watch = (expr, cb) => {
	let value;
	let dispose;
	let entry = _unfold(wrap(() => {
		clear();
		value = _in(_ACCESS, access, get, expr);
		dispose = capture(cb, value);
	}));
	let signals = [];
	let clear = () => {
		signals.splice(0).forEach(s => s.delete(entry));
		dispose?.();
	};
	let access = hooks => {
		signals.push(hooks);
		hooks.add(entry);
	};
	teardown(clear);
	entry();
};

export let untrack = fn => _in(_ACCESS, () => {}, fn);

export let get = expr => typeof expr === "function" ? expr() : expr;

let _frag = () => _DOCUMENT.createDocumentFragment();
let _empty = () => _DOCUMENT.createComment("");

export let render = (...content) => new View((update, self) => {
	content = content.flat(Infinity);
	let empty = _empty();
	let parent = _frag();
	for (let i = 0; i < content.length; i++) {
		let part = content[i];
		if (part instanceof Node) {
			parent.appendChild(part);
		} else if (part instanceof View) {
			part.move(parent);
			if (content.length === 1) {
				part.own(update);
			} else if (i === 0) {
				part.own((n, _) => update(n, self.last));
			} else if (i === content.length - 1) {
				part.own((_, n) => update(self.first, n));
			}
		} else {
			let text = _DOCUMENT.createTextNode("");
			watch(part, v => text.textContent = v ?? "");
			parent.appendChild(text);
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

	own(owner) {
		this.#owner = owner;
		teardown(() => this.#owner = null);
	}

	move(parent = _frag(), before) {
		let { first, last } = this;
		for (;;) {
			let next = first.nextSibling;
			if (before) {
				parent.insertBefore(first, before);
			} else {
				parent.appendChild(first);
			}
			if (first === last) break;
			first = next;
		}
		return parent;
	}
}

export let nest = (expr, component = fn => fn?.()) => new View((update, self) => {
	watch(expr, value => {
		let last = self.last;
		let parent = last?.parentNode;
		let anchor = last?.nextSibling;
		if (parent) {
			self.move();
		}
		let view = render(component(value));
		if (parent) {
			view.move(parent, anchor);
		}
		update(view.first, view.last);
		view.own(update);
	});
});

export let iter = (expr, component) => new View(update => {
	let cycle = 0;
	let first = _empty();
	let instances = new Map();
	teardown(() => instances.forEach(v => v.d()));
	watch(expr, values => {
		cycle++;
		let index = 0;
		let last = first;
		let parent = first.parentNode;
		if (!parent) {
			(parent = _frag()).appendChild(first);
		}
		for (let value of values) {
			let instance = instances.get(value);
			if (!instance) {
				instance = { i: $(index) };
				instance.d = capture(() => {
					instance.v = render(component(value, instance.i));
				});
				instances.set(value, instance);
			}
			instance.c = cycle;
			instance.i(index);
			let next = last.nextSibling;
			if (next !== instance.v.first) {
				instance.v.move(parent, next);
			}
			last = instance.v.last;
			index++;
		}
		for (let [value, instance] of instances) {
			if (instance.c !== cycle) {
				instances.delete(value);
				instance.d();
				instance.v.move();
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
				this.elem.setAttribute(name, value);
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
		render(...content).move(this.elem);
		return this;
	}
}

export let XMLNS = new Context();
export let e = tag => new Builder(
	XMLNS.get()
		? _DOCUMENT.createElementNS(XMLNS.get(), tag)
		: _DOCUMENT.createElement(tag)
);
