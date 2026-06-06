# Confidence Scoring System for Auditor Agents

Every auditor-style agent must include this system in its system prompt. Without it, auditors flood the user with low-value nitpicks and false positives. With it, the user gets a short, prioritized list of issues that are worth acting on.

## Why this matters

Code review by an agent has a structural problem: the agent has no cost for raising a concern. A human reviewer self-edits — they hesitate before posting "have you considered...?" if they're unsure. An agent does not. Without a forcing function, an auditor returns 30 maybes when the user wanted 3 musts.

The confidence system fixes this two ways:

1. The agent commits to a numeric confidence per finding, which makes lukewarm guesses visible.
2. A hard threshold (>=80) suppresses the noise floor entirely.

## The block to include in auditor agents

Append this verbatim to the **Output format** section of any auditor agent. Do not paraphrase — the wording matters because the agent is going to behave according to what it reads.

````markdown
## Confidence Scoring

Rate each potential issue on a scale from 0 to 100:

- **0**: Not confident at all. This is a false positive that does not stand up to scrutiny, or is a pre-existing issue unrelated to the change under review.
- **25**: Somewhat confident. This might be a real issue, but may also be a false positive. If stylistic, it was not explicitly called out in project guidelines.
- **50**: Moderately confident. This is a real issue, but might be a nitpick or unlikely to happen often in practice. Not very important relative to the rest of the changes.
- **75**: Highly confident. Double-checked and verified — this is very likely a real issue that will be hit in practice. The existing approach is insufficient. Important and will directly impact functionality, or is directly mentioned in project guidelines.
- **100**: Absolutely certain. Confirmed this is definitely a real issue that will happen frequently in practice. The evidence directly confirms this.

**Only report issues with confidence >= 80.** Focus on issues that truly matter — quality over quantity.

## Output Guidance

Start by clearly stating what you reviewed (files, scope, commit range).

For each high-confidence issue, provide:

1. A clear description with the confidence score.
2. The file path and line number.
3. The specific project-guideline reference, OR a clear bug explanation.
4. A concrete fix suggestion — the developer should know exactly what to change.

Group issues by severity:

- **Critical** — must fix before merging. Bugs, security issues, data loss, broken contracts.
- **Important** — should fix soon. Performance regressions, maintainability problems, guideline violations.

If no high-confidence issues exist, confirm the code meets standards with a brief one-paragraph summary stating what you reviewed and why it looks good. Do not pad with low-confidence concerns — silence is a valid answer.

Structure every finding for maximum actionability. The developer should finish reading and immediately know what to fix and why.
````

## Example output (using the system)

A well-formed auditor output looks like this:

```
# Security Review: feature/payment-flow (3 files, +124/-18 lines)

## Critical

### [confidence: 95] SQL injection in OrderRepository.findByCustomerName
**File**: src/repository/orders.ts:47
**Issue**: User-supplied `name` parameter is concatenated directly into a raw SQL query.
**Fix**: Replace string concatenation with a parameterized query:
```ts
db.query('SELECT * FROM orders WHERE customer_name = $1', [name])
```

## Important

### [confidence: 88] Missing rate limiting on /payments/refund
**File**: src/routes/payments.ts:112
**Issue**: The refund endpoint has no rate limiting and is reachable by any authenticated user. An abusive user could spam refund requests.
**Fix**: Apply the existing `rateLimiter.standard` middleware (used on lines 67, 89) to this route.
```

If nothing meets the threshold:

```
# Security Review: feature/payment-flow

Reviewed 3 files (+124/-18 lines). All identified concerns fell below the >=80 confidence threshold. The change applies parameterized queries throughout, preserves existing auth checks, and does not introduce new external calls. No high-confidence issues found.
```

## Adapting the rubric

The 0/25/50/75/100 anchors are calibrated for code review. If you build an auditor for a different domain (security, performance, accessibility, infrastructure), keep the SAME numeric scale and SAME >=80 threshold, but adjust the descriptions to fit:

- Performance auditor: "75 = measured impact in a benchmark or production trace; 100 = repro confirmed locally with timings."
- Accessibility auditor: "75 = clear WCAG violation with user-impact evidence; 100 = blocks specific assistive tech with documented behavior."
- Infrastructure auditor: "75 = misconfiguration with documented exploit/incident class; 100 = active misuse already happening or trivially reproducible."

What matters is that the agent commits to a number and the threshold filters lukewarm guesses. The exact wording per anchor can flex.

## Common mistakes to avoid

When integrating this block into an auditor's system prompt, do not:

- **Soften the threshold** to 50 or 60 because "we want comprehensive coverage." Comprehensive means more false positives, not better safety. Keep it at 80.
- **Drop the severity grouping**. Critical vs. Important triages reader attention; without it, the user has to re-prioritize manually.
- **Allow stylistic concerns at high confidence without a project-guideline citation.** Stylistic findings need a documented rule the agent can point to. If there's no rule, it's an opinion, and opinions belong below 80.
- **Skip the "what was reviewed" header.** The reader needs scope to interpret silence — "I reviewed 3 files and found nothing" is reassuring; an empty report is suspicious.
