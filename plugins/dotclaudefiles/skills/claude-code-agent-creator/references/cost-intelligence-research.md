# Cost vs. Intelligence by Model and Effort: Research Notes

Compiled 2026-10-09 from Anthropic's docs, Artificial Analysis (AA) and a Tavily research run. `thinking-load.md` holds the rules distilled from this; this file holds the data and the sources so the rules can be re-checked when a model ships. Re-run the research at every model release.

## 1. List prices (Anthropic API, USD per MTok)

Source: https://platform.claude.com/docs/en/about-claude/pricing (fetched 2026-10-09).

| Model | Input | Output | Cache read | Cache read as share of input |
| --- | :-: | :-: | :-: | :-: |
| Fable 5.1 | 10 | 50 | 0.25 | 2.5 % |
| Opus 5.5 | 4 | 20 | 0.20 | 5 % |
| Opus 5 | 5 | 25 | 0.50 | 10 % |
| Sonnet 5.5 | 2 | 10 | 0.10 | 5 % |
| Sonnet 5 | 2 | 10 | 0.20 | 10 % |
| Haiku 5.5, prompt <= 100K tokens | 0.10 | 0.50 | 0.01 | 10 % |
| Haiku 5.5, prompt > 100K tokens | 0.50 | 2.50 | 0.05 | 10 % |
| Haiku 4.5 | 1 | 5 | 0.10 | 10 % |

Haiku 5.5 is priced per request by prompt length, cache reads and writes included: one request over 100K pays the 5x card even if most of it is a cache hit. Every other current model bills the same rate across the whole 1M window.

Per-token ratios, sonnet : opus : fable = **1 : 2 : 5**. Haiku is **0.05x Sonnet** under 100K and 0.25x above.

## 2. Intelligence Index and cost per task by effort

Artificial Analysis Intelligence Index, version 4.3.2 (the version in force for every 5.5 launch article; AA recomputes the index, so absolute numbers shift between versions and only same-version comparisons are valid). Cost per task is AA's cost to run one index task at the given effort.

Sources: https://artificialanalysis.ai/articles/claude-opus-5-5 (2026-09-22), https://artificialanalysis.ai/articles/claude-sonnet-5-5 (2026-09-28), https://artificialanalysis.ai/articles/claude-haiku-5-5 (2026-10-07), AA model pages, and per-effort ladders as reported from AA by https://coursiv.io/blog/claude-sonnet-5-5 and https://emergent.sh/learn/claude-opus-5-5-vs-opus-5 (AA publishes the ladders as charts; the third-party pages transcribe them).

| Effort | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Fable 5.1 | Sonnet 5 | Opus 5 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| low | n/p | 36 / $0.41 | 42 / $0.55 | 47 / $2.37 | 24 / $0.51 | 39 / $1.10 |
| medium | 34 / $0.05* | 41 / $0.59 | 51 / $1.34 | 49 / $2.98 | 28 / $1.00 | 45 / $2.19 |
| high | 38 / n/p | 47 / $1.08 | 54 / $1.82 | 51 / $3.91 | 32 / $1.79 | 48 / $3.61 |
| xhigh | n/p | 52 / $2.74 | 56 / $3.46 | 53 / $5.98 | 34 / $2.87 | 50 / $4.88 |
| max | 43 / $0.21* | 56 / $7.60 | 58 / $5.98 | 53 / $7.63 | 38 / $5.09 | 51 / $5.86 |

Format: index score / cost per task. n/p: not published. *Haiku 5.5 cost per task is provisional: AA's site did not yet apply the > 100K rate card when these were measured.

Output tokens per task at `max`: Haiku 5.5 ~162K, Sonnet 5.5 ~193K (the highest AA has recorded), Opus 5.5 ~119K, Fable 5.1 ~78K, Opus 5 ~73K. Haiku 5.5 at `high` uses ~55K.

What the table says:

