import { useEffect, useMemo, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { fetchStats } from "../services/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

function StatsChart({ containerId, containerName, style }) {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    if (!containerId) {
      const timer = setTimeout(() => setPoints([]), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const stats = await fetchStats(containerId);
        if (!cancelled) {
          setPoints((prev) => [
            ...prev.slice(-19),
            { cpu: stats.cpuPercent, memory: stats.memoryPercent },
          ]);
        }
      } catch {
        // Keep chart resilient while backend/docker starts up.
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [containerId]);

  const data = useMemo(
    () => ({
      labels: points.map((_, idx) => `T-${points.length - idx}`),
      datasets: [
        {
          label: "CPU %",
          data: points.map((point) => point.cpu),
          borderColor: "#63b7ff",
          backgroundColor: "rgba(99, 183, 255, 0.2)",
          tension: 0.35,
          fill: true,
          pointRadius: 0,
        },
        {
          label: "Memory %",
          data: points.map((point) => point.memory),
          borderColor: "#7ce0b1",
          backgroundColor: "rgba(124, 224, 177, 0.16)",
          tension: 0.35,
          fill: true,
          pointRadius: 0,
        },
      ],
    }),
    [points],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#b9c6dd", boxWidth: 10 },
        },
      },
      scales: {
        x: {
          ticks: { color: "#90a2c1" },
          grid: { color: "rgba(255, 255, 255, 0.05)" },
        },
        y: {
          ticks: { color: "#90a2c1" },
          grid: { color: "rgba(255, 255, 255, 0.05)" },
        },
      },
    }),
    [],
  );

  return (
    <section className="panel chart-panel" style={style}>
      <div className="panel-header">
        <div>
          <p className="panel-title">CPU and Memory</p>
          <p className="panel-subtitle">
            {containerName ? `Live for ${containerName}` : "Select a container"}
          </p>
        </div>
      </div>
      {!containerId ? (
        <p className="caption">Select a container to view stats.</p>
      ) : (
        <div className="chart-wrap">
          <Line data={data} options={options} />
        </div>
      )}
    </section>
  );
}

export default StatsChart;
