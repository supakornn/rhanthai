import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflow = parse(await readFile(".github/workflows/ci.yml", "utf8"));
describe("GitHub CI security boundaries", () => {
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
  it("only runs quality checks and leaves deployment to Cloudflare", () => {
    expect(Object.keys(workflow.jobs)).toEqual(["quality"]);
    expect(JSON.stringify(workflow)).not.toMatch(
      /secrets\.|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|bun run deploy/,
    );
  });
  it("pins all Actions and does not bypass failing checks", () => {
    for (const job of Object.values(workflow.jobs) as {
      steps: { uses?: string; [key: string]: unknown }[];
    }[]) {
      for (const step of job.steps) {
        expect(step["continue-on-error"]).toBeUndefined();
      }
      for (const step of job.steps.filter((candidate) => candidate.uses)) {
        expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
      }
    }
    expect(workflow.on.pull_request_target).toBeUndefined();
  });
});
