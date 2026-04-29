import { useEffect, useState } from "react";
import { fetchLogs } from "../services/api";

function LogsViewer({ containerId, containerName, style }) {
  const [logs, setLogs] = useState("");

  useEffect(() => {
    if (!containerId) {
      const timer = setTimeout(() => setLogs(""), 0);
      return () => clearTimeout(timer);
    }

    let mounted = true;
    setTimeout(() => {
      if (mounted) {
        setLogs("Loading logs...");
      }
    }, 0);
    fetchLogs(containerId)
      .then((data) => {
        if (mounted) {
          setLogs(data.logs || "");
        }
      })
      .catch(() => {
        if (mounted) {
          setLogs("Unable to fetch logs.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [containerId]);

  return (
    <section className="panel logs-panel" style={style}>
      <div className="panel-header">
        <div>
          <p className="panel-title">Logs</p>
          <p className="panel-subtitle">
            {containerName ? `Tail from ${containerName}` : "Select a container"}
          </p>
        </div>
      </div>
      <pre className="logs">{logs || "Select a container to load logs."}</pre>
    </section>
  );
}

export default LogsViewer;
