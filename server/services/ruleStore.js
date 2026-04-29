const fs = require("fs/promises");
const path = require("path");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const defaultRules = {
  restartExitedEnabled: true,
  restartCooldownMs: 60000,
  alertEmails: [],
};

function normalizeEmailList(value) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;]/)
      : [];

  const unique = new Set();
  rawList.forEach((item) => {
    const trimmed = String(item).trim();
    if (trimmed && EMAIL_REGEX.test(trimmed)) {
      unique.add(trimmed);
    }
  });

  return Array.from(unique);
}

function resolveStorePaths(baseDir) {
  const dataDir = baseDir || path.join(__dirname, "..", "..", ".data");
  const rulesFile = path.join(dataDir, "rules.json");
  return { dataDir, rulesFile };
}

async function ensureDataDir(dataDir) {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadRules(options = {}) {
  const { dataDir, rulesFile } = resolveStorePaths(options.baseDir);
  try {
    await ensureDataDir(dataDir);
    const raw = await fs.readFile(rulesFile, "utf-8");
    const parsed = JSON.parse(raw);
    const alertEmails = normalizeEmailList(
      parsed.alertEmails !== undefined ? parsed.alertEmails : parsed.alertEmailTo,
    );
    return {
      restartExitedEnabled:
        typeof parsed.restartExitedEnabled === "boolean"
          ? parsed.restartExitedEnabled
          : defaultRules.restartExitedEnabled,
      restartCooldownMs: Number.isFinite(Number(parsed.restartCooldownMs))
        ? Number(parsed.restartCooldownMs)
        : defaultRules.restartCooldownMs,
      alertEmails,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { ...defaultRules };
    }
    throw error;
  }
}

async function saveRules(rules, options = {}) {
  const { dataDir, rulesFile } = resolveStorePaths(options.baseDir);
  await ensureDataDir(dataDir);
  await fs.writeFile(rulesFile, JSON.stringify(rules, null, 2), "utf-8");
}

module.exports = {
  loadRules,
  saveRules,
  defaultRules,
};
