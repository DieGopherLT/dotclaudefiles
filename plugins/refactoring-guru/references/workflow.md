# Safe Refactoring Workflow

Refactoring is changing structure without changing behavior. The only way to know behavior did not change
is to have a test that proves it. This is the safe cycle every refactoring follows — the one `refactor`
enforces and the one a smell-scan finding should flow into.

## The cycle: test → refactor → test → commit

```
1. test     Confirm the code is green BEFORE touching it.
2. refactor Apply ONE technique in small, mechanical steps.
3. test     Confirm the code is still green AFTER.
4. commit   Lock in the verified, behavior-preserving change.
```

Repeat once per technique. Never widen the loop to "apply five techniques, then test" — when something
breaks, a tight loop tells you exactly which step did it.

## 1. Test first — establish the safety net

- Run the tests that cover the target location and confirm they pass. A refactor on red code is guessing.
- If there is **no test** covering the location, that is a finding in itself. Two options, in order of
  preference:
  - Write a fast characterization test that pins current behavior, then refactor.
  - If a test is impractical right now, proceed in the smallest possible steps and verify behavior by
    other means (running the affected path, diffing output) — and say so explicitly. Do not pretend a
    safety net exists when it does not.
- Tests are the seatbelt. The whole method's safety claim rests on them.

## 2. Refactor — one technique, small steps

- Apply exactly ONE technique per cycle. Each technique's mechanics (see `technique-playbooks.md`) break
  into individual steps — do them one at a time, keeping the code compilable between steps.
- Do not mix in a behavior change or a bug fix. If you spot a real bug while refactoring, note it and
  leave the behavior unchanged — fix it in a separate, dedicated change. Mixing a fix into a refactor
  destroys bisectability.
- Prefer reversible, mechanical moves. If a step feels risky or large, split it further.

## 3. Test again — prove behavior is preserved

- Re-run the same tests. They must still be green. Same inputs → same outputs, same side-effect ordering,
  same error paths.
- For supported languages, also check editor diagnostics for new type errors or missing imports introduced
  by the move, and fix them before declaring the step done.
- If a test now fails, the refactor changed behavior. Revert the last step and redo it more carefully —
  do not "fix" the test to match the new behavior.

## 4. Commit — lock it in

- Commit the verified change on its own. A refactoring commit should contain only the refactoring, so it
  reads as a pure structural diff and can be bisected cleanly.
- Use a `refactor:` type in the commit message. Never bundle a refactor commit with a feature or a fix.
- One technique per commit is the safe default; group only tightly-related mechanical steps of the same
  technique that must land together to compile.

## Why this order matters

The value of a refactor is the guarantee that the system still does the same thing. That guarantee comes
entirely from step 1 and step 3 — the before-and-after green. Skip the before-test and you cannot tell
whether the code was already broken. Skip the after-test and you cannot tell whether you broke it. The
commit in step 4 is what makes the guarantee durable: a small, isolated, reviewable, bisectable unit.
