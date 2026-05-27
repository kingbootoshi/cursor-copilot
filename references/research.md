# Cursor Orchestrator - Research Mode

Delegate read-only codebase exploration and investigation to Cursor Composer 2.5 Fast. Cursor reads the code, traces the paths, and returns a grounded answer with file:line citations - no edits.

## Outcome

Goal: Get a concrete, evidence-backed answer about a codebase or topic without spending your own context reading every file.

Success means:
- Cursor explores read-only and never edits.
- Cursor answers the exact question with file paths and line references.
- The report is short, specific, and lets you make the next decision.

Stop when: Cursor returns an answer with citations that resolves the question.

## The Loop (research flags)

Research is read-only. Use `--ask` for direct Q&A or `--plan` for "investigate then propose an approach". No browser-harness. Add `--map` so Cursor orients fast when `docs/CODEBASE_MAP.md` exists.

```bash
cursor-orch start "<research brief>" --dir /path/to/repo --ask --map --force
cursor-orch await-turn <jobId>
cursor-orch capture <jobId> 220 --clean
```

Drill deeper in the same session:

```bash
cursor-orch send <jobId> "Now trace where <X> is consumed. List every call site with file:line."
cursor-orch await-turn <jobId>
cursor-orch capture <jobId> 220 --clean
```

## The Research Brief

```text
Goal: Investigate <question> in this repo. Read-only - do not edit any file.

Success means:
- <specific thing 1 to find/explain>
- <specific thing 2 to find/explain>
- Every claim is backed by a file path and line reference

Stop when: You have answered the question with citations.

Return this report:
ANSWER: <direct answer to the question>
EVIDENCE: <file:line references that prove each claim>
RELATED: <adjacent files / patterns worth knowing>
UNKNOWNS: <anything you could not determine and why>
OPEN QUESTIONS: <what to ask next>
```

## Research Scope Examples

Trace a data flow:

```bash
cursor-orch start "Goal: Explain how auth tokens flow from login to the API client in this repo. Read-only.

Success means:
- You identify where the token is created, stored, and attached to requests
- Each step cites file:line
- You note any refresh / expiry handling

Stop when: The full token lifecycle is documented with citations.

Return ANSWER, EVIDENCE, RELATED, UNKNOWNS, OPEN QUESTIONS." \
  --dir /path/to/repo --ask --map --force
```

Scope a change before implementing:

```bash
cursor-orch start "Goal: Find every place that would need to change to add a new 'archived' status to projects. Read-only, propose a plan.

Success means:
- You list each file and function that touches project status
- You flag DB schema, types, UI, and API surfaces
- You propose the smallest correct change set

Stop when: You return a scoped plan with citations.

Return ANSWER, EVIDENCE, RELATED, UNKNOWNS, OPEN QUESTIONS." \
  --dir /path/to/repo --plan --map --force
```

## Triage

- Hand the answer + citations to a Codex or Cursor implementation agent.
- Ask one focused follow-up when evidence is thin or a claim lacks a citation.
- Promote a `--plan` result straight into Implementation mode when the plan is sound.
