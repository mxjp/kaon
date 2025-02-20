
const _LIFECYCLE = [];

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
