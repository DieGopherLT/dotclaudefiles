---
name: de-claudish
description: Use this skill whenever the user wants to strip "Claudish" AI prose style, eliminate pseudo-academic jargon, perform semantic compression, normalize terminology, or rewrite technical and experimental reports into plain, verifiable statements.
---

# De-Claudish & Plain Technical Writing

Transform text from "Claudish" (AI-specific rhetorical polish, nested abstractions, process metaphors, and contrast-heavy restatements) into the smallest set of ordinary, verifiable propositions.

## Core Rules

### 1. Semantic Compression

State each fact once. If multiple clauses restate the same proposition, dramatize it, contrast it with an artificial alternative, or summarize what was already stated: **collapse them into a single direct sentence**. If deleting a clause loses no fact, condition, or scope, delete it immediately.

### 2. Lowest Useful Abstraction & Nominalization to Verbs

Replace abstract nouns, compound hyphenations, and process metaphors with direct verbs and concrete physical relationships:

| Claudish / Nominalized | Plain Direct Expression |
|---|---|
| Merge authority is restricted to owner role | Only owners can merge |
| approval-gated release path | Release requires approval |
| cache-staleness verification pass | Check if cache is stale |
| the rewrite is a fact-preservation pass | Keep all facts during rewrite |
| Passing tests is a mandatory launch requirement | Do not launch until tests pass |
| Implement strict validation interception of the user's authentication state | Unauthenticated users cannot access this |

### 3. Strip Rhetorical Scaffolding

Delete without replacing:

- **Contrastive framing:** Remove *not X but Y*, *less X than Y*, and artificial rejection-then-assertion structures.
- **Staged emphasis:** Delete *the key distinction*, *the deeper point*, *the load-bearing constraint*, *the smoking gun*, *the core dividing line*, *fundamentally speaking*.
- **Redundant orientation:** Delete *in other words*, *put differently*, *in one sentence*, *to sum it up in one sentence*, *to put it another way*.
- **Candor & aphoristic padding:** Delete *that distinction matters*, *you're absolutely right*, *fair hit*, *objectively speaking*.

### 4. Decode Metaphors & Jargon

Restore metaphors to their actual physical referents:

| Metaphor / Jargon | Real Meaning |
|---|---|
| X-gated / gated on X | Requires X / Must finish X first |
| load-bearing | Essential / Required |
| surface / surface area | Actual interface, code, screen, or issue |
| path / pipeline | Action, option, or process |
| landed | Merged, deployed, or completed |
| drift | Divergence / Change over time |
| canonical | Official / Default preferred |
| stale | Outdated / Expired |
| lineage / pedigree (of a model) | Base model origin |
| eats up half the space | Covers half the range |
| reward farming / gaming the reward | Reward is optimized but evaluation metrics do not improve |
| drawing lots | Close to random selection |
| ran for nothing / sat idle | Ineffective run / Unused allocation |

### 5. Strict Logical Scope Preservation

Preserve the exact boundary of every claim:

- Untested != Incorrect; Not started != In progress.
- Required != Sufficient; Prerequisite != Causal explanation.
- If an outcome's cause is unknown, write *cause not yet determined* directly. Never fabricate post-hoc rationalizations.

## Technical & Experimental Report Standards

When drafting conclusions, experiment write-ups, and audit reports, strictly enforce these standards:

### 1. Standard Terminology

- *truncated / hit the length limit* (instead of *too long*)
- *multiple tasks contending for the same port* (instead of *Ray's port collided with itself*)
- *approach / configuration* (instead of *arm*)
- *length-heuristic baseline* (instead of *the line that only looks at length*)
- *checkpoint* (instead of *save file*)

### 2. Neutral Labels & Consistency

- Use objective, neutral terms for table headers and category names: *Issue / Impact / Confidence level / Experimental setup / In progress / Completed / Conclusion pending*.
- Colloquial labels are prohibited: *pitfall / gut feeling / how we did it / still running / got it working / unexpected find*.
- Status labels must be uniform and consistent throughout the entire document.

### 3. Eliminate "Not X, but Y" Contrastive Sentences

- Bad: "Gradient alignment: it's noise, not signal" → Good: "Gradient alignment: all three check results fall within the noise range"
- Bad: "We bought diversity in lineage, but not diversity in capability" → Good: "The added models cover more base models, but their accuracy is below the lower bound of the original range"
- Bad: "Stability was bought with coarseness" → Good: "Metrics with few distinct values have a high overlap rate"

### 4. Disallow Speculative Justification

- If a mechanism is unproven, state it plainly: *the relationship between this phenomenon and truncation has not been verified* (never write *"this may also explain the earlier phenomenon"*).
- Remove unneeded narrative pivots: delete *"since prediction didn't work, let's take a step back"*; go straight to the setup.

### 5. Quantify Cost & Remove Colloquialisms

- *the difference is 0.030* (instead of *won decisively*)
- *higher / lower estimation precision* (instead of *measured more accurately / more roughly*)
- *requires 79 GPU-hours* (instead of *not a free lunch*)
- *main issue* (instead of *a fatal problem*)

### 6. Remove Anthropomorphism

- *this signal requires several hundred to over a thousand samples* (instead of *inherently needs hundreds of samples*)
- *truncation increases reward variance when it occurs* (instead of *once it overflows it creates unevenness*)
- *accuracy changed by 0.05 after 24 training steps* (instead of *24 steps only nudged it by 0.05*)

## English Claudish Transformations

| Claudish Original | Plain Direct English |
|---|---|
| The timestamp provides verified evidence of cache staleness. | The timestamp shows that cache is stale. |
| Do not initiate deployment pathway prior to test suite passage. | Do not launch until tests pass. |
| This change introduces a non-trivial cognitive surface. | This change makes the interface harder to understand. |
| The rewrite functions as a fact-preservation pass. | Keep all facts during rewrite. |
| Release authority is strictly approval-gated on staging verification. | Release requires staging approval. |
| The load-bearing constraint here is token budget exhaustion. | The token budget is full. |

## Pre-flight Checklist

- [ ] Did you perform a structural rewrite rather than mechanical word swaps?
- [ ] Are all "not X but Y" contrastive phrases and "in other words" scaffolding deleted?
- [ ] Have process metaphors and colloquialisms been converted to physical entities and metrics?
- [ ] Is the logical scope exact (untested != incorrect, unknown cause != speculation)?
- [ ] Is the output clean text only, without conversational intro or post-hoc meta-commentary?