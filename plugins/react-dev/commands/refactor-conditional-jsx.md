---
description: Refactoring de JSX (clsx + conditional rendering). Acepta ruta opcional para acotar alcance. Triggers: migrate clsx, refactor jsx, react modernization, clsx migration
model: haiku
argument-hint: [file-or-directory]
allowed-tools: LSP, Read, Edit, Grep, Glob
fork: true
---

# JSX Refactor: Template Strings & Conditional Rendering

## Scope

Target path: `$ARGUMENTS`

- If a path was provided, apply refactoring ONLY to that file or directory.
- If no path was provided, apply refactoring to the entire project.

## Objective

Refactor JSX code to replace template strings with `clsx` and improve conditional rendering patterns.

## Steps

### 1. Discovery Phase (Parallel Execution)

Launch two explorer agents simultaneously:

**Agent 1 - Template String Hunter:**

- Search for template strings in JSX className attributes
- Pattern: `className={\`...\`}`
- Capture all occurrences with file paths and line numbers
- Scope: respect the target path defined above

**Agent 2 - Ternary Hunter:**

- Search for ternary operators used for conditional rendering in JSX
- Pattern: `{condition ? <Component /> : null}` and variations
- Capture all occurrences with file paths and line numbers
- Scope: respect the target path defined above

Wait for both agents to complete before proceeding.

### 2. Installation

Check if `clsx` is already listed in `package.json` dependencies. If not, detect the package manager by looking for its lock file and install accordingly:

| Lock file        | Package manager | Command             |
|------------------|-----------------|---------------------|
| `package-lock.json` | npm          | `npm install clsx`  |
| `yarn.lock`      | yarn            | `yarn add clsx`     |
| `pnpm-lock.yaml` | pnpm            | `pnpm add clsx`     |
| `bun.lockb`      | bun             | `bun add clsx`      |

If no lock file is found, default to `npm`.

### 3. Refactor Template Strings

Replace all findings from Agent 1:

**Before:**

```jsx
className={`base-class ${isActive ? 'active' : ''} ${variant}`}
```

**After:**

```jsx
className={clsx('base-class', isActive && 'active', variant)}
```

Add import: `import clsx from 'clsx';`

### 4. Refactor Conditional Rendering

Replace all findings from Agent 2, handling edge cases:

**Edge cases to handle:**

- Numeric values (0 should not render)
- Empty strings
- Empty arrays
- Nullish values

**Before:**

```jsx
{count > 0 ? <Component /> : null}
{items.length ? <List items={items} /> : null}
```

**After:**

```jsx
{count > 0 && <Component />}
{items.length > 0 && <List items={items} />}
```

**Critical:** Ensure `&&` left side is always boolean to avoid rendering `0`, `""`, or `NaN`.

## Expected Outcome

- All template strings in className replaced with `clsx` (within scope)
- All conditional ternaries replaced with `&&` operator (within scope)
- No false-positive renders
- Proper `clsx` imports added
