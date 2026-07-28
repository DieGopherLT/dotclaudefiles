---
paths:
  - "**/*.html"
  - "**/*.tsx"
  - "**/*.jsx"
---

# HTML Semantics

- Prefer semantic elements over `<div>`/`<span>` whenever one exists; native HTML
  over ARIA.
- `<button>` for actions, `<a href>` for navigation — never click handlers on
  non-interactive elements.
- One `<h1>` per page; never skip heading levels (structure via headings, sizing
  via CSS).
- Every `<input>` gets an associated `<label>` (never placeholder-only); every
  `<img>` gets `alt` (empty for decorative).