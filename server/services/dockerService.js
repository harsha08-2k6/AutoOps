const Docker = require("dockerode");

function resolveDockerOptions() {
  if (process.env.DOCKER_SOCKET_PATH) {
    return { socketPath: process.env.DOCKER_SOCKET_PATH };
  }

  if (process.platform === "win32") {
    return { socketPath: "//./pipe/docker_engine" };
  }

  return { socketPath: "/var/run/docker.sock" };
}

const docker = new Docker(resolveDockerOptions());

async function listContainers() {
  return docker.listContainers({ all: true });
}

async function getContainerLogs(containerId, tail = 200) {
  const container = docker.getContainer(containerId);
  const stream = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });

  return stream.toString("utf-8");
}

async function getContainerStats(containerId) {
  const container = docker.getContainer(containerId);
  const stats = await container.stats({ stream: false });

  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const onlineCpus = stats.cpu_stats.online_cpus || 1;
  const cpuPercent =
    systemDelta > 0 ? ((cpuDelta / systemDelta) * onlineCpus * 100) : 0;

  const memoryUsage = stats.memory_stats.usage || 0;
  const memoryLimit = stats.memory_stats.limit || 0;
  const memoryPercent =
    memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

  return {
    cpuPercent: Number(cpuPercent.toFixed(2)),
    memoryUsage,
    memoryLimit,
    memoryPercent: Number(memoryPercent.toFixed(2)),
    read: stats.read,
  };
}

async function restartContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.start();
}

module.exports = {
  listContainers,
  getContainerLogs,
  getContainerStats,
  restartContainer,
};
