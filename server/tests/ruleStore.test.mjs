import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, test } from "vitest";
import ruleStoreModule from "../services/ruleStore.js";

const { defaultRules, loadRules, saveRules } = ruleStoreModule;
const tempDirs = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoops-rules-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe("ruleStore", () => {
  test("returns defaults when file does not exist", async () => {
    const baseDir = await makeTempDir();
    const rules = await loadRules({ baseDir });
    expect(rules).toEqual(defaultRules);
  });

  test("saves and loads rules from disk", async () => {
    const baseDir = await makeTempDir();
    const value = {
      restartExitedEnabled: false,
      restartCooldownMs: 15000,
      alertEmails: ["ops@example.com"],
    };
    await saveRules(value, { baseDir });
    const loaded = await loadRules({ baseDir });
    expect(loaded).toEqual(value);
  });

  test("throws on invalid JSON content", async () => {
    const baseDir = await makeTempDir();
    const file = path.join(baseDir, "rules.json");
    await fs.writeFile(file, "{bad json", "utf-8");
    await expect(loadRules({ baseDir })).rejects.toThrow();
  });
});
