import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflow = parse(await readFile(".github/workflows/ci.yml", "utf8"));
describe("deployment security boundaries", () => {
  it("runs checks on PRs and main pushes without secrets", () => {
    expect(workflow.on).toEqual({
      pull_request: null,
      push: { branches: ["main"] },
    });
    expect(workflow.permissions).toEqual({ contents: "read" });
    const quality = JSON.stringify(workflow.jobs.quality);
    expect(quality).not.toContain("secrets.");
    for (const command of [
      "bun install --frozen-lockfile",
      "bun run lint",
      "bun run typecheck",
      "bun run validate:data",
      "bun run validate:api",
      "bun run test",
      "bun audit --audit-level=high",
      "bun run build:production",
    ]) {
      expect(quality).toContain(command);
    }
  });
  it("only deploys checked main pushes using the production environment", () => {
    const deploy = workflow.jobs.deploy;
    expect(deploy.needs).toBe("quality");
    expect(deploy.if).toBe(
      "github.event_name == 'push' && github.ref == 'refs/heads/main'",
    );
    expect(deploy.environment).toBe("production");
    expect(deploy.concurrency["cancel-in-progress"]).toBe(false);
    const commands = deploy.steps
      .filter((step: { run?: string }) => step.run)
      .map((step: { run: string }) => step.run)
      .join("\n");
    expect(commands).toContain(
      'bun run deploy --message "$GITHUB_SHA" --var "APP_REVISION:$GITHUB_SHA"',
    );
    expect(commands).toContain(
      'bun run smoke https://rhanthai.supakorn.me "$GITHUB_SHA"',
    );
  });
  it("pins all Actions and does not bypass failing checks", () => {
    for (const job of Object.values(workflow.jobs) as {
      steps: { uses?: string; [key: string]: unknown }[];
    }[]) {
      for (const step of job.steps) {
        if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
        expect(step["continue-on-error"]).toBeUndefined();
      }
    }
    expect(workflow.on.pull_request_target).toBeUndefined();
  });
});
