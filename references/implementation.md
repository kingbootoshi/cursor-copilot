# Cursor Copilot - Implementation Mode

Delegate scoped build / edit work to Cursor Composer 2.5 Fast. Cursor makes the change, verifies it, and reports what it touched. Best for tight, well-bounded changes - not sprawling high-context refactors (keep those on Codex).

## Outcome

Goal: Turn a scoped change request into a working diff, verified, with a clear report of what changed.

Success means:
- Cursor implements exactly the change in the brief - nothing more.
- Cursor verifies its work (build / typecheck / test / run) before reporting done.
- Cursor returns the list of files touched and how it confirmed the change works.

Stop when: Cursor returns a verified change matching the brief, or a clear blocker.

## The Loop (implementation flags)

Default `agent` mode (full edit). No browser-harness. Add `--map` for orientation.

```bash
cursor-pilot start "<implementation brief>" --dir /path/to/repo --map --force
cursor-pilot await-turn <jobId>
cursor-pilot capture <jobId> 220 --clean
```

Iterate on the same change:

```bash
cursor-pilot send <jobId> "The typecheck fails on <file>. Fix it without changing the public API, then re-run the check."
cursor-pilot await-turn <jobId>
cursor-pilot capture <jobId> 220 --clean
```

## The Implementation Brief

State the boundary hard. Name what to change AND what to leave alone. Demand a verification step.

```text
Goal: <the exact change> in this repo.

Success means:
- <observable behavior after the change>
- <the change is scoped to these files / this surface only>
- You verify with <build / typecheck / test / run command> and it passes
- You do NOT touch <out-of-scope areas>

Stop when: The change is implemented and your verification command passes.

Return this report:
RESULT: DONE | BLOCKED
CHANGE: <one-line summary of what you did>
FILES: <every file touched>
VERIFICATION: <command you ran + its result>
NOTES: <decisions, anything out of scope you noticed>
BLOCKERS: <if BLOCKED, exactly what and why>
```

## Implementation Scope Examples

Add a focused feature:

```bash
cursor-pilot start "Goal: Add a --json flag to the 'report' command in this CLI.

Success means:
- 'report --json' prints valid JSON of the same data the human format shows
- The human format is unchanged when --json is absent
- You verify with 'bun run report --json | jq .' and it parses
- You do NOT change any other command

Stop when: --json works and the jq check passes.

Return RESULT, CHANGE, FILES, VERIFICATION, NOTES, BLOCKERS." \
  --dir /path/to/repo --map --force
```

Fix a bug from a QA report:

```bash
cursor-pilot start "Goal: Fix the empty-state crash in the dashboard.

Repro: loading /dashboard with zero projects throws 'cannot read length of undefined' in DashboardList.

Success means:
- /dashboard renders an empty state instead of crashing when projects is empty
- Existing non-empty rendering is unchanged
- You verify with the typecheck and by reasoning through the empty array path
- You do NOT refactor surrounding components

Stop when: The empty path renders safely and typecheck passes.

Return RESULT, CHANGE, FILES, VERIFICATION, NOTES, BLOCKERS." \
  --dir /path/to/repo --map --force
```

## Triage

- Review the diff yourself or hand it to a QA-mode run for browser verification.
- Send one focused follow-up when verification is missing or the scope drifted.
- Escalate to Codex when the change turns out to need deep, multi-file, high-context work.
