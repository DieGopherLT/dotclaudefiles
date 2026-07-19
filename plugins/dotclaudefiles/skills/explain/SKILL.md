---
name: explain
description: "Answer a question or explain a concept, a piece of code, an architecture, or a design decision using a calibrated altitude framework: lead with business and contract-level understanding and descend into implementation detail only as the conversation steers deeper. Use this whenever the user asks you to explain something, asks how something works, says 'help me understand', 'walk me through', 'what is', 'why does', or poses any conceptual, architectural, or code question, especially when a fast, scannable mental map matters more than an exhaustive technical dump. Prefer this over a default implementation-first explanation."
---

# Explain at the right altitude

Your default explanation runs implementation-first and verbose: heavy on code-level
detail, and heavier still as reasoning effort rises. That is precise, but it is the wrong
shape when someone is building a mental model, or when they are splitting attention across
several sessions and cannot pay full attention to a wall of technical prose.

This skill fixes the shape. It leads with the big picture, keeps the answer scannable, and
descends into detail only when the conversation asks for it. The goal is a faithful mental
map fast, not exhaustive completeness up front.

## The three altitudes

Every explanation lives at one of three altitudes. Name them explicitly when it helps the
reader steer, since a shared label makes "stay at Contract level" a precise instruction.

- **Business** answers *what* and *why*. Plain language an engineer would use with a product
  manager or a client. No jargon, no components, just the purpose and the value.
- **Contract** answers *how it fits together*. The components, modules, or classes involved;
  how they talk to each other; their dependencies, ownership, and boundaries. Architecture
  and design, not implementation. When two things integrate, this is where the interface,
  the event, or the endpoint lives.
- **Implementation** answers *how it actually works*. The concrete mechanics: the code, the
  algorithm, the data structures, the edge cases, the exact call sequence.

## Match the entry altitude to the question, then climb down on demand

Read the altitude the question sets and answer there first. Do not overshoot below what was
asked. A pointed technical question ("why does this deadlock?") wants an Implementation
answer immediately; opening with business context would be condescending. An open-ended or
conceptual request ("explain how auth works here", "what is this service for?") wants the
top of the staircase, because the map builds fastest from above.

Treat the explanation as a staircase you descend one step at a time:

1. Answer at the entry altitude, leaning on **Business and Contract** for anything
   open-ended. Lead with the conclusion or the shape, not the buildup.
2. Stop. The reader's follow-up is the signal to descend, and it tells you exactly which
   thread they want deeper.
3. Drop into **Implementation** for the specific piece they pointed at, not the whole
   surface.

This does two things: it gives the reader the panorama first, and it lets their mind engage
and pull the conversation down to the detail *they* care about, instead of forcing them to
wade through detail they did not ask for.

## Keep it lean

Less is usually more here, and this matters most when the reader is context-switching.

- Front-load the answer. The first sentence should carry the point.
- Prefer a tight map over an exhaustive one. Completeness is what follow-ups are for.
- Resist the pull of higher effort toward more prose. Effort should buy a better-ordered
  explanation, not a longer one.

## Make it stick

An explanation lands faster when it hooks onto how people actually learn. Reach for these
devices, especially at Business and Contract altitude where the mental model is still forming.

**Anchor to something already understood (association).** The fastest way to teach a new
concept is to pivot from one the reader already holds. Scan the conversation and what you
know about the reader for a nearby concept, then frame the new idea as a modification of it:
"it's a Strategy, but the variant is chosen at build time instead of runtime." A good anchor
does more work than three paragraphs of ground-up definition.

**Offer a mnemonic when one is cheap (mnemonics).** When a fact is an arbitrary order or set
that just has to be memorized, a small mental hook makes it stick for free. Don't force one,
but when it's there, hand it over: Linux permission order is "HUGO without the H" (User,
Group, Others).

**Draw it at Contract altitude (visuals).** Structure and relationships are easier to see
than to read. When explaining how a handful of components fit together, add a small ASCII
diagram of up to about 5 elements, placed after the prose so the words frame the picture, not
before. When the structure outgrows ~5 elements or needs interaction to be legible, escalate
instead of cramming it into ASCII: invoke the `artifact-design` skill to build an interactive
diagram. Interactive diagrams use real elements and connectors, never ASCII art wrapped in a
styled block.

## Use real names, then define them

Names make communication fluid. When a concept, pattern, or principle has a real,
established term, use it instead of paraphrasing around it: naming a Facade, a
Chain of Responsibility, backpressure, or idempotency lets the reader recognize the idea
and go read more on their own.

Whenever technical terms appear in an explanation, close with a short glossary so the reader
has a compact reference. One line per term, definition only, no filler.

**Glossary format:**

```
## Glossary

- **Term**: one-line definition.
- **Term**: one-line definition.
```

Omit the glossary entirely when the explanation stayed at Business level and introduced no
technical terms; there is nothing to define.
