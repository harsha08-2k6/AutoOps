import { useEffect, useMemo, useState } from "react";
import LogsViewer from "./components/LogsViewer";
import RuleBuilder from "./components/RuleBuilder";
import ServiceCard from "./components/ServiceCard";
import StatsChart from "./components/StatsChart";
import SystemMonitor from "./components/SystemMonitor";
import { fetchServices } from "./services/api";
import socket from "./socket";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "exited", label: "Exited" },
];

const QUICK_LINKS = [
  { label: "Docker Hub", url: "https://hub.docker.com", tag: "registry" },
  { label: "Docker Docs", url: "https://docs.docker.com", tag: "docs" },
  { label: "Grafana", url: "https://grafana.com", tag: "observability" },
  { label: "Prometheus", url: "https://prometheus.io", tag: "metrics" },
  { label: "Node.js", url: "https://nodejs.org", tag: "runtime" },
  { label: "GitHub", url: "https://github.com", tag: "code" },
];

const PIN_STORAGE_KEY = "autoops:pins";

function getContainerName(container) {
  return container.Names?.[0]?.replace("/", "") || container.Id.slice(0, 12);
}

function getContainerState(container) {
  const state = (container.State || "").toLowerCase();
  const status = (container.Status || "").toLowerCase();
  const isRunning = state === "running" || status.startsWith("up");
  const isExited = state.startsWith("exited") || status.startsWith("exited");
  return { isRunning, isExited };
}

