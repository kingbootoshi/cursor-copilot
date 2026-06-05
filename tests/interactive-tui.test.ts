import { describe, expect, test } from "bun:test";
import { buildAgentArgs } from "../src/jobs.ts";
import {
  detectInteractivePaneTurnState,
  extractCursorResumeSessionId,
  extractLastAgentMessageFromPane
} from "../src/interactive-tui.ts";

describe("interactive TUI pane parsing", () => {
  test("detects working and idle states from observed Cursor TUI markers", () => {
    const workingPane = `
  $ sleep 10; printf 'evidence-probe-complete\\n' 6.9s
    ctrl+b twice to send to background

 ⠘⠆ Running  47 tokens

  \u2192 Add a follow-up                                                                                                                             ctrl+c to stop
`;

    const idlePane = `
  $ sleep 10; printf 'evidence-probe-complete\\n' 12s
    evidence-probe-complete

  EVIDENCE_TURN_DONE



  \u2192 Add a follow-up


  Codex 5.3 Low Fast · MAX · 15.5%                                                                                                                    Auto-run
  ~/Dev/cursor-copilot · main
`;

    expect(detectInteractivePaneTurnState(workingPane)).toBe("working");
    expect(detectInteractivePaneTurnState(idlePane)).toBe("idle");
    expect(extractLastAgentMessageFromPane(idlePane)).toBe("EVIDENCE_TURN_DONE");
  });

  test("detects idle after a pasted follow-up redraw keeps the prompt text", () => {
    const followUpIdlePane = `
  DOGFOOD_TURN2 remembered_context_token=delta




  \u2192 Follow-up dogfood: what context_token did you just return? Answer
    exactly: DOGFOOD_TURN2 remembered_context_token=<value>. Do not modify
    files.


  Composer 2.5 Fast · MAX · 24%                                       Auto-run
  ~/Dev/cursor-copilot · main
`;

    expect(detectInteractivePaneTurnState(followUpIdlePane)).toBe("idle");
    expect(extractLastAgentMessageFromPane(followUpIdlePane)).toBe("DOGFOOD_TURN2 remembered_context_token=delta");
  });

  test("does not treat transient composing status as idle", () => {
    const composingPane = `
 \u2820\u281c Composing
    Tip: Use /plan to plan execution and reach the right outcome faster.

  \u2192 Follow-up dogfood: what context_token did you just return? Answer
    exactly: DOGFOOD_TURN2 remembered_context_token=<value>. Do not modify
    files.
`;

    expect(detectInteractivePaneTurnState(composingPane)).toBe("working");
  });

  test("does not treat transient thinking status as idle", () => {
    const thinkingPane = `
 \u2818\u2823 Thinking  12 tokens

  \u2192 Add a follow-up


  Ask (shift+tab to cycle)
  Composer 2.5 Fast · MAX · 13.1%                                     Auto-run
`;

    expect(detectInteractivePaneTurnState(thinkingPane)).toBe("working");
  });

  test("recognizes the workspace trust gate instead of unknown", () => {
    const trustPane = `
 \u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e
 \u2502  \u26a0 Workspace Trust Required              \u2502
 \u2502  Cursor Agent can execute code and access     \u2502
 \u2502  files in this directory.                     \u2502
 \u2502  Do you trust the contents of this directory?  \u2502
 \u2502    /var/folders/example/untrusted             \u2502
 \u2502  \u25b6 [a] Trust this workspace               \u2502
 \u2502    [q] Quit                                   \u2502
 \u2502  Use arrow keys to navigate, Enter to select,  \u2502
 \u2502  or press the key shown                       \u2502
 \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f
`;

    expect(detectInteractivePaneTurnState(trustPane)).toBe("trust-required");
  });

  test("prefers the current idle prompt over a trust gate in scrollback", () => {
    const pane = `
 \u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e
 \u2502  \u26a0 Workspace Trust Required              \u2502
 \u2502  \u25b6 [a] Trust this workspace              \u2502
 \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f

  Cursor Agent

  TRUST_DOGFOOD_TURN1 context_token=quokka


  \u2192 Add a follow-up


  Ask (shift+tab to cycle)
  Composer 2.5 Fast · MAX · 10.2%                                     Auto-run
`;

    expect(detectInteractivePaneTurnState(pane)).toBe("idle");
  });

  test("prefers the current thinking state over a trust gate in scrollback", () => {
    const pane = `
 \u256d\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e
 \u2502  \u26a0 Workspace Trust Required              \u2502
 \u2502  \u25b6 [a] Trust this workspace              \u2502
 \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f

  Cursor Agent
  v2026.06.04-5fd875e

 \u2818\u2823 Thinking  12 tokens

  \u2192 Add a follow-up
`;

    expect(detectInteractivePaneTurnState(pane)).toBe("working");
  });

  test("extracts the resume id printed on clean quit", () => {
    const pane = "To resume this session: agent --resume=b03426f2-c6ad-49e5-919d-25563b4e07be";
    expect(extractCursorResumeSessionId(pane)).toBe("b03426f2-c6ad-49e5-919d-25563b4e07be");
  });
});

describe("agent argument split", () => {
  test("keeps the old headless JSON launch shape", () => {
    expect(
      buildAgentArgs({
        model: "composer-2.5-fast",
        mode: "agent",
        sandbox: "enabled",
        executionMode: "headless",
        force: true,
        trust: true,
        approveMcps: true,
        pluginDirs: ["/plugin"],
        resumeSessionId: "session-1",
        cwd: "/repo"
      })
    ).toEqual([
      "-p",
      "--model",
      "composer-2.5-fast",
      "--output-format",
      "json",
      "--sandbox",
      "enabled",
      "--workspace",
      "/repo",
      "--resume",
      "session-1",
      "--force",
      "--trust",
      "--approve-mcps",
      "--plugin-dir",
      "/plugin"
    ]);
  });

  test("omits headless-only flags in interactive mode", () => {
    expect(
      buildAgentArgs({
        model: "gpt-5.3-codex-low-fast",
        mode: "ask",
        sandbox: "disabled",
        executionMode: "interactive",
        force: true,
        trust: true,
        approveMcps: true,
        pluginDirs: ["/plugin"],
        resumeSessionId: "session-1",
        cwd: "/repo"
      })
    ).toEqual([
      "--model",
      "gpt-5.3-codex-low-fast",
      "--sandbox",
      "disabled",
      "--workspace",
      "/repo",
      "--mode",
      "ask",
      "--resume",
      "session-1",
      "--force",
      "--approve-mcps",
      "--plugin-dir",
      "/plugin"
    ]);
  });
});
