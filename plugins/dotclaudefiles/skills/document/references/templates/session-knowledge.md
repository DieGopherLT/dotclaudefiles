# Session Knowledge Template

Use this template for sessions that generated knowledge but no code changes.

## When to Use

- Session was focused on discussion, research, or analysis
- No code was written or modified
- Knowledge, conclusions, or decisions were generated worth preserving

## Template Structure

```markdown
# {concise_session_summary}

## Metadata

- **Timestamp**: {YYYY-MM-DD HH:MM:SS}
- **Project**: {project_name}
- **Category**: Session Knowledge
- **Tags**: {comma_separated_tags}

## Session Summary

{high_level_summary_of_the_conversation}

## Key Knowledge Gained

{important_insights_patterns_or_discoveries_from_session}

## Conclusions / Decisions

{conclusions_reached_or_decisions_made_with_brief_rationale}

## Open Questions

{unresolved_questions_or_areas_needing_further_investigation}

## Next Steps

{natural_continuation_points}

## References

{links_people_slack_channels_or_documents_consulted}
```

## Field Guidance

Notes that add context beyond what the template structure already shows:

- **Metadata**: Timestamp and Project are auto-detected. No Related Commit needed since session knowledge captures discussion, not code changes.
- **Session Summary**: High-level recap of the conversation -- what was discussed, what the starting point was, and the general direction it took. Keep it to 2-4 sentences.
- **Key Knowledge Gained**: The non-obvious insights. Skip things that are easily searchable; focus on conclusions that required reasoning or context to reach.
- **Conclusions / Decisions**: Include brief rationale for each. A decision without a "why" loses value over time.
- **Open Questions**: Unresolved items worth revisiting. Mark urgency if relevant.
- **References**: Primarily links (docs, articles, PRs). Can also include people consulted, Slack threads, or other non-link sources when relevant.
