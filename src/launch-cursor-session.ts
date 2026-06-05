#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { loadLaunchSpec, markInteractiveJobExited, markJobExited, monitorInteractiveTurns, type LaunchSpec } from "./jobs.ts";
import { getJobExecutionMode } from "./jobs.ts";

const jobId = process.argv[2];
if (!jobId) process.exit(1);

try {
  const spec = loadLaunchSpec(jobId);
  const prompt = readFileSync(spec.promptFile, "utf8");
  if (getJobExecutionMode(spec) === "interactive") {
    await launchInteractive(spec, prompt);
  } else {
    await launchHeadless(spec, prompt);
  }
} catch (cause) {
  const errorMessage = cause instanceof Error ? cause.message : String(cause);
  console.error(`cursor-pilot launch failed: ${errorMessage}`);
  markJobExited(jobId, 1, errorMessage);
  process.exit(1);
}

async function launchHeadless(spec: LaunchSpec, prompt: string): Promise<void> {
  const proc = Bun.spawn([spec.agentPath, ...spec.args, prompt], {
    cwd: spec.cwd,
    env: { ...Bun.env },
    stdin: "inherit",
    stdout: "pipe",
    stderr: "pipe"
  });
  const [stdout, stderr] = await Promise.all([
    mirrorStream(proc.stdout, process.stdout),
    mirrorStream(proc.stderr, process.stderr)
  ]);
  const exitCode = await proc.exited;
  const rawOutput = `${stdout}${stderr}`;
  markJobExited(spec.jobId, exitCode, undefined, rawOutput);
  console.log(`\n\n[cursor-pilot: Session complete with exit code ${exitCode}. Closing in 5s.]`);
  await Bun.sleep(5000);
  process.exit(exitCode);
}

async function launchInteractive(spec: LaunchSpec, prompt: string): Promise<void> {
  const proc = Bun.spawn([spec.agentPath, ...spec.args, prompt], {
    cwd: spec.cwd,
    env: { ...Bun.env },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
  let exited = false;
  const monitor = monitorInteractiveTurns(spec.jobId, () => exited);
  const exitCode = await proc.exited;
  exited = true;
  await monitor;
  markInteractiveJobExited(spec.jobId, exitCode);
  console.log(`\n\n[cursor-pilot: Interactive session exited with code ${exitCode}.]`);
  await Bun.sleep(1000);
  process.exit(exitCode);
}

async function mirrorStream(
  stream: ReadableStream<Uint8Array> | null,
  target: NodeJS.WriteStream
): Promise<string> {
  if (!stream) return "";
  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    chunks.push(chunk);
    target.write(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