- **Same score, different bill.** Sonnet 5.5 `max` and Opus 5.5 `xhigh` both score 56; Opus gets there for $3.46, Sonnet for $7.60. Opus 5.5 `medium` (51) matches Fable 5.1 `high` (51) for $1.34 against $3.91.
- **Opus 5.5 is the Pareto frontier.** AA: `medium`, `high`, `xhigh` and `max` all sit on the intelligence-vs-cost frontier, outperforming or undercutting every other model scoring 50+. Opus 5.5 `medium` beats Opus 5 `high` (51 vs 48) for 37 % of the cost.
- **Fable 5.1's ladder is flat at the top.** `xhigh` and `max` both score 53; `max` costs 28 % more. The whole ladder spans 47 to 53 for a 3.2x cost spread.
- **`max` never pays on the index.** Opus 5.5: +2 points for 73 % more than `xhigh`. Sonnet 5.5: +4 points for 2.8x. Haiku 5.5: +2 points for ~1.8x the tokens. Fable 5.1: +0.
- **Sonnet 5.5 is the cheaper model only up to `xhigh`.** At `max` it costs more per task than Opus 5.5 at `max` and scores lower. The emergent.sh / Coursiv reading: escalate the model, not the setting.
- **Haiku 5.5 beats Sonnet 5.5 `low` and `medium` per task at `high` and `max`** (38 and 43 against 36 and 41) for a fraction of the cost. The reason to leave Haiku is tokens and wall-clock (162K tokens per task at `max`, more than Opus) and long-prompt behavior (section 4), not cost per task.

## 3. Anthropic's own measurements and guidance

Sources: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model, https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence, https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1, https://platform.claude.com/docs/en/models/haiku-5-5/whats-new-haiku-5-5, https://www.anthropic.com/claude-opus-5-5 (all fetched 2026-10-09).

