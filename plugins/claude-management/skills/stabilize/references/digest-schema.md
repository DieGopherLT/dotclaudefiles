# Contracts: digest and verdict

The two JSON contracts that move between stabilize and its agents. Both agents return ONLY the JSON object as their final message — parse it directly.

## Digest (transcript-digester → stabilize)

One digest per transcript. Three knowledge shapes, because they route to different destinations later: `flows` are executable procedures (skill candidates), `conventions` are constraints applied repeatedly without being a procedure (rule candidates), `user_corrections` are explicit feedback the user gave mid-session (feedback-memory candidates).

```json
{
  "flows": [
    {
      "intent": "add DB migration",
      "steps": [
        "edit schema.prisma with the model change",
        "run pnpm db:migrate:dev and name the migration snake_case",
        "review the generated SQL before committing"
      ],
      "files_touched_pattern": "prisma/migrations/*/migration.sql",
      "commands": ["pnpm db:migrate:dev"],
      "occurrences": 2
    }
  ],
  "conventions": [
    {
      "claim": "models declare a plain data interface, a methods interface, and a Model type, passing all three to Schema",
      "applies_to": "src/models/**/*.model.ts",
      "occurrences": 3
    }
  ],
  "user_corrections": [
    {
      "correction": "always run the seed script before integration tests, never rely on fixture data left from a prior run",
      "context": "wrote an integration test suite assuming a clean DB state",
      "applies_to": "tests/integration/**"
    }
  ],
  "session_summary": "added rabbit-shot payout migrations and two mongoose models"
}
```

Field notes:

- `steps` describe shape, not literal filenames — the flow must be replayable on a future, differently-named instance.
- `occurrences` counts within THIS transcript only; stabilize aggregates across transcripts.
- `user_corrections` entries carry no `occurrences` — each is an individual candidate regardless of repeat count, since it is feedback already validated by the user giving it, not a pattern inferred from repeated observation. This is why Step 3's cross-session repetition bar does not apply to this array (see the skill body).
- Empty `flows`/`conventions`/`user_corrections` arrays are valid — do not pad a session that had no recurring mechanics.

## Verdict (practice-verifier → stabilize)

One verdict per candidate.

```json
{
  "verdict": "confirmed",
  "claims": [
    {
      "claim": "prisma migrate dev can reset the local database",
      "type": "external",
      "evidence": "Prisma docs, 'migrate dev' reference: development-only command, may reset",
      "source": "https://www.prisma.io/docs/orm/prisma-migrate/..."
    },
    {
      "claim": "migrations are named snake_case",
      "type": "internal",
      "evidence": "12 of 12 existing migration dirs follow the pattern",
      "source": "prisma/migrations/"
    }
  ],
  "corrections": [],
  "confidence": 90
}
```

Field notes:

- `verdict`: `confirmed` | `adjusted` | `refuted`.
- `corrections` is only populated on `adjusted` — concrete fixes stabilize applies to the candidate BEFORE materializing it.
- `confidence` scores the verdict itself (0-100). Stabilize materializes only verdicts the practice-verifier agent deems actionable per its own confidence contract (the agent owns the bar); everything else is reported, not written.

Both contracts on this page are mirrored copies. The agents (`agents/transcript-digester.md`, `agents/practice-verifier.md`) are the operative owners — if either shape or the confidence bar changes, update the agent first and mirror the change here.

Candidate aggregation rules (what counts as recurring, how merges work) live in the skill body, Step 3 — they are stabilize-internal logic, not part of these contracts.
