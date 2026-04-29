import { beforeEach, describe, expect, test, vi } from "vitest";
import ruleEngineModule from "../services/ruleEngine.js";

const { createRuleRunner } = ruleEngineModule;

describe("ruleEngine", () => {
  let restartContainer;
  let sendContainerAlert;
  let runner;

  beforeEach(() => {
    restartContainer = vi.fn().mockResolvedValue(undefined);
    sendContainerAlert = vi.fn().mockResolvedValue({ sent: true });
    runner = createRuleRunner({ restartContainer, sendContainerAlert, now: () => Date.now() });
  });

  test("restarts exited containers when enabled", async () => {
    const containers = [{ Id: "abc123def456", State: "exited", Names: ["/api"] }];
    const actions = await runner.runRules(containers, {
      restartExitedEnabled: true,
      restartCooldownMs: 60000,
      alertEmails: ["ops@example.com"],
    });

    expect(actions).toEqual([{ type: "restart", containerId: "abc123def456" }]);
    expect(restartContainer).toHaveBeenCalledWith("abc123def456");
    expect(sendContainerAlert).toHaveBeenCalledTimes(1);
    expect(sendContainerAlert).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["ops@example.com"] }),
    );
  });

  test("does not restart when rule is disabled", async () => {
    const actions = await runner.runRules(
      [{ Id: "abc123def456", State: "exited", Names: ["/api"] }],
      { restartExitedEnabled: false },
    );
    expect(actions).toEqual([]);
    expect(restartContainer).not.toHaveBeenCalled();
  });

  test("respects cooldown and avoids repeat restart", async () => {
    const container = { Id: "abc123def456", State: "exited", Names: ["/api"] };
    await runner.runRules([container], { restartExitedEnabled: true, restartCooldownMs: 60000 });
    const second = await runner.runRules([container], {
      restartExitedEnabled: true,
      restartCooldownMs: 60000,
    });

    expect(second).toEqual([]);
    expect(restartContainer).toHaveBeenCalledTimes(1);
  });
});
