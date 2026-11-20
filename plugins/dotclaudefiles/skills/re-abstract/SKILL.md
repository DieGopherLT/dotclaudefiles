---
name: re-abstract
description: >-
  Diagnose and redesign the abstractions that hold up a mature codebase: compare what a module is
  for with the shape its code took over time, and produce a target design plus an ordered roadmap,
  as a markdown report. It never edits code. Use it when the user asks to "re-abstract", for a
  "re-abstracción" or a "refactor masivo", to rethink or redesign a module from its abstractions, or
  says that a module in use for months grew, is hard to follow or costs too much to change, and
  wants to know which patterns, Facades, data structures or module boundaries it should have. Also
  use it when the user asks, about a whole module or repo and not one function, which patterns
  belong in it or what it should expose. Only for mature projects that have a way to verify
  behavior. Not for one refactor or smell at a known location, a code review of a diff or of recent
  changes, moving files without changing what they contain, a new project, or adding tests.
argument-hint: "[module-path ...]"
---

# Re-abstract

A module that has been in use for months took its shape one change at a time. Each change was
reasonable, and the sum no longer matches what the module is for: one file ends up being the whole
server, clients assemble by hand what they use, the same action exists in four paths. This skill
measures that gap and designs the shape the module would have if it were written today by someone
who knows everything it ended up doing.

## Step 1: Resolve the modules

The unit of analysis is a module: a package or directory with one reason to exist.

- The user named one or more modules, in the arguments or in the request: use them.
- The user named a repo or a large directory: measure where the weight is before choosing. For each
  candidate directory collect lines of production code, commits that touched it (`git rev-list
  --count HEAD -- <dir>`), and how many other directories import it. Pick the few where weight
  concentrates, show the user that table with the selection, and confirm it with `AskUserQuestion`.
- The user named nothing: use the module of the file in focus in the conversation. If there is
  none, treat the repo root as the directory named.

## Step 2: Gate, then stop or continue

Check both conditions for every module before spending any agent. A module that fails either one
leaves the run; when none is left, stop.

**Mature.** The shape came from accumulation: months of history, several waves of features and
fixes, real use. Read it from the module path:

```
git log --reverse --format=%as -- <dir> | head -1
git rev-list --count HEAD -- <dir>
```

As a reference, a module with under three months of history or a few dozen commits has had no time
to accumulate a gap between intent and code. When it is not mature, report both numbers and stop.

**Verifiable.** Find how the project proves that it works: a test suite, end-to-end scripts, a
simulator, a documented manual flow against a staging or local environment. Run the automated part
once and confirm it passes. A manual flow counts when it is written down in the repo; cite the
file. Write down the commands and flows as one line that covers every module of the run; that line
is the `verification` argument of Step 4 and every step of the roadmap will cite it.

If there is nothing that verifies behavior, or the suite is red, stop here. A re-abstraction
replaces the code under everything else, and without a way to prove that behavior survived, the
report would be a rewrite proposal that nobody could check. Tell the user that, and suggest building
tests or verification flows for the application first: scripts that exercise it, skills that drive
it, a virtualized or emulated environment. Do not continue with a partial analysis.

## Step 3: Record the language and the purpose of each module

Read the manifest next to the module (`go.mod`, `package.json`, `*.csproj`, `pyproject.toml`, ...)
and record the language.

Write one sentence saying what the module is for, taken from its README, its package documentation
or the user's words, and not from the shape of the code: the analysis compares the code against
this sentence, so a purpose read back from the code would hide the gap. If nothing states it, ask
the user.

## Step 4: Launch the Workflow

Each module costs 12 agents: 7 evidence lenses, 1 modernization researcher with web access, 2
architects and 2 skeptics. Tell the user the total before launching. Invoking this skill is the
opt-in for the Workflow tool.

Capture what the script cannot compute:

