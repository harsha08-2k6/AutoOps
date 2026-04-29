const dockerService = require("./dockerService");
const { sendContainerAlert } = require("./alertService");

function createRuleRunner(deps = {}) {
  const restart = deps.restartContainer || dockerService.restartContainer;
  const alert = deps.sendContainerAlert || sendContainerAlert;
  const nowFn = deps.now || Date.now;
  const restartCooldownByContainer = new Map();

  function shouldRestart(containerId, cooldownMs) {
    const now = nowFn();
    const lastRestartAt = restartCooldownByContainer.get(containerId) || 0;
    if (now - lastRestartAt < cooldownMs) {
      return false;
    }
    restartCooldownByContainer.set(containerId, now);
    return true;
  }

  async function runRules(containers, rulesConfig = {}) {
    const actions = [];
    const restartExitedEnabled = rulesConfig.restartExitedEnabled !== false;
    const cooldownMs = Number(rulesConfig.restartCooldownMs || 60000);
    const alertEmails = Array.isArray(rulesConfig.alertEmails)
      ? rulesConfig.alertEmails
      : typeof rulesConfig.alertEmailTo === "string"
        ? [rulesConfig.alertEmailTo]
        : [];

    for (const container of containers) {
      const state = container.State || container.Status || "unknown";
      if (
        restartExitedEnabled &&
        state.toLowerCase().startsWith("exited") &&
        shouldRestart(container.Id, cooldownMs)
      ) {
        await restart(container.Id);
        actions.push({ type: "restart", containerId: container.Id });
        await alert({
          containerName: (container.Names && container.Names[0]) || container.Id,
          state: "exited",
          reason: "Auto restart executed",
          to: alertEmails,
        });
      }
    }

    return actions;
  }

  return {
    runRules,
    reset: () => restartCooldownByContainer.clear(),
  };
}

const defaultRunner = createRuleRunner();

module.exports = {
  runRules: defaultRunner.runRules,
  __resetForTests: defaultRunner.reset,
  createRuleRunner,
};
