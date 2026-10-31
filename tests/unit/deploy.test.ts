import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scripts } from "../../package.json";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "rhanthai-deploy-"));

  // Stub both executables: these tests must never upload or contact production.
  for (const [command, exitVariable] of [
    ["wrangler", "DEPLOY_TEST_UPLOAD_EXIT"],
    ["bun", "DEPLOY_TEST_SMOKE_EXIT"],
  ] as const) {
    writeFileSync(
      join(directory, command),
      `#!/bin/sh\nprintf '%s\\n' '${command}' "$@" >> "$DEPLOY_TEST_LOG"\nexit "\${${exitVariable}:-0}"\n`,
      { mode: 0o700 },
    );
  }
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function deploy(environment: Record<string, string> = {}) {
  const log = join(directory, "commands.log");
  const result = spawnSync("/bin/sh", ["-c", scripts.deploy], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      WORKERS_CI_COMMIT_SHA: "",
      DEPLOY_TEST_UPLOAD_EXIT: "0",
      DEPLOY_TEST_SMOKE_EXIT: "0",
      DEPLOY_TEST_LOG: log,
      ...environment,
    },
  });

  expect(result.error).toBeUndefined();

  return {
    status: result.status,
    commands: readFileSync(log, "utf8").trim().split("\n"),
  };
}

describe("Cloudflare deployment command", () => {
  it("deploys production and smoke-checks the exact Workers Builds revision", () => {
    const revision = "a".repeat(40);
    const result = deploy({ WORKERS_CI_COMMIT_SHA: revision });

    expect(result.status).toBe(0);
    expect(result.commands).toEqual([
      "wrangler",
      "deploy",
      "--env",
      "production",
      "--var",
      `APP_REVISION:${revision}`,
      "bun",
      "run",
      "smoke",
      "https://rhanthai.supakorn.me",
      revision,
    ]);
  });

  it("uses the same local revision for manual deployment and its smoke check", () => {
    const result = deploy();

    expect(result.status).toBe(0);
    expect(result.commands).toContain("APP_REVISION:local");
    expect(result.commands.at(-1)).toBe("local");
  });

  it("does not run smoke checks after a failed upload", () => {
    const result = deploy({ DEPLOY_TEST_UPLOAD_EXIT: "9" });

    expect(result.status).toBe(9);
    expect(result.commands).not.toContain("bun");
  });

  it("fails the deployment command when the smoke check fails", () => {
    expect(deploy({ DEPLOY_TEST_SMOKE_EXIT: "7" }).status).toBe(7);
  });
});