function App() {
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [now, setNow] = useState(() => new Date());
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [pinnedIds, setPinnedIds] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(window.localStorage.getItem(PIN_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  useEffect(() => {
    fetchServices()
      .then((data) => {
        setContainers(data);
        setError("");
        setLastUpdatedAt(new Date());
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const onUpdate = (data) => {
      setContainers(data);
      setConnectionStatus("connected");
      setError("");
      setLastUpdatedAt(new Date());
    };
    const onError = (payload) => setError(payload.message || "Socket error");
    const onConnect = () => setConnectionStatus("connected");
    const onDisconnect = () => setConnectionStatus("disconnected");
    const onConnectError = () => setConnectionStatus("disconnected");

    socket.on("containers:update", onUpdate);
    socket.on("containers:error", onError);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    return () => {
      socket.off("containers:update", onUpdate);
      socket.off("containers:error", onError);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  const selectedId = selectedContainer?.Id;
  const containerTitle = useMemo(
    () => (selectedContainer ? getContainerName(selectedContainer) : ""),
    [selectedContainer],
  );

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(now),
    [now],
  );

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(now),
    [now],
  );

  const updateLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return "waiting";
    }

    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(lastUpdatedAt);
  }, [lastUpdatedAt]);

  const counts = useMemo(
    () =>
      containers.reduce(
        (acc, container) => {
          const { isRunning, isExited } = getContainerState(container);
          if (isRunning) {
            acc.running += 1;
          } else if (isExited) {
            acc.exited += 1;
          } else {
            acc.other += 1;
          }
          return acc;
        },
        { running: 0, exited: 0, other: 0 },
      ),
    [containers],
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredContainers = useMemo(
    () =>
      containers.filter((container) => {
        const name = getContainerName(container).toLowerCase();
        const image = (container.Image || "").toLowerCase();

        if (
          normalizedQuery &&
          !name.includes(normalizedQuery) &&
          !image.includes(normalizedQuery)
        ) {
          return false;
        }

        const { isRunning, isExited } = getContainerState(container);
        if (statusFilter === "running" && !isRunning) {
          return false;
        }
        if (statusFilter === "exited" && !isExited) {
          return false;
        }

        return true;
      }),
    [containers, normalizedQuery, statusFilter],
  );

  const sortedContainers = useMemo(() => {
    const list = [...filteredContainers];
    list.sort((left, right) => {
      const leftPinned = pinnedIds.includes(left.Id);
      const rightPinned = pinnedIds.includes(right.Id);
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }
      return getContainerName(left).localeCompare(getContainerName(right));
    });
    return list;
  }, [filteredContainers, pinnedIds]);

  const pinnedContainers = useMemo(
    () => containers.filter((container) => pinnedIds.includes(container.Id)),
    [containers, pinnedIds],
  );

  const togglePin = (containerId) => {
    setPinnedIds((prev) =>
      prev.includes(containerId)
        ? prev.filter((id) => id !== containerId)
        : [...prev, containerId],
    );
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="time-block">
          <div className={`status-chip ${connectionStatus}`}>
            <span className="status-indicator" />
            {connectionStatus}
          </div>
          <div className="clock">
            <span className="clock-time">{timeLabel}</span>
            <span className="clock-sub">Local time</span>
          </div>
        </div>
        <div className="brand-block">
          <p className="eyebrow">{dateLabel}</p>
          <h1>AutoOps</h1>
          <p className="sub">Live container telemetry, automation, and alerts.</p>
          {error && <div className="inline-alert">{error}</div>}
        </div>
      </header>

      <section className="dashboard">
        <aside className="sidebar">
          <section className="panel stats-panel" style={{ "--order": 1 }}>
            <div className="panel-header">
              <div>
                <p className="panel-title">Docker Stats</p>
                <p className="panel-subtitle">Updated {updateLabel}</p>
              </div>
              <span className="chip">{containers.length} total</span>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <p className="stat-label">Running</p>
                <p className="stat-value">{counts.running}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Exited</p>
                <p className="stat-value">{counts.exited}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Other</p>
                <p className="stat-value">{counts.other}</p>
              </div>
            </div>
          </section>

          <SystemMonitor
            containerId={selectedId}
            containerName={containerTitle}
            style={{ "--order": 2 }}
          />

          <section className="panel pinned-panel" style={{ "--order": 3 }}>
            <div className="panel-header">
              <div>
                <p className="panel-title">Pinned</p>
                <p className="panel-subtitle">Quick access list</p>
              </div>
              <span className="chip">{pinnedContainers.length}</span>
            </div>
            <div className="pinned-grid">
              {pinnedContainers.length === 0 ? (
                <p className="caption">Pin containers to keep them here.</p>
              ) : (
                pinnedContainers.map((container) => {
                  const { isRunning, isExited } = getContainerState(container);
                  const stateClass = isRunning ? "ok" : isExited ? "bad" : "warn";
                  return (
                    <button
                      type="button"
                      key={container.Id}
                      className="pinned-item"
                      onClick={() => setSelectedContainer(container)}
                    >
                      <span className={`state-dot ${stateClass}`} />
                      <span className="pinned-name">{getContainerName(container)}</span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </aside>

        <section className="content">
          <div className="panel search-panel" style={{ "--order": 1 }}>
            <div className="search-field">
              <label className="caption" htmlFor="container-search">
                Search containers
              </label>
              <input
                id="container-search"
                type="search"
                className="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or image"
              />
            </div>
            <div className="filter-group">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`filter-button ${
                    statusFilter === filter.key ? "active" : ""
                  }`}
                  onClick={() => setStatusFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <section className="panel apps-panel" style={{ "--order": 2 }}>
            <div className="panel-header">
              <div>
                <p className="panel-title">Applications</p>
                <p className="panel-subtitle">
                  {sortedContainers.length} shown of {containers.length}
                </p>
              </div>
              <span className="chip">Live</span>
            </div>
            <div className="app-grid">
              {isLoading && <p className="caption">Loading containers...</p>}
              {!isLoading && sortedContainers.length === 0 && (
                <p className="caption">No containers match this view.</p>
              )}
              {!isLoading &&
                sortedContainers.map((container, index) => (
                  <ServiceCard
                    key={container.Id}
                    container={container}
                    selected={selectedId === container.Id}
                    pinned={pinnedIds.includes(container.Id)}
                    onSelect={setSelectedContainer}
                    onTogglePin={togglePin}
                    style={{ "--order": index }}
                  />
                ))}
            </div>
          </section>

          <section className="panel links-panel" style={{ "--order": 3 }}>
            <div className="panel-header">
              <div>
                <p className="panel-title">Bookmarks</p>
                <p className="panel-subtitle">Launch common tools fast.</p>
              </div>
              <span className="chip">{QUICK_LINKS.length} links</span>
            </div>
            <div className="links-grid">
              {QUICK_LINKS.map((link) => (
                <a
                  key={link.url}
                  className="link-card"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="link-dot" aria-hidden="true" />
                  <span className="link-text">
                    <span className="link-title">{link.label}</span>
                    <span className="link-meta">{link.tag}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>

          <div className="grid-split">
            <StatsChart
              containerId={selectedId}
              containerName={containerTitle}
              style={{ "--order": 4 }}
            />
            <LogsViewer
              containerId={selectedId}
              containerName={containerTitle}
              style={{ "--order": 5 }}
            />
          </div>

          <RuleBuilder style={{ "--order": 6 }} />
        </section>
      </section>
    </main>
  );
}

export default App;
