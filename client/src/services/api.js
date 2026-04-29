const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

export function fetchServices() {
  return request("/api/services");
}

export function fetchLogs(containerId) {
  return request(`/api/logs/${containerId}`);
}

export function fetchStats(containerId) {
  return request(`/api/stats/${containerId}`);
}

export function fetchRules() {
  return request("/api/rules");
}

export function updateRules(payload) {
  return request("/api/rules", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
