# Rules Best Practices (Reference)

Read this when planning extractions, classifying content, or sizing rule files.

## Why we rulify: adherence, not just tokens

Token cost is the obvious win, but the real motivator is **adherence**. Memory files behave like prose: a focused page is read and followed, a sprawling one is skimmed and ignored. When a CLAUDE.md mixes repository orientation with TypeScript style, Go patterns, git workflow, and testing rules, the model treats the whole file as ambient noise and compliance drops on every individual rule inside it.

The official docs confirm this directly: "Longer files consume more context and reduce adherence." Splitting is a behavior intervention as much as a context-budget one.

## Sweet spots

| File | Hard ceiling | Practical target |
|---|---|---|
| Base CLAUDE.md | 200 lines (official) | 150 lines |
| Individual rule file | — | 100-150 lines |
| `MEMORY.md` (auto memory) | 200 lines / 25KB (official) | keep concise, push detail to topic files |

Past 150 lines, split a rule by sub-topic into a directory (e.g., `languages/ts/types.md` and `languages/ts/async.md` instead of one bloated `languages/ts.md`).

## Classification: where each piece belongs

Three buckets:

### Project-wide → stays in CLAUDE.md

Content a reader needs in the first 30 seconds to orient themselves:

- One-paragraph repository overview
- Directory structure map (or pointer to `tree`)
- Module / plugin / package descriptions
- Cross-cutting commands (build, test, install, deploy)
- Pointers to entry points
- Conventions that apply regardless of file type (e.g., "all PRs need a test plan")

### Scope-specific → rule with `paths`

Loads only when Claude touches matching files:

- Language style guides (TS, Go, Python, C#)
- Framework patterns (React, Express, Django)
- Tool workflows tied to file types (SQL migration conventions, proto file rules)
- Test conventions (`**/*.test.*`, `**/*_test.go`)
- File-type-specific naming rules

### Always-on rule (no `paths`) → rule without frontmatter

Cross-cutting standards that apply everywhere but pollute CLAUDE.md:

- Naming conventions
- Error handling style
- Logging format
- Control flow preferences (early returns, guard clauses)
- Git commit format (if it applies to every commit)
- Code organization patterns

The point: extract these even when they apply universally. The base CLAUDE.md should be about *the project*, not about generic coding standards.

## Path glob heuristics

Prefer narrow globs. Claude can re-trigger a rule by accessing more files; an overly broad glob negates the on-demand benefit.

| Topic | Suggested paths |
|---|---|
| TypeScript / JavaScript | `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx` |
| React components | `**/*.tsx`, `**/*.jsx` |
| Go | `**/*.go` |
| C# | `**/*.cs` |
| Python | `**/*.py` |
| Rust | `**/*.rs` |
| CSS / styling | `**/*.css`, `**/*.scss` |
| HTML / JSX markup | `**/*.html`, `**/*.tsx`, `**/*.jsx` |
| Tests | `**/*.test.*`, `**/*.spec.*`, `**/*_test.go` |
| SQL / migrations | `**/*.sql`, `migrations/**/*` |
| Config files | leave path-less unless tied to one file type |
| Plugin development | `plugins/**/*.md`, `plugins/**/*.json` |

Use brace expansion for compactness: `src/**/*.{ts,tsx}`.

## Category structure for `.claude/rules/`

Common categories that scale well:

```
.claude/rules/
├── code-standards/    # naming, error handling, logging, control flow
├── languages/         # one file per language, with paths
├── frameworks/        # React, Next.js, Express, etc.
├── tools/             # git, package managers, build tooling
├── testing/           # test conventions per language
└── plugins/           # repo-specific (only if applicable)
```

Create new categories only when needed. A flat `.claude/rules/*.md` is fine for small projects.

## Merge strategy when target rule already exists

1. **Overlapping headings** → deduplicate. Prefer the more detailed version. Surface conflicts to the user with both versions side by side; let them pick.
2. **Non-overlapping headings** → insert in topical order (not appended at the bottom by default).
3. **Merge would push past 150 lines** → create a sibling file under a subdirectory instead of growing the existing rule.
4. **Existing rule's `paths` is narrower than incoming content needs** → confirm widening with the user before changing it. Other content in that rule may depend on the current scope.

## Anti-patterns

- **Pointer breadcrumbs**: do not leave "see `.claude/rules/X.md`" notes in CLAUDE.md after extracting. The rules system handles discovery automatically; pointers re-add the noise rulify is removing.
- **Empty frontmatter blocks**: omit `---` entirely for always-on rules. Do not write `---\n---` headers.
- **Over-broad globs**: `**/*` on a rule defeats the purpose. If it applies to everything, make it path-less.
- **Eager `@` imports as a substitute**: `@path` expands at launch, just like inline content. Imports help organization, not context cost. For real on-demand loading, use rules with `paths`.
- **Nested duplication**: do not copy a rule into a subdirectory CLAUDE.md "just in case." Path-scoped rules already trigger when files in that subdir are accessed.

## Verification after rulifying

1. Line counts: CLAUDE.md ≤ 200 (target 150); each rule ≤ 150.
2. No `@` imports left pointing at content that could be a path-scoped rule.
3. Run a test session in a sample subdirectory and check `/memory` to confirm the right rules load and stay out of the way when not relevant.
4. The `InstructionsLoaded` hook (mentioned in the spec) is the most precise way to verify path-scoped triggering.
