---
name: create-report
description: >
  Produces an on-demand report mid-session in one of two formats — without any git workflow
  involvement. Use immediately when the user says "crea un reporte", "create a report", "documenta
  esto", "make a report", or "write this up" — these signal a Markdown document. Use when the user
  says "crea un artefacto interactivo", "share with the team", "explain this to the team", "make a
  report for X", or names a specific audience — these signal an interactive HTML artifact. Do NOT
  use for session-closing flows ("termina la sesión", "wrap up", "haz commits"); those belong to
  end-session. If the request is ambiguous between the two formats, use AskUserQuestion to clarify
  before writing anything.
---

# Create Report

This skill produces standalone documentation on demand — decisions captured mid-session, analyses
to hand off, or artifacts built for a specific audience. It never touches git or commits anything.

## What every report must capture

Both formats document everything a reader cannot derive from the code or git history alone:

- Decisions made and the reasoning behind them
- Assumptions that shaped the work
- Trade-offs considered and rejected alternatives
- Non-obvious constraints or external context that influenced the direction
- References to relevant files, functions, and symbols so the reader can navigate without re-reading prose

The report must be self-contained: a reader with zero session context should be able to reconstruct
the full picture from it alone.

## Detecting the format

When the request could go either way, use `AskUserQuestion` to clarify before writing.

Signals for **Markdown**: "crea un reporte", "create a report", "documenta esto", "write this up",
"make a document".

Signals for **HTML**: "crea un artefacto interactivo", "share with the team", "explain this to
X", "make a report for X", naming a specific external audience.

## Format A — Markdown

Write as a plain `.md` file. Structure the document around the content — no fixed template; let
the material determine the sections. The document should read like a technical briefing, not a log.

At the bottom, include a dedicated **References** section listing every file path and symbol
mentioned in the body. This lets the reader navigate the codebase directly.

Name it clearly (e.g., `<topic>-YYYY-MM-DD.md`) and save it to the project root or alongside the
work discussed. Use `date +%Y-%m-%d` via Bash to get today's date for the filename.

## Format B — Interactive HTML

- Save as an `.html` file. Never output raw HTML in the conversation.
- Use interactive elements — tabs, collapsible sections, navigation anchors — to maximize
  information density without overwhelming the reader.
- Include visual structure where it adds clarity: tables for comparisons, timelines for sequences,
  diagrams for architecture. HTML affords far more than Markdown; use that affordance.
- The file must open directly in a browser and be shareable as-is — no external dependencies,
  no server, no build step.

Name it clearly (e.g., `<topic>-YYYY-MM-DD.html`) and save it alongside the work.
