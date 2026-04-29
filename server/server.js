require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const dockerService = require("./services/dockerService");
const { createSocketHandler } = require("./sockets/socketHandler");
const { loadRules, saveRules, defaultRules } = require("./services/ruleStore");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidContainerId(value) {
  return typeof value === "string" && /^[a-fA-F0-9]{12,64}$/.test(value);
}

function handleDockerError(res, error) {
  const code = error && error.code;
  if (code === "ENOENT" || code === "ECONNREFUSED") {
    return res.status(503).json({
      error:
        "Docker engine is not reachable. Start Docker Desktop (or set DOCKER_SOCKET_PATH) and retry.",
    });
  }
  return res.status(500).json({ error: error.message });
}

function parseEmailList(value) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;]/)
      : [];
  const trimmed = rawList.map((item) => String(item).trim()).filter(Boolean);
  const invalid = trimmed.filter((email) => !EMAIL_REGEX.test(email));
  return { trimmed, invalid };
}

function createApp(deps = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const dockerApi = deps.dockerService || dockerService;
  const persistRules = deps.saveRules || saveRules;
  const rulesConfig = deps.rulesConfig || { ...defaultRules };

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "autoops-server",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/services", async (_req, res) => {
    try {
      const containers = await dockerApi.listContainers();
      res.json(containers);
    } catch (error) {
      handleDockerError(res, error);
    }
  });

  app.get("/api/logs/:id", async (req, res) => {
    if (!isValidContainerId(req.params.id)) {
      return res.status(400).json({ error: "Invalid container id" });
    }

    try {
      const logs = await dockerApi.getContainerLogs(req.params.id);
      res.json({ logs });
    } catch (error) {
      handleDockerError(res, error);
    }
  });

  app.get("/api/stats/:id", async (req, res) => {
    if (!isValidContainerId(req.params.id)) {
      return res.status(400).json({ error: "Invalid container id" });
    }

    try {
      const stats = await dockerApi.getContainerStats(req.params.id);
      res.json(stats);
    } catch (error) {
      handleDockerError(res, error);
    }
  });

  app.get("/api/rules", (_req, res) => {
    res.json(rulesConfig);
  });

  app.put("/api/rules", (req, res) => {
    const { restartExitedEnabled, restartCooldownMs, alertEmailTo, alertEmails } =
      req.body || {};
    if (
      restartCooldownMs !== undefined &&
      (!Number.isFinite(Number(restartCooldownMs)) || Number(restartCooldownMs) < 1000)
    ) {
      return res
        .status(400)
        .json({ error: "restartCooldownMs must be a number >= 1000" });
    }

    const incomingEmailList = alertEmails !== undefined ? alertEmails : alertEmailTo;
    if (incomingEmailList !== undefined) {
      const { trimmed, invalid } = parseEmailList(incomingEmailList);
      if (invalid.length > 0) {
        return res
          .status(400)
          .json({ error: "alertEmails must contain valid emails" });
      }
      rulesConfig.alertEmails = trimmed;
    }

    if (typeof restartExitedEnabled === "boolean") {
      rulesConfig.restartExitedEnabled = restartExitedEnabled;
    }
    if (Number.isFinite(Number(restartCooldownMs))) {
      rulesConfig.restartCooldownMs = Number(restartCooldownMs);
    }
    persistRules(rulesConfig)
      .then(() => res.json(rulesConfig))
      .catch((error) => res.status(500).json({ error: error.message }));
  });

  return { app, rulesConfig };
}

async function startServer() {
  const { app, rulesConfig } = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  createSocketHandler(io, () => rulesConfig);

  server.on("error", (error) => {
    // eslint-disable-next-line no-console
    console.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  });

  const port = Number(process.env.PORT || 4000);
  const savedRules = await loadRules();
  rulesConfig.restartExitedEnabled = savedRules.restartExitedEnabled;
  rulesConfig.restartCooldownMs = savedRules.restartCooldownMs;
  rulesConfig.alertEmails = savedRules.alertEmails;

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`AutoOps server listening on port ${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load persisted rules:", error.message);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  isValidContainerId,
};