- **Starting point.** "For most agent workloads, start with Claude Opus 5.5 at its default effort (`medium`), and use Claude Fable 5.1 for demanding reasoning and long-horizon agentic work, or when your evals on Claude Opus 5.5 at higher effort still fall short." The model selection matrix reserves Fable 5.1 for "agent sessions that run for hours, multistep deep research, analysis carried through to a finished document, spreadsheet, or deck"; Haiku 5.5 for "real-time applications, high-volume intelligent processing, cost-sensitive deployments needing strong reasoning, sub-agent tasks".
- **Default effort per model.** `high` on Fable 5.1, Opus 5, Sonnet 5.5 (API); `medium` on Opus 5.5 and Haiku 5.5. Claude Code: `medium` on Opus 5.5, Sonnet 5.5 and Haiku 5.5, `high` elsewhere, `xhigh` on Opus 4.7 (https://code.claude.com/docs/en/model-config).
- **Opus 5.5 vs Fable 5.1, SWE-bench Pro subset.** Opus 5.5 `medium` 92.8 % vs Fable 5.1 default 92.3 % (inside noise), $0.22 vs $1.19 per solved task. HAProxy C-to-Rust rewrite: Opus 5.5 finished in 9.5 h vs 12 h for Fable 5.1, 51 % cheaper. Anthropic adds: "In our own use, the gap between Opus 5.5 and Claude Fable 5.1 is narrower than these scores suggest."
- **Opus 5.5 effort curve, SWE-bench Pro** (relative to `high`): `medium` -2.5 points at ~70 % of the cost; `low` -8 points at ~1/3; `xhigh` +1.4 points at 2.5x. Anthropic: "Opus 5.5 at `medium` exceeds Opus 5 at `high` on coding and knowledge-work evaluations, and on several coding evaluations `low` comes close to it at much lower cost."
- **Re-run failures at higher effort.** Opus 5.5 at `low` failed 13 % of SWE-bench Pro tasks; re-running only those at `high` passed ~97 % for ~$0.17 per task, against 95.3 % for $0.29 running everything at `high`. Starting at `medium` solved ~97 % for ~$0.24. Needs a reliable failure signal (tests, a checker). This is the sub-agent pattern: cheap first pass, resume the same agent at higher effort on failure.
- **Sonnet 5.5.** "On most agentic coding evals it scored higher at `medium` than Claude Sonnet 5 did at `high`, typically at under a fifth of the cost." Recalibrated levels: start `medium` for agentic coding and multistep tool use, `low` for chat, classification, extraction, search. At `low` on long agentic tasks it is more likely to stop and check in, or skip verifying a change.
- **Haiku 5.5.** Built for "classification, routing, extraction, and subagent tasks"; "substantially better at instruction following and at running as a sub-agent". `low` for chat and short tool tasks; `medium` (default) for most work including agentic coding; `high` for "knowledge work, longer agent tasks, and strict instruction following"; `xhigh`/`max` only with a measured gain, and "compare performance, cost, and speed against Claude Sonnet 5.5 before settling on them". GPQA Diamond: 85 % at one twentieth of Opus 5.5's cost per question (Opus 91 %).
- **Fable 5.1 effort.** Default `high`; "lower effort settings, including `low`, still perform very well, often exceeding the `xhigh` or even `max` performance of previous models"; at `medium` results roughly match Fable 5 at lower cost. On DeepResearch Bench II the score was nearly level across `low`, `medium`, `high` while cost rose from $4.66 to $7.12. The gains over Fable 5 are "widest at higher effort levels" and concentrate in: agentic coding over sessions that run for hours, documents/spreadsheets/slides, multistep research, dense-document vision, **long-context work (reasoning over and connecting details across the full 1M window)**, and computer use.
- **Fable 5.1 at `low` vs the tier below.** SWE-bench Pro: Fable `low` 88.6 % at $0.54 per solved task vs Sonnet 5 default 77.4 % at $0.84. That comparison predates Sonnet 5.5; on the AA index Sonnet 5.5 `high` ties Fable `low` (47) for less than half the cost per task, so the "cheap Fable" argument no longer holds against the current Sonnet.
- **Orchestrators.** Pay only when there is bulk to hand off. Corpus benchmark (21.6M-token corpus, 130 planted defects): a Fable 5.1 lead over 25 Sonnet 5 workers cost 47 to 55 % less than Fable solo, scored 10 to 12 points lower, finished in ~2.3 h instead of 15 to 20; Fable 5.1 `high` solo keeps peak accuracy at ~2.2x the cost. When the work is one dependent chain that fits in one context, the coordinator's model alone at lower effort came out ahead in every case measured.
- **Advisor pattern.** Haiku 5.5 and Sonnet 5.5 executors with an Opus 5.5 advisor consulted on 0 of 198 questions; the tool definition alone added 12 % and 25 % to cost. "First price the advisor's model alone at low effort; that is the baseline to beat."
- **`max_tokens`.** 64K covered all but 2 of ~14,000 Fable 5.1 turns at default effort; a 16K cap ended a quarter of Opus 5.5 attempts and 43 % of Fable 5.1 attempts. Thinking counts toward the cap on every 5.5 model.

## 4. Behaviors that matter for sub-agents specifically

A sub-agent gets a long system prompt (its body plus the CLAUDE.md hierarchy) and cannot ask the user. Three documented behaviors interact with that:

- **Early stopping at `low`** (Haiku 5.5, Sonnet 5.5, Fable 5.1 skips search at `low`): with a long coding-agent prompt the model sometimes hands the task back unfinished. On Haiku, `low` to `medium` roughly halved early stops and more than doubled output tokens per attempt.
- **Unverified "done" at `low` and `medium`** (Haiku 5.5, Sonnet 5.5 at `low`): reports a change as done without running tests or a build. The documented fix is a verification paragraph in the prompt or a higher effort; the archetype templates carry the paragraph.
- **Empty reply at `xhigh`** (Haiku 5.5, multi-turn): the whole answer lands in thinking. One more reason `xhigh` is not a Haiku setting.

Consequence: for an implementer sub-agent `medium` is the floor on every tier, and on Haiku `high` is the honest default once the prompt is long.

## 5. Claude Code specifics

Source: https://code.claude.com/docs/en/model-config and https://code.claude.com/docs/en/sub-agents (fetched 2026-10-09).

- Aliases on the Anthropic API: `haiku` -> Haiku 5.5 (v2.1.293), `sonnet` -> Sonnet 5.5 (v2.1.284), `opus` -> Opus 5.5 (v2.1.280), `fable` -> Fable 5.1 (v2.1.257). `default` resolves to Opus 5.5 on Pro, Max, Team, Enterprise and API.
- Effort precedence: `CLAUDE_CODE_EFFORT_LEVEL` > `--effort` / `/effort` > `modelSettings` / `effortLevel` > model default. Frontmatter `effort` overrides the session level but not the env var. A per-invocation `effort` parameter on the Agent call overrides frontmatter and persists on resume (v2.1.292+). An unsupported level runs as the highest supported level below it.
- `max` is session-only in settings (`effortLevel` rejects it); frontmatter accepts it.
- Fable: "Depending on your plan and seat tier, Fable usage can bill to usage credits instead of drawing on your plan's included limits"; a consent prompt appears in interactive sessions before a Fable request bills credits. Neither Fable model is the default on any plan. claude.com/pricing lists Fable on Max at 50 % of weekly limits and on Pro via usage credits (as reported by https://catdoes.com/blog/sonnet-vs-opus-vs-fable, 2026-10; re-check the plans page before relying on the percentage).

## 6. Compendium: when a sub-agent should run on Fable 5.1

Everything measured says Opus 5.5 first. The cases where Fable earns 2.5x Opus's token price:

1. **The scope is broad, complex and critical at once.** Hours-long sessions, a corpus that fills most of the 1M window, many interlocking constraints where one missed condition sinks the result. This is Anthropic's own positioning (long-context reasoning and multi-hour agentic coding are where Fable 5.1 improved most), and the one place where no public benchmark measures Opus 5.5 head to head. Both models have the same 1M window; the difference Anthropic claims is how well details across that window are connected, not how much fits.
2. **Opus 5.5 at `xhigh` already failed on this task.** The documented escalation rule, and the cheapest way to find out: Opus `xhigh` costs $3.46 per index task, Fable `high` $3.91.
3. **A retry is more expensive than the premium.** When a wrong first answer costs a day of human time, Fable's higher first-attempt accuracy at `low` (47 vs Opus's 42 on the index; Snorkel 61.5 % vs 60.7 % first-pass) can pay. Narrow cases only.
4. **Cache-heavy loops.** Fable's 2.5 % cache-read rate narrows the gap on long agentic runs that re-read a large stable prefix: Anthropic estimates ~25 % lower cost than Fable 5 on typical workloads, up to ~45 % on cache-heavy ones.

Effort on Fable: run it at its default `high`. `medium` (49) sits below Opus 5.5 `high` (54) on the index at 1.6x the cost; `xhigh` and `max` score the same (53), so `xhigh` is the ceiling and `max` is never the answer. For research-shaped work the ladder is flat and `low` is the buy.

Not a Fable case: a task that is merely long (Sonnet, Opus and Fable share 1M), a task that is merely hard (Opus `high`/`xhigh` first), or a budget-constrained orchestrator (Opus `high` plus Haiku/Sonnet workers).

## 7. Diego's working rules versus the data (2026-10-09)

Rules stated from experience, checked against sections 2 to 4:

| Rule | Verdict | Evidence |
| --- | --- | --- |
| Haiku and Sonnet: `medium` is the balance | Holds | Both default to `medium`; Sonnet 5.5 `medium` beats Sonnet 5 `high` at under a fifth of the cost; Haiku `medium` is Anthropic's start for agentic coding. Sub-agent caveat: with a long prompt Haiku implementers want `high` (section 4) |
| Haiku needs `high` -> go to Sonnet | Not on cost per task | Haiku `high` (38) and `max` (43, $0.21) beat Sonnet `low` (36, $0.41) and `medium` (41, $0.59). What justifies the move is wall-clock and token volume (Haiku `max` ~162K tokens per task) and the long-prompt behaviors, plus Anthropic's "compare against Sonnet 5.5 before settling on `xhigh`/`max`". Practical reading: Haiku up to `high`; needing more means Sonnet `medium` |
| Sonnet needs `high` -> go to Opus | Holds one notch later | Sonnet `high` (47, $1.08) is still cheaper than Opus `medium` (51, $1.34); Sonnet `xhigh` (52, $2.74) is where Opus `medium` wins outright. Rule as written: Sonnet up to `high`; needing more means Opus `medium`, never Sonnet `xhigh`/`max` |
| Fable `medium` can beat Opus `high`/`xhigh` on a very large task | Not measured anywhere; the index says the opposite | Fable `medium` 49 at $2.98 vs Opus `high` 54 at $1.82; SWE-bench Pro subset 92.3 % vs 92.8 % at 5x the cost; HAProxy 12 h vs 9.5 h. The refined version (Fable when the scope is broad + complex + critical, at Fable's default `high`) matches Anthropic's positioning and has no public counter-measurement |
| Avoid `max` | Holds on every model | Section 2: +0 to +4 points for 1.3x to 2.8x the cost |

## 8. Tavily research run (2026-10-09)

Query: cost-intelligence relationship of the latest Claude models across effort levels, with sub-agent guidance. Model: `pro`. The run confirmed the price table, the AA index version (4.3.2), the Opus 5.5 and Opus 5 per-effort ladders, the Opus 5.5 `medium` default, Anthropic's Haiku 5.5 sub-agent positioning, and the community pattern "Opus on the main thread, Sonnet/Haiku on sub-agents". It did not find per-effort AA numbers for Sonnet 5.5 or Haiku 5.5 (those came from the AA launch articles and the third-party transcriptions above) and offered no Fable-specific guidance beyond the pricing. Works cited by the run: anthropic.com/claude/{opus,sonnet,haiku-5-5,fable}, artificialanalysis.ai (creators/anthropic, changelog, models/claude-opus-5-5, methodology), emergent.sh/learn/claude-opus-5-5-vs-opus-5, aws.amazon.com/blogs/machine-learning/introducing-claude-haiku-5-5-on-aws, claudefa.st/blog/models/model-selection, myclaw.ai/blog/sonnet-5-5-vs-opus-5-5, cloudzero.com/blog/claude-opus-5-pricing, platform.claude.com/docs/en/about-claude/pricing, claude.com/pricing.
