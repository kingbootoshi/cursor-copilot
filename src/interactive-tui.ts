import { cleanTerminalOutput } from "./output-cleaner.ts";

export const jobExecutionModes = ["interactive", "headless"] as const;
export type JobExecutionMode = (typeof jobExecutionModes)[number];

export type InteractivePaneTurnState = "working" | "idle" | "trust-required" | "unknown";

const addFollowUpPattern = /\u2192 Add a follow-up/;
const inputPromptPattern = /^\s*\u2192\s+/m;
const inputPromptGlobalPattern = /^\s*\u2192\s+/gm;
const workspaceTrustRequiredPattern = /Workspace Trust Required/i;
const trustWorkspaceOptionPattern = /\[[aA]\]\s+Trust this workspace/i;
const activeStopPattern = /ctrl\+c to stop/i;
const activeRunningPattern = /(?:^|\s)(?:Running|Working|Composing|Thinking)(?:\s|$)/m;
const activeStatusLinePattern = /^\s*[^A-Za-z0-9\s]{1,4}\s*(?:Running|Working|Composing|Thinking)\b/m;
const cursorAgentBannerPattern = /^\s*Cursor Agent\s*$/gm;
const resumePattern = /agent --resume[=\s]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function detectInteractivePaneTurnState(value: string): InteractivePaneTurnState {
  const clean = cleanTerminalOutput(value);
  if (activeStatusLinePattern.test(clean)) return "working";
  if (activeStopPattern.test(clean) && activeRunningPattern.test(clean)) return "working";
  if ((addFollowUpPattern.test(clean) || inputPromptPattern.test(clean)) && !activeStopPattern.test(clean)) return "idle";
  if (hasCurrentWorkspaceTrustGate(clean)) return "trust-required";
  return "unknown";
}

export function extractCursorResumeSessionId(value: string): string | undefined {
  return resumePattern.exec(cleanTerminalOutput(value))?.[1];
}

export function extractLastAgentMessageFromPane(value: string): string {
  const clean = cleanTerminalOutput(value).replace(/\r/g, "\n");
  const beforeInput = textBeforeLastInputPrompt(clean);
  const blocks = beforeInput
    .split(/\n\s*\n+/)
    .map((block) => normalizeBlock(block))
    .filter((block) => block.length > 0);

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index] ?? "";
    if (!isNonMessageBlock(block)) return block;
  }
  return "";
}

function textBeforeLastInputPrompt(value: string): string {
  const matches = [...value.matchAll(inputPromptGlobalPattern)];
  const last = matches.at(-1);
  return last?.index === undefined ? value : value.slice(0, last.index);
}

function hasCurrentWorkspaceTrustGate(value: string): boolean {
  const trustIndex = lastMatchIndex(value, workspaceTrustRequiredPattern);
  if (trustIndex === -1) return false;
  const afterTrust = value.slice(trustIndex);
  if (!trustWorkspaceOptionPattern.test(afterTrust)) return false;
  if (lastMatchIndex(value, cursorAgentBannerPattern) > trustIndex) return false;
  if (lastMatchIndex(value, inputPromptGlobalPattern) > trustIndex) return false;
  if (lastMatchIndex(value, activeStatusLinePattern) > trustIndex) return false;
  return true;
}

function lastMatchIndex(value: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  let last = -1;
  for (const match of value.matchAll(globalPattern)) {
    if (match.index !== undefined) last = match.index;
  }
  return last;
}

function normalizeBlock(block: string): string {
  return block
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function isNonMessageBlock(block: string): boolean {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return true;
  const first = lines[0] ?? "";
  if (first.startsWith("Cursor Agent")) return true;
  if (/^v\d{4}\./.test(first)) return true;
  if (first.startsWith("Use ")) return true;
  if (first.startsWith("Tip:")) return true;
  if (activeStatusLinePattern.test(block)) return true;
  if (first.startsWith("$ ")) return true;
  if (first.startsWith("To resume this session:")) return true;
  if (first.startsWith("Error: --trust")) return true;
  if (first.includes("Cannot use this model:")) return true;
  if (first.includes("Available models:")) return true;
  if (first.startsWith("Codex ") && first.includes("Auto-run")) return true;
  if (first.startsWith("~/") || first.startsWith("/Users/")) return true;
  if (first.includes("cursor-copilot git:")) return true;
  if (lines.every((line) => line.startsWith("agent ") || line.startsWith("Error:"))) return true;
  if (lines.some((line) => line.includes("ctrl+b twice to send to background"))) return true;
  return false;
}
