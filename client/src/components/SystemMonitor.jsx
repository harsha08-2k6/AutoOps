import { useEffect, useMemo, useState } from "react";
import { fetchStats } from "../services/api";

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  const precision = size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[index]}`;
}

function SystemMonitor({ containerId, containerName, style }) {
  const [stats, setStats] = useState(null);
  const [lastReadAt, setLastReadAt] = useState(null);

  useEffect(() => {
    if (!containerId) {
      setStats(null);
      setLastReadAt(null);
      return undefined;
    }

    let active = true;
    const pullStats = async () => {
      try {
        const data = await fetchStats(containerId);
        if (active) {
          setStats(data);
          setLastReadAt(new Date());
        }
      } catch {
        // Keep the panel resilient when stats are unavailable.
      }
    };

    pullStats();
    const interval = setInterval(pullStats, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [containerId]);

  const memoryLabel = useMemo(() => {
    if (!stats) {
      return "--";
    }

    return `${formatBytes(stats.memoryUsage)} / ${formatBytes(stats.memoryLimit)}`;
  }, [stats]);

  const readLabel = useMemo(() => {
    if (!lastReadAt) {
      return "Idle";
    }

    return lastReadAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastReadAt]);

  const cpuValue = Math.min(stats?.cpuPercent || 0, 100);
  const memoryValue = Math.min(stats?.memoryPercent || 0, 100);

  return (
    <section className="panel monitor-panel" style={style}>
      <div className="panel-header">
        <div>
          <p className="panel-title">System Monitor</p>
          <p className="panel-subtitle">
            {containerName ? `Selected: ${containerName}` : "Select a container"}
          </p>
        </div>
        <span className="chip">{readLabel}</span>
      </div>

      <div className="monitor-grid">
        <div className="meter">
          <div className="meter-row">
            <span>CPU load</span>
            <span className="mono">{stats ? `${stats.cpuPercent}%` : "--"}</span>
          </div>
          <div className="meter-bar">
            <span style={{ width: `${cpuValue}%` }} />
          </div>
        </div>

        <div className="meter">
          <div className="meter-row">
            <span>Memory</span>
            <span className="mono">{stats ? `${stats.memoryPercent}%` : "--"}</span>
          </div>
          <div className="meter-bar">
            <span style={{ width: `${memoryValue}%` }} />
          </div>
        </div>

        <div className="monitor-meta">
          <span className="caption">Usage</span>
          <span className="mono">{memoryLabel}</span>
        </div>
      </div>
    </section>
  );
}

export default SystemMonitor;
