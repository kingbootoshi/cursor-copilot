# Cursor Copilot - QA Mode

Delegate QA and fast browser-harness E2E testing to Cursor Composer 2.5 Fast. Cursor exercises the UI or browser workflow like a user and returns a structured report you can act on.

## Outcome

Goal: Turn a change into a focused QA brief, run it through Cursor with browser-harness, and bring back a verdict with evidence.

Success means:
- Cursor gets a bounded test brief with target URL, flows, expected behavior, and the report schema.
- Cursor uses browser-harness for browser interaction, visible verification, screenshots / page state, and reproduction notes.
- Cursor returns a report with verdict, coverage, failures, evidence, and retest instructions.

Stop when: Cursor returns a report that lets you fix a concrete issue, request a retest, or record a PASS.

## The Loop (QA flags)

QA needs `--browser-harness` on the `cursor-pilot start` command. This is a Cursor Pilot wrapper flag, not a native Cursor Agent flag: Cursor Pilot consumes it, injects the local browser-harness Cursor plugin plus browser-harness and AgentMail skill context, then runs Cursor Agent with the right underlying options. The wrapper also auto-disables the Cursor sandbox because browser-harness needs localhost CDP. Never pass `--sandbox enabled` with browser-harness - the wrapper fails fast on that.

```bash
cursor-pilot start "<qa brief>" --dir /path/to/repo --browser-harness --force
cursor-pilot await-turn <jobId>
cursor-pilot capture <jobId> 220 --clean
cursor-pilot status <jobId>
```

Retest after a fix - same session, same brief:

```bash
cursor-pilot send <jobId> "Retest the same brief against the updated app. Report only current failures and changed evidence."
cursor-pilot await-turn <jobId>
cursor-pilot capture <jobId> 220 --clean
```

## The QA Brief

Build the prompt as a test contract. Name the destination, the exact surfaces to test, and the report schema.

```text
Goal: QA <feature/change> at <URL> with browser-harness.

Success means:
- <flow 1> reaches <expected state>
- <flow 2> handles <edge case>
- <visual/layout requirement> holds at <viewport>
- The report includes verdict, steps, evidence, failures, and reproduction notes

Stop when: The report covers every listed flow once and gives a final PASS or FAIL verdict.

Use browser-harness:
- Open a fresh tab with new_tab("<URL>")
- Verify visible state with screenshot(), page_info(), and focused DOM reads
- Click and type through the browser like a user
- Capture evidence after each meaningful action

Return this report:
RESULT: PASS | FAIL
TARGET:
COVERAGE:
EVIDENCE:
FAILURES:
REPRODUCTION:
RETEST NOTES:
```

## Browser-Harness Expectations

With `--browser-harness`, the Cursor agent receives:

- The local Cursor plugin at `~/.cursor/plugins/local/browser-harness`.
- The symlinked browser-harness skill from Codex's local skill directory.
- The symlinked AgentMail skill from Codex's local skill directory, for OTP, magic-link, sign-up, and mailbox polling E2E.
- The canonical browser-harness usage doc and helper reference.

Ask Cursor to use browser-harness for visible browser work, and to capture screenshots or page state whenever the report depends on UI evidence.
When auth testing needs email, ask Cursor to use AgentMail with the shared `codex-dev-magic-link@agentmail.to` inbox and plus-addressed variants from the AgentMail skill.

## QA Scope Examples

Smoke test a local app:

```bash
cursor-pilot start "Goal: QA the onboarding flow at http://localhost:3000 with browser-harness.

Success means:
- The landing screen loads without console-visible blocking errors
- The primary CTA opens onboarding
- Required fields show validation when submitted empty
- A valid test profile reaches the final confirmation screen

Stop when: You return one PASS or FAIL report with evidence for each step.

Return RESULT, TARGET, COVERAGE, EVIDENCE, FAILURES, REPRODUCTION, RETEST NOTES." \
  --dir /path/to/repo --browser-harness --force
```

Retest a fixed failure:

```bash
cursor-pilot send <jobId> "Retest the failed validation path. Use the same URL and browser-harness flow. Return PASS if the previous failure is gone, otherwise return FAIL with updated reproduction steps."
```

## Report Triage

Read Cursor's report, then choose the next action:

- Fix implementation bugs when the report includes a reproducible failure.
- Ask Cursor for one focused retest when evidence is incomplete.
- Record PASS when the report covers the brief and no failures remain.
- Broaden QA only when the change surface is larger than the original brief.
