const dockerService = require("../services/dockerService");
const { runRules } = require("../services/ruleEngine");

function createSocketHandler(io, getRulesConfig) {
  let isTickRunning = false;

  async function tick() {
    if (isTickRunning) {
      return;
    }
    isTickRunning = true;

    try {
      const containers = await dockerService.listContainers();
      await runRules(containers, getRulesConfig());
      io.emit("containers:update", containers);
    } catch (error) {
      io.emit("containers:error", { message: error.message });
    } finally {
      isTickRunning = false;
    }
  }

  const interval = setInterval(tick, 3000);
  tick();

  io.on("connection", (socket) => {
    socket.emit("server:ready", { ok: true });
  });

  return () => clearInterval(interval);
}

module.exports = {
  createSocketHandler,
};
