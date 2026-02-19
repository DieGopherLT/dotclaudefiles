---
paths:
  - "**/*.html"
  - "**/*.tsx"
  - "**/*.jsx"
---

# HTML Semantics

## Structural elements

- Use `<main>` for the primary content of the page (only one per page).
- Use `<section>` for thematic groupings of content with a heading.
- Use `<article>` for self-contained, independently distributable content (blog posts, comments, widgets).
- Use `<aside>` for tangentially related content (sidebars, pull quotes).
- Avoid generic `<div>` elements when semantic alternatives exist.

```html
<main>
  <section>
    <h2>Featured Products</h2>
    <article>
      <h3>Product Name</h3>
      <p>Description</p>
    </article>
  </section>
</main>
```

## Sectioning content

- Every `<section>`, `<article>`, and `<aside>` can have its own `<header>` and `<footer>`.
- Page-level `<header>` contains site branding and main navigation.
- Page-level `<footer>` contains site-wide information (copyright, links).

## Navigation

- Use `<nav>` for major navigation blocks (main menu, table of contents, pagination).
- Not every group of links needs `<nav>` (e.g., footer links can be a simple list).
- Prefer one main `<nav>` inside the page `<header>` for primary navigation.

## Heading hierarchy

- One `<h1>` per page.
- Never skip heading levels (`h1 → h3` is invalid; always `h1 → h2 → h3`).
- Use CSS for visual sizing — headings define structure, not style.

## Interactive elements

- Use `<button>` for actions (submit, toggle, open modal).
- Use `<a href>` for navigation (links to pages or anchors).
- Never use `<div>` or `<span>` with click handlers — they are not keyboard accessible.

```html
<!-- Bad -->
<div onClick={handleDelete}>Delete</div>
<a onClick={openModal}>Open</a>

<!-- Good -->
<button type="button" onClick={openModal}>Open</button>
<a href="/about">About</a>
```

## Lists and text

- Use `<ul>` for unordered lists, `<ol>` for ordered lists.
- Use `<dl>`, `<dt>`, `<dd>` for term-definition pairs (glossaries, metadata).
- Never use `<br>` for spacing; use CSS margins/padding instead.
- Use `<strong>` for importance, `<em>` for emphasis (not `<b>` or `<i>` unless purely stylistic).

## Accessibility

- Always include `alt` on `<img>`: descriptive text for meaningful images, empty `alt=""` for decorative ones.
- Associate every `<input>` with a `<label>` using `for`/`htmlFor` — never rely on `placeholder` alone.
- Prefer native HTML over ARIA — use ARIA only when no native element covers the need.

```html
<!-- Images -->
<img src="logo.png" alt="Company logo" />
<img src="bg.png" alt="" />

<!-- Form labels -->
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```
