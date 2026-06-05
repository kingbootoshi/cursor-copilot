# PRD — cursor-pilot Interactive TUI Mode

## Outcome (what becomes true)

`cursor-pilot start "..."` defaults to launching a **live, interactive cursor-agent TUI** inside its tmux session. The pane shows Cursor working in real time — thinking, tool calls, browser-harness steps — exactly like running `agent` by hand at a terminal. The operator (a human attached, or a supervising agent via `capture`/`send`) can inject follow-up prompts **mid-session into the same living process**, and Cursor responds in the same session with full prior context. No pane goes blank. No relaunch-per-turn.

The current headless behavior (`agent -p --output-format json`, one-shot process that exits per turn and emits a single JSON result) is preserved **verbatim** behind a new `--headless` flag.

This fixes the concrete complaint: today the QA pane is blank because the wrapper runs cursor-agent in headless `-p --output-format json` mode (`src/jobs.ts:buildAgentArgs`, line ~275), which renders nothing until the turn ends. We are switching the default to the interactive TUI cursor-agent natively supports, and keeping headless as an explicit opt-in.

## Probe first (do this before writing implementation code)

The hardest part — detecting when an interactive turn is done — depends on what the real TUI renders. The current design equates "turn complete" with "process exited" (`markJobExited` in `src/jobs.ts`). An interactive TUI never exits between turns; it returns to an idle input prompt. So you must build turn-detection against the **observed** TUI, not assumptions.

Auth note: build and probe on THIS local machine, where the macOS keychain is unlocked in the GUI session and `agent` is authenticated (`agent status` → logged in as logged in). Do NOT try to solve SSH/mini keychain here — out of scope.

Open a scratch tmux session and drive a real interactive `agent` by hand (via `tmux send-keys` + `tmux capture-pane`). Document in your ledger, with captured pane evidence:

1. **Initial prompt delivery.** Does `agent "<prompt>"` (positional, no `-p`) run the prompt then stay interactive? Or must you launch `agent` empty and `send-keys` the first prompt? Pick whatever the real binary does. Test the same flags the wrapper passes: `--model`, `--sandbox`, `--workspace`, `--mode`, `--force`, `--trust`, `--approve-mcps`, `--plugin-dir`, `--resume`.
2. **Idle vs working markers.** Capture the pane while a turn is in progress and again once it finishes and the TUI is ready for input. Identify a ROBUST signal for the working→idle transition (input box redraw, spinner/"esc to interrupt" appearing/disappearing, a status line, cursor prompt glyph). This signal is the heart of the new turn detector.
3. **send-keys behavior.** Confirm typing a follow-up via `tmux load-buffer`/`paste-buffer`/`send-keys Enter` (the existing `src/tmux.ts:sendMessage`) submits a prompt to the live TUI and the agent answers in the same session with prior context intact.
4. **Session id + result surfacing.** Where does the interactive TUI expose the cursor session id (for persistence/recovery)? How is the agent's final message rendered (for `await-turn` / `lastAgentMessage` extraction from cleaned pane text)?
5. **Exit/quit.** How the TUI quits cleanly (Ctrl-C, `/quit`, etc.) so `kill` and idle-timeout still work.

Write findings to your goal ledger before implementing. If the probe reveals the interactive model can't support a finishing criterion as written, name the conflict and propose the closest real alternative — do not silently redefine it.

## Finishing criteria (binary, each must be demonstrated)

1. `cursor-pilot start "<prompt>"` with no mode flag launches a LIVE interactive `agent` TUI in tmux. `cursor-pilot attach <id>` (or `tmux attach`) shows Cursor actively working in real time — not blank, not a single end-of-turn dump.
2. `cursor-pilot capture <id>` (and `watch <id>`) shows the live, incrementally-updating TUI while a turn is in progress.
3. `cursor-pilot await-turn <id>` returns correctly when the interactive turn completes (TUI returns to idle), reporting the agent's last message. Works programmatically (a supervising agent can poll it).
4. `cursor-pilot send <id> "follow up"` types into the SAME live session — no relaunch, process stays alive — and Cursor responds in-session with prior context. Verified by continuity (it remembers turn 1 when answering turn 2). Allowed when the turn is idle; if a turn is in progress, define and document the behavior (reject with a clear message, or queue — your call, state it).
5. `cursor-pilot start --headless "<prompt>"` reproduces the EXACT current behavior: `agent -p --output-format json`, process exits per turn, JSON result parsed into `result`/`usage`/`cursorSessionId`, `send` = resume-relaunch. This path must remain byte-for-byte equivalent to today for scripted callers.
6. All existing flags work in BOTH modes: `--model`, `--mode`/`--plan`/`--ask`, `--sandbox`, `--force`/`--yolo`, `--no-trust`, `--approve-mcps`, `--browser-harness`/`--no-browser-harness`, `--plugin-dir`, `-d/--dir`, `--map`, `--wait`, `--dry-run`, `--json`.
7. `cursor-pilot health` passes; typecheck is clean (`bun run check` → `tsc --noEmit`); tests pass (`bun test`).
8. `cursor-pilot --help` and the `HELP` text document interactive as default and `--headless` as the opt-in, with accurate `send`/`await-turn`/`capture` descriptions for interactive mode.
9. **Dogfood proof:** you ran a real interactive job end-to-end — start → watched the live pane → sent a mid-session follow-up that the agent answered with retained context → await-turn returned the result — and pasted the captured pane evidence into your report. A browser-harness QA job is the ideal dogfood since that was the original blank-pane complaint.

