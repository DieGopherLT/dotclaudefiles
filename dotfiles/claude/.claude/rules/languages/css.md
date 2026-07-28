---
paths:
  - "**/*.css"
  - "**/*.scss"
---

# CSS Standards

- Mobile first: base styles for mobile, `min-width` media queries upward. Keep each
  class and its media queries together — never grouped by screen size.
- Relative units (`rem`, `em`, `%`) for sizing.
- Flexbox as the default for one-dimensional layouts; Grid for two-dimensional.
  Fixed/absolute positioning only for overlays (modals, tooltips) and sticky
  elements. Never floats.
- Design tokens as custom properties on `:root` — no magic numbers. Naming:
  `--category-variant` (`--color-primary`, `--spacing-md`). In CSS Modules, shared
  tokens live in a global `tokens.css`.
- BEM in global CSS (`.button__icon--active`); in CSS Modules omit the Block prefix
  — scoping is guaranteed. Classes over IDs; lowercase-hyphenated, purpose-driven
  names.
- Animate with `transform` and `opacity` (GPU-accelerated): transitions for simple
  state changes, keyframes for complex animations. Prefer CSS over JavaScript
  animation.