```
date -u +%Y-%m-%dT%H:%M:%SZ
git rev-parse --show-toplevel
```

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/re-abstract/scripts/workflow.js",
  args: {
    modules: [{ path: "<absolute module path>", language: "<language>", purpose: "<one sentence>" }],
    repoRoot: "<absolute repo root>",
    analyzedAt: "<captured timestamp>",
    verification: "<the line from Step 2>"
  }
})
```

What it runs, per module:

| Phase | Who | Produces |
| --- | --- | --- |
| Explore | 7 `plan-explorer`, one per lens: responsibilities, surface, duplication, data, dependencies, indirection, history | Observations, each with a measure and the cost it adds to a change |
| Explore | 1 researcher with web access | Constructs that a newer language, standard library or dependency feature replaces, with the official source |
| Design | 2 `plan-architect`: `ideal` and `balanced` | A target shape and a list of proposals, each naming what it deletes |
| Verify | 1 skeptic per design | For each proposal, whether the deletions hold in the code and whether the variation it rests on exists |
| Assemble | plain JavaScript | One dossier per module, every proposal marked `survives`, `dropped`, `contested` or `unverified` |

It returns `{ modules: [{ module, counts, missingLenses }], files }`. `files` holds one dossier per
module, already serialized, with an absolute `path`. A module you passed that is absent from
`modules` produced no evidence: tell the user and leave it out. When `missingLenses` is not empty
or a dossier holds a single design, say so in the report's summary.

## Step 5: Persist the dossiers

Write each entry of `files` verbatim with `Write`. The dossiers are analysis output and are not
meant to be committed, so keep them out of version control without touching the tracked
`.gitignore`:

```
grep -qxF '.claude/re-abstract/' "$(git rev-parse --git-common-dir)/info/exclude" || echo '.claude/re-abstract/' >> "$(git rev-parse --git-common-dir)/info/exclude"
```

## Step 6: Decide the design

The architects propose and the skeptics check; the decision is yours. Read each dossier and build
one target design per module under these rules. They keep the design from adding patterns that
remove nothing.

- **Keep an abstraction for what it deletes.** Keep a proposal only if it names concrete
  things that disappear: a code path, a file, a concurrency unit, a branch, a nil check, a cleanup
  pass. `dropped` proposals stay out. For `contested` and `unverified` ones, open the code yourself
  before keeping them.
- **Variation needs evidence.** A Strategy, an Adapter or any extension point justified by "in case
  it changes" needs variation that already happened: two variants in the code, or the `history`
  lens showing the change. Where `ideal` proposes an abstraction that `balanced` declines, treat it
  as speculative until that evidence appears.
- **A Facade is judged from its client code.** Read the call site after the change. It should read
  as the list of decisions the client makes. If the client still builds dependencies, respects a
  construction order or passes literals the module could derive, the module still exposes too much.
- **Data lives as long as its owner.** A structure whose entries outlive the thing they describe,
  and the cleanup pass that exists because of it, are both signs of the wrong structure.
- **A better design may remove a defect.** That is a gain. List every behavior change explicitly so
  nobody discovers it in production.
- **Start from agreement.** A proposal that appears in both designs (`I*` and `B*`) and is marked
  `survives` in each has the most evidence behind it. Build the design from those first.

If two proposals conflict and the code does not settle it, ask the user with `AskUserQuestion`; do
not pick silently.

## Step 7: Write the report

Write one report per module as `report.md` in the directory of its dossier (the `path` returned in
`files`), in the language the user writes in. The "Costs and risks" table comes from the `Costs` of
the designs you kept. Use the sections below and omit one only when it would be empty.
Tables carry the content; prose connects them.

```markdown
# Re-abstract: <module>

## Summary
<What shape the code took, what shape suits it, and what the change buys, short enough to read at a glance.>

## Why rethink it
| Symptom | Measure today | What it costs when something changes |

## Before and after
<ASCII diagram: today's units on the left, target units on the right, arrows for dependencies.>

## One Facade per unit
| Unit | Facade | What it hides | Depends on |

## Client code, before and after
<The main call site today and after the change, and what the client no longer has to know.>

## Patterns and data structures
| Problem | Today | Proposed | What is deleted or gained |

## Defects the design removes
| Rule the system should enforce | What happens today | What happens after |

## Modernization
| Construct today | Replacement | Since version | Source |

## Discarded
| Proposal | Why it was dropped |

## Roadmap
<Ordered steps. Cleaning and defect fixes inside the current shape go first, then moves, then new
abstractions, so that a move never hides a behavior change. Each step states how it is verified.>

## Costs and risks
| What changes or gets worse | Why it is acceptable | When it stops being acceptable |
```

## Step 8: Present

Lead with the verdict in the conversation: what the module should become and the two or three
changes that carry most of the gain. Then give the report path. Offer nothing else by default. If
the user asks for something shareable, publish the report as an artifact.

Do not start changing code. The roadmap is the input for planning the implementation, and that
starts when the user asks for it.