## Mechanism guidance (build around the probe, not against it)

- **Launch path split.** Introduce an `interactive` (default) vs `headless` job dimension. Persist it on the `Job` (e.g. `mode`/`interactive` field) so `send`, `await-turn`, status, and recovery know which mechanism to use. Keep job-JSON back-compatible — old jobs without the field default sensibly.
- **Interactive launcher.** In `src/launch-cursor-session.ts` (or a sibling), spawn `agent` WITHOUT `-p` so it renders the live TUI in the tmux pty. It must NOT exit after one turn — it stays alive until quit/kill/idle-timeout. Deliver the initial prompt by whatever the probe proved works.
- **`buildAgentArgs`** (`src/jobs.ts`): branch on mode. Headless keeps `-p --output-format json`. Interactive drops `-p`/`--output-format` and keeps the rest of the relevant flags.
- **Turn detector.** Replace process-exit-as-turn-complete (for interactive) with a poller that watches `capturePane` for the working→idle transition discovered in the probe, then flips `turnState` and writes the turn-complete signal via `src/watcher.ts` (reuse `writeSignalFile`/the existing `TurnEvent` so `await-turn` keeps working). Extract `lastAgentMessage` from the cleaned pane (`src/output-cleaner.ts`). Headless mode keeps the existing `markJobExited` path untouched.
- **`send`** (`src/jobs.ts:sendToJob` + `src/cli.ts:sendCommand`): interactive → use `src/tmux.ts:sendMessage` (send-keys) into the live session; do NOT relaunch. Headless → keep the resume-relaunch path exactly as-is.
- **Reuse what's already there.** `src/tmux.ts:sendMessage` (load-buffer/paste-buffer/Enter) already exists for typing into a live pane — it's currently unused. `turnState: "working" | "idle"` already exists on `Job`. The latent infra is half-built for this.

## Constraints / protected paths

- Do NOT change `homeDir` (`~/.cursor-agent-orchestrator`) or the jobs-dir storage layout in a breaking way. Preserve job-JSON back-compat.
- Keep all existing CLI command + flag names stable. `--headless` is additive; interactive becomes the default behavior of `start`.
- Do NOT touch auth/keychain/preflight logic except where interactive mode legitimately needs a different preflight (e.g. it still needs `agent` authenticated — keep `checkCursorAgent`).
- Bun + TypeScript. Match existing code style (no new deps unless justified in the ledger).
- Never use `rm`; use `trash` for any file removal.
- Keep the headless path a true equivalent of today so the codex-on-mini scripted-agent use case (clean JSON, await-turn, send) does not regress.

## Out of scope

- The SSH/mini keychain 24/7 unlock problem (separate effort, deferred by Saint).
- Any further renaming, GitHub release, or publishing.
- Rewriting browser-harness or preflight beyond what interactive mode requires.

## Validation checklist (gate the finish on evidence)

- [ ] Probe findings written to the ledger with pane evidence.
- [ ] Interactive default: live pane proven via capture (paste it).
- [ ] Mid-session `send` proven to retain context (paste turn-2 answer referencing turn-1).
- [ ] `await-turn` returns on real idle transition.
- [ ] `--headless` proven byte-equivalent to old behavior (JSON result parsed).
- [ ] All flags exercised in at least one mode each.
- [ ] `health` passes, typecheck/build clean.
- [ ] HELP/docs updated.
- [ ] One full interactive browser-harness QA dogfood run, evidence pasted.
