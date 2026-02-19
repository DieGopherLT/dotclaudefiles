---
paths:
  - "**/*.css"
  - "**/*.scss"
---

# CSS Standards

## Mobile first

- Write styles for mobile devices first, then use media queries for larger screens.
- Use relative units (em, rem, %) for sizing to ensure responsiveness and consistency.
- Keep classes and their respective media queries together instead of separating them by screen size.

```css
/* Mobile base */
.card {
  padding: 1rem;
  width: 100%;
}

/* Tablet */
@media (min-width: 768px) {
  .card { padding: 1.5rem; width: 50%; }
}

/* Desktop */
@media (min-width: 1024px) {
  .card { padding: 2rem; width: 33.333%; }
}
```

## Layout and positioning

- Prefer flexbox for one-dimensional layouts (row or column) — make it the default, especially on mobile-first designs.
- Use CSS Grid for two-dimensional layouts (both rows and columns).
- Avoid fixed or absolute positioning unless necessary for overlays (modals, tooltips) or sticky elements.
- Never use floats.

## Custom properties

- Define design tokens as custom properties on `:root` — never use magic numbers.
- Use a consistent naming convention: `--category-variant` (e.g., `--color-primary`, `--spacing-md`, `--radius-sm`).
- In CSS Modules, define shared tokens in a global file (e.g., `tokens.css`) and import where needed.

```css
/* Bad - magic numbers scattered */
.button {
  background: #3b82f6;
  padding: 8px 16px;
  border-radius: 6px;
}

/* Good - tokens from :root */
:root {
  --color-primary: #3b82f6;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --radius-sm: 6px;
}

.button {
  background: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
}
```

## Naming conventions

- Use BEM (Block Element Modifier) for class naming in global CSS.
  - Block: standalone component (`.button`)
  - Element: part of a block (`.button__icon`)
  - Modifier: state or variation (`.button__icon--active`)
- In CSS Modules, omit the Block prefix — scoping is guaranteed by the module system.
- Use lowercase letters and hyphens for block names (`.main-header`, `.footer-links`).
- Avoid IDs for styling; prefer classes for reusability.
- Use descriptive names that reflect purpose (`.nav-bar`, `.card-title`).

## Transitions and animations

- Prefer native CSS animations over JavaScript for better performance.
- Use transitions for simple state changes (hover) and keyframes for complex animations.
- Use `transform` and `opacity` for animations to leverage GPU acceleration.

```css
.button {
  transition: transform 0.2s ease;
}
.button:hover {
  transform: scale(1.05);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  animation: fadeIn 0.3s ease;
}
```
