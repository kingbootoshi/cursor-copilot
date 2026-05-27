<p align="center">
  <img src="assets/cursor-qa-header.jpeg" alt="Cursor Orchestrator header" width="100%">
</p>

# Cursor Orchestrator

`cursor-orchestrator` packages a skill and a tmux-backed Cursor Agent CLI for commanding Cursor Composer subagents. It's the same base tech as a Codex or Opus orchestrator - spawn a subagent, drive its turns, read its output - pointed at Cursor Composer 2.5 Fast.

One engine, three modes:

- **Research** - read-only codebase exploration, answers with file:line citations (`--ask` / `--plan`)
- **Implementation** - scoped build / edit work, verified, with a diff report (`agent`)
- **QA** - browser-harness E2E testing, returns a PASS/FAIL report with evidence (`--browser-harness`)

The skill loads the matching mode reference on demand, so a plain invoke stays lean and "QA" / "research" / "implement" pulls in just that mode's contract.

## Install

```bash
bun install
bun link
```

This exposes the orchestration CLI:

```bash
cursor-orch
```

## Requirements

- Bun
- tmux
- Cursor Agent CLI available as `agent`
- Cursor CLI authenticated with access to `composer-2.5-fast`
- `browser-harness` available on PATH (QA mode only)

## Quick Start

Pick a mode and write a bounded brief. When running from Codex/Claude, approve/escalate `cursor-orch` commands - Cursor needs Keychain access for auth, and browser-harness QA needs localhost CDP access.

```bash
# Research (read-only)
cursor-orch start "Goal: explain how auth tokens flow login -> API client. Read-only, cite file:line." \
  --dir . --ask --map --force

# Implementation (scoped build)
cursor-orch start "Goal: add a --json flag to the report command. Verify with jq. Don't touch other commands." \
  --dir . --map --force

# QA (browser-harness)
cursor-orch start "Goal: QA http://localhost:3000 with browser-harness. Return RESULT/COVERAGE/EVIDENCE/FAILURES." \
  --dir . --browser-harness --force

# Then, for any mode:
cursor-orch await-turn <jobId>
cursor-orch capture <jobId> 220 --clean
```

For browser-harness jobs, `cursor-orch` automatically runs Cursor Agent with `--sandbox disabled` unless you set `--sandbox` explicitly. This mirrors the browser-harness requirement: sandboxed tool calls can block localhost CDP and turn a healthy Chrome into a silent or misleading failure.

## Skill

The skill lives at:

```text
SKILL.md                       # general orchestration doctrine + mode router
references/research.md         # loaded on "research"
references/implementation.md   # loaded on "implement / build"
references/qa.md               # loaded on "QA / test / browser"
agents/openai.yaml
```

Install it into Codex by copying this repository folder to your skills directory, or copy `SKILL.md`, `references/`, and `agents/openai.yaml` into a `cursor-orchestrator` skill folder.

## Cursor Plugin Payload

The browser-harness Cursor plugin payload (QA mode) lives at:

```text
cursor-plugin/browser-harness/
```

The runtime wrapper defaults to the local Cursor plugin path:

```text
~/.cursor/plugins/local/browser-harness
```

Copy or symlink the plugin payload there if the local plugin is missing.
