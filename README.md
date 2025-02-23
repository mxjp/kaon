# kaon!
This is a minimal signal based rendering library primarily meant for websites served from embedded devices.

Kaon has a size of about **3KB** when minified & about **1.5KB** when minified & compressed.

## Features
+ Lifecycle hooks
+ Contexts
+ Manual change detection
+ Custom rendering logic
+ Conditional rendering
+ Element builder API
+ Function components

<br>



# API Overview
This is a brief API overview. For more details, refer to the type definitions in [kaon.d.ts](./kaon.d.ts).

## Lifecycle
Teardown functions can be registered using **teardown** and captured during synchronous function calls using **capture** for calling them later.
```js
import { capture, teardown } from "./kaon.js";

// Capture teardown hooks:
const dispose = capture(() => {
  const timer = setInterval(...);
  // Register a teardown hook:
  teardown(() => clearInterval(timer));
});

// Run captured teardown hooks:
dispose();
```

Teardown hooks are automatically captured by all [views](#views) and in [watch callbacks](#expressions).

## Context
Contexts can be used to implicitly pass values along the call stack.
```js
import { Context, inject } from "./kaon.js";

// Create a context "key":
const MESSAGE = new Context();

// Pass a single value via the MESSAGE context:
MESSAGE.inject("Hello World!", () => {
  // Get the current or default value:
  console.log(MESSAGE.get());
});

// Or pass multiple context values:
inject([MESSAGE.with("Hello World!"), ...], () => {
  // Get the current or default value:
  console.log(MESSAGE.get());
});
```

Context values are also available outside of the synchronous call stack in all [views](#views) and [watched expressions & callbacks](#expressions).

## Signals
Signals represent observable values that change over time.
```js
import { $ } from "./kaon.js";

// Create a signal:
const count = $(0);

// Get the current value:
console.log(count());

// Replace the value & notify observers:
count(1);
```

Deep updates are not detected automatically, but you can manually notify observers after updating an object:
```js
const items = $([1, 2, 3]);

items().push(4);
items.notify();
```

## Expressions
An expression can be a signal, a function accessing signals or a static value. Expressions can be manually observed:
```js
import { $, watch } from "./kaon.js";

const count = $(0);

// A static value:
watch(42, value => { ... });

// A signal directly:
watch(count, value => { ... });

// A function accessing signals:
watch(() => count() + 77, value => { ... });
```

The watch callback is called immediately and every time any accessed signal is updated until the current lifecycle is disposed.

## Rendering

### Views
Views are an abstraction for sequences of DOM nodes that change over time and are used for conditional rendering.

The **render** function creates a view from arbitrary content:
```js
import { render } from "./kaon.js";

// Expressions are rendered as text nodes:
render("Hello World!");
render(() => "Hello World!");
render(someSignal);

// Content can be combined using arbitrarily nested arrays:
render([
  [1, 2, 3],
  [["Hello World!"]],
]);

// Views and DOM nodes are used as is:
render(
  render("Hello World!"),
  e("h1").append("Hello World!"),
);

// All arguments are rendered:
render(1, 2, 3);
```

The **move** function can be used to move view nodes into or out of a parent node:
```js
render("Hello World!").move(document.body);
```

The **nest** function creates a view that watches an expression and renders a [component](#components) from it's result:
```js
import { $, nest, e } from "./kaon.js";

const message = $("Hello World!");

nest(message, value => {
  if (value) {
    return e("h1").append(value);
  }
});
```

The **iter** function creates a view that watches an expression returning an iterable and renders a [component](#components) for each unique value:
```js
import { $, iter, e } from "./kaon.js";

const items = $(["foo", "bar", "baz"]);

e("ul").append(
  iter(items, (item, index) => {
    return e("li").append("#", index, ": ", item);
  }),
);
```

For details on implementing your own custom views, refer to the `View` class definition in [kaon.d.ts](./kaon.d.ts).

### Elements
The **e** shorthand creates an element builder:
```js
import { e } from "./kaon.js";

// Create a new builder:
e("div")
  // Set an attribute:
  .set("foo", "bar")
  .set("foo", () => "bar")
  .set("foo", someSignal)

  // Set a javascript property:
  .prop("value", someSignal)

  // Add an event listener:
  .on("click", event => { ... })

  // Add an event listener with options:
  .on("click", event => { ... }, { capture: true })

  // Get access to the element:
  .elem;
```

Element builders are [views](#views) and can be directly used as content.

### Components
Components are just functions with arbitrary arguments returning any kind of content that is supported by the [**render**](#views) function.

You can use expressions to pass reactive values into your components and signals or callbacks to pass values in and out.

```js
import { e } from "./kaon.js";

/**
 * @param value {Signal<string>}
 */
function TextInput(value) {
  return e("input")
    .set("type", "text")
    .prop("value", value)
    .on("input", e => {
      value(e.target.value);
    });
}
```

Teardown hooks are supported in all provided [views](#views), so you can also use them in components:
```js
function ElapsedSeconds() {
  const elapsed = $(0);
  const timer = setInterval(() => elapsed(elapsed() + 1), 1000);
  teardown(() => clearInterval(timer));
  return elapsed;
}
```
