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

## Example
```js
import { $, e, render, iter } from "./kaon.js";

const text = $("");
const items = $(new Set());

render(
  e("div").append(
    e("input")
      .set("type", "text")
      .prop("value", text)
      .on("input", e => text(e.target.value)),
    e("button")
      .on("click", () => {
        items().add(text());
        items.notify();
      })
      .append("Add"),
  ),
  e("ul").append(
    iter(items, item => e("ul").append(
      item,
      e("button").on("click", () => {
        items().delete(item);
        items.notify();
      }).append("Remove"),
    )),
  ),
).move(document.body);
```
