import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import serverModule from "../server.js";

const { createApp } = serverModule;

function makeTestApp() {
  const dockerService = {
    listContainers: vi.fn().mockResolvedValue([]),
    getContainerLogs: vi.fn().mockResolvedValue("ok"),
    getContainerStats: vi.fn().mockResolvedValue({ cpuPercent: 12 }),
  };
  const saveRules = vi.fn().mockResolvedValue(undefined);
  const rulesConfig = {
    restartExitedEnabled: true,
    restartCooldownMs: 60000,
    alertEmails: [],
  };
  const { app } = createApp({ dockerService, saveRules, rulesConfig });
  return { app, dockerService, saveRules, rulesConfig };
}

describe("API validation", () => {
  test("rejects invalid cooldown in PUT /api/rules", async () => {
    const { app } = makeTestApp();
    const res = await request(app).put("/api/rules").send({ restartCooldownMs: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/restartCooldownMs/i);
  });

  test("accepts valid payload in PUT /api/rules", async () => {
    const { app, saveRules, rulesConfig } = makeTestApp();
    const res = await request(app)
      .put("/api/rules")
      .send({
        restartExitedEnabled: false,
        restartCooldownMs: 5000,
        alertEmails: ["ops@example.com"],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      restartExitedEnabled: false,
      restartCooldownMs: 5000,
      alertEmails: ["ops@example.com"],
    });
    expect(rulesConfig).toEqual({
      restartExitedEnabled: false,
      restartCooldownMs: 5000,
      alertEmails: ["ops@example.com"],
    });
    expect(saveRules).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid alertEmails in PUT /api/rules", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .put("/api/rules")
      .send({ alertEmails: ["bad"] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/alertEmails/i);
  });

  test("rejects invalid id in GET /api/logs/:id", async () => {
    const { app, dockerService } = makeTestApp();
    const res = await request(app).get("/api/logs/invalid-id");
    expect(res.status).toBe(400);
    expect(dockerService.getContainerLogs).not.toHaveBeenCalled();
  });

  test("rejects invalid id in GET /api/stats/:id", async () => {
    const { app, dockerService } = makeTestApp();
    const res = await request(app).get("/api/stats/invalid-id");
    expect(res.status).toBe(400);
    expect(dockerService.getContainerStats).not.toHaveBeenCalled();
  });
});
