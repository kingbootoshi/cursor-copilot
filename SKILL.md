---
name: cursor-copilot
description: Spawn and command Cursor Composer subagents through the local cursor-pilot tmux wrapper. Cursor Composer 2.5 Fast is a third subagent army alongside Codex and Opus - fast, cheap, good at bounded scoped work. Use when you want to delegate research (read-only exploration), implementation (scoped build/edit), or QA (browser-harness E2E testing) to Cursor while keeping your own context focused. On invocation pick a MODE - read references/research.md, references/implementation.md, or references/qa.md based on the task. When the user says "QA", "test", or "browser", load references/qa.md. When the user says "research", "explore", or "investigate", load references/research.md. When the user says "implement", "build", or "fix", load references/implementation.md.
triggers:
  - cursor-copilot
  - spawn cursor
  - use cursor
  - delegate to cursor
  - cursor agent
  - cursor subagent
  - cursor qa
  - cursor research
  - cursor implement
---

# Cursor Copilot

Cursor Composer 2.5 Fast is a subagent army you command through the `cursor-pilot` tmux wrapper. Spawn a job, drive its turns, read its output, bring back the result. Same base tech as codex-orchestrator and opus-agent-orchestrator - a different model with different strengths.

## The Command Structure

```
SAINT - The King / CEO
    |
    +-- CLAUDE / CODEX (Orchestrator) --- General / Commander
            |-- CURSOR subagent (research)
            |-- CURSOR subagent (implementation)
            +-- CURSOR subagent (QA / browser-harness)
```

You are the orchestrator. You decide which Cursor subagents to spawn, write their briefs, drive their turns, and synthesize their output. Cursor agents are fast specialists - they do bounded work well and return quickly. You keep the strategic context.

## When To Reach For Cursor

- **Fast, bounded, well-scoped work.** Composer 2.5 Fast is quick and cheap. Hand it a tight brief with a clear stopping condition.
- **Parallel offload.** Spin up a Cursor agent to QA or research while you keep building elsewhere.
- **Browser QA.** Cursor + browser-harness is the fastest path to real E2E verification (see QA mode). QA mode also exposes AgentMail for email OTP, magic-link, sign-up, and mailbox polling flows.
- **A second model's eyes.** Cursor sees code differently than Codex or Opus.

Keep deep, high-context implementation on Codex. Use Cursor for scoped sub-tasks with a sharp boundary.

## Pick A Mode

Every run is one of three modes. Read the matching reference file for the brief contract, the right CLI flags, and the output schema:

| Mode | Trigger words | Reference | Cursor mode flag | browser-harness |
|------|--------------|-----------|------------------|-----------------|
| **Research** | research, explore, investigate, find, map | `references/research.md` | `--ask` or `--plan` | off |
| **Implementation** | implement, build, fix, add, refactor | `references/implementation.md` | `agent` (default) | off |
| **QA** | QA, test, verify, browser, E2E | `references/qa.md` | `agent` | `--browser-harness` |

Default invoke with no mode = read this file, then infer the mode from the task and confirm, or ask which mode fits.

`--browser-harness` is a `cursor-pilot` wrapper flag, not a native Cursor Agent CLI flag. Use it on `cursor-pilot start` for QA / browser jobs so the wrapper injects the local browser-harness Cursor plugin, includes the browser-harness and AgentMail skill context, and passes the right underlying Cursor Agent options. `--force` is also supplied to `cursor-pilot`; the wrapper passes it through to Cursor Agent as force-allow for autonomous tool calls.

## The Core Loop

Every mode rides the same loop. The brief and flags differ; the mechanics are identical.

```bash
# 1. Start a live interactive job (mode-specific flags - see the reference file)
cursor-pilot start "<brief>" --dir /path/to/repo --force

# 2. Wait for the current interactive turn to finish
cursor-pilot await-turn <jobId>

# 3. Read the live pane / result
cursor-pilot capture <jobId> 220 --clean

# 4. Follow up / retest in the same session
cursor-pilot send <jobId> "<follow-up>"
cursor-pilot await-turn <jobId>
cursor-pilot capture <jobId> 220 --clean

# Scripted one-shot JSON mode remains available when needed
cursor-pilot start --headless "<brief>" --dir /path/to/repo --force
```

List and manage running work:

```bash
cursor-pilot jobs --json        # running and recent jobs
cursor-pilot status <jobId>     # one job's full state
cursor-pilot watch <jobId>      # live-tail output
cursor-pilot kill <jobId>       # stop a job
cursor-pilot clean              # archive old jobs, kill orphaned sessions
```

## Writing The Brief (universal rules)

Every brief is a contract. Name the destination, the boundary, and the stopping condition. Each mode reference gives a fill-in template.

```text
Goal: <one sentence - what this run produces>

Success means:
- <concrete checkable outcome 1>
- <concrete checkable outcome 2>

Stop when: <the exact condition that ends the run>

Return: <the report shape you want back>
```

Tight boundary + explicit stop condition = a fast agent that returns something you can act on. Vague brief = an agent that wanders.

## Modes, Flags, Sandbox

- `--force` / `--yolo` force-allows Cursor tool calls. Use it for autonomous runs.
- `--ask` = read-only Q&A. `--plan` = planning without edits. Default `agent` = full build.
- `--dir <path>` sets the working repo. Always set it.
- `--map` injects `docs/CODEBASE_MAP.md` when present - cheap orientation for research and implementation.
- `--browser-harness` is a Cursor Pilot wrapper flag that injects the browser-harness skill + plugin. The plugin also exposes AgentMail from Codex's local AgentMail skill for OTP and magic-link E2E. **Opt-in** - only QA mode needs it. When on, the wrapper auto-disables the Cursor sandbox (browser-harness needs localhost CDP).
- `--headless` uses the old `agent -p --output-format json` launch path for scripted callers. Without it, jobs are live interactive TUI sessions.
- Interactive jobs auto-accept Cursor's workspace trust prompt for unattended runs instead of hanging at the gate.
- `--dry-run` prints the launch summary and prompt preview without spawning. Use it to check token cost and the assembled prompt.

## Running From Codex / Claude

When you run `cursor-pilot` commands, run them as approved/escalated shell commands. Cursor Agent reads macOS Keychain auth, and browser-harness needs localhost CDP access. A sandboxed orchestrator command can make `agent status` fail with `SecItemCopyMatching` and can make browser-harness mis-detect Chrome.

## Health Check

Run this when Cursor, tmux, model access, or browser-harness setup is suspect:

```bash
cursor-pilot health
```

It verifies tmux, Cursor auth, the default model, and (for QA) browser-harness files, AgentMail skill availability, the Cursor plugin, and the `browser-harness` executable. If health reports a Keychain sandbox error, rerun it as an approved/escalated command before dispatching work.
