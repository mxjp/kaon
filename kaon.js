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

export const teardown = hook => void _head(_LIFECYCLE)?.push(hook);

export const capture = (fn, ...args) => {
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

export const inject = ([state, ...rest], fn, ...args) => {
	return state ? state[0].inject(state[1], inject, rest, fn, ...args) : fn(...args);
};

export const wrap = fn => {
	let states = _head(_CONTEXT).map(c => [c, c.get()]);
	return (...args) => _in(_CONTEXT, [], inject, states, fn, ...args);
};

export const $ = value => {
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

export const watch = (expr, cb) => {
	let value;
	let dispose;
	let entry = _unfold(wrap(() => {
		clear();
		value = _in(_ACCESS, access, get, expr);
		dispose?.();
		dispose = capture(cb, value);
	}));
	let signals = [];
	let clear = () => signals.splice(0).forEach(s => s.delete(entry));
	let access = hooks => {
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

let _frag = () => _DOCUMENT.createDocumentFragment();
let _empty = () => _DOCUMENT.createComment("");
let _text = () => expr => {
	let text = _DOCUMENT.createTextNode("");
	watch(expr, v => text.textContent = v ?? "");
	return text;
};

export const render = (...content) => new View((update, self) => {
	content = content.flat(Infinity);
	let empty = _empty();
	let parent = _frag();
	for (let i = 0; i < content.length; i++) {
		let part = content[i];
		if (part instanceof Node) {
			parent.appendChild(part);
		} else if (part instanceof View) {
			part.appendTo(parent);
			if (content.length === 1) {
				part.own(update);
			} else if (i === 0) {
				part.own((n, _) => update(n, self.last));
			} else if (i === content.length - 1) {
				part.own((_, n) => update(self.first, n));
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

	own(owner) {
		this.#owner = owner;
		teardown(() => this.#owner = undefined);
	}

	appendTo(parent) {
		let { first, last } = this;
		for (;;) {
			let next = first.nextSibling;
			parent.appendChild(first);
			if (first === last) break;
			first = next;
		}
	}

	insertBefore(parent, ref) {
		let { first, last } = this;
		for (;;) {
			let next = first.nextSibling;
			parent.insertBefore(first, ref);
			if (first === last) break;
			first = next;
		}
	}

	insertAfter(parent, ref) {
		let next = ref.nextSibling;
		if (next) {
			this.insertBefore(parent, next);
		} else {
			this.appendTo(parent);
		}
	}

	detach() {
		let { first, last } = this;
		if (first === last) {
			first.parentNode?.removeChild(first);
			return first;
		} else {
			let frag = _frag();
			this.appendTo(frag);
			return frag;
		}
	}
}

export const nest = (expr, component = _call) => new View((update, self) => {
	watch(expr, value => {
		let last = self.last;
		let parent = last?.parentNode;
		let view;
		if (parent) {
			let anchor = last.nextSibling;
			self.detach();
			view = render(component(value));
			if (anchor) {
				view.insertBefore(parent, anchor);
			} else {
				view.appendTo(parent);
			}
		}
		update(view.first, view.last);
		view.own(update);
	});
});

export const iter = (expr, component) => new View(update => {
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
		for (let [value, instance] of instances) {
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
