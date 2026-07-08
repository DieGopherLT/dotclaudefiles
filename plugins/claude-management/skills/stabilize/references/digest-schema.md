# Contracts: digest and verdict

The two JSON contracts that move between stabilize and its agents. Both agents return ONLY the JSON object as their final message — parse it directly.

## Digest (transcript-digester → stabilize)

One digest per transcript. Two knowledge shapes, because they route to different destinations later: `flows` are executable procedures (skill candidates), `conventions` are constraints applied repeatedly without being a procedure (rule candidates).

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
  "session_summary": "added rabbit-shot payout migrations and two mongoose models"
}
```

Field notes:

- `steps` describe shape, not literal filenames — the flow must be replayable on a future, differently-named instance.
- `occurrences` counts within THIS transcript only; stabilize aggregates across transcripts.
- Empty `flows`/`conventions` arrays are valid — do not pad a session that had no recurring mechanics.

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
- `confidence` scores the verdict itself (0-100). Stabilize materializes only `confirmed`/`adjusted` verdicts with confidence >= 80; everything else is reported, not written.

## Candidate rules (stabilize-internal)

- Candidate = same flow/convention (by intent and shape) in >= 2 distinct sessions, OR >= 3 occurrences within one session.
- Merged candidates keep the union of steps; inter-session discrepancies are flagged to the verifier rather than silently resolved.
