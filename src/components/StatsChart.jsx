import { useMemo } from "react";

export default function StatsChart({ series = [], height = 180 }) {
  const points = useMemo(() => {
    if (!Array.isArray(series) || !series.length) return "";
    const max = Math.max(...series.map((p) => p.value), 1);
    const min = Math.min(...series.map((p) => p.value), 0);
    const range = max - min || 1;
    return series
      .map((point, index) => {
        const x = (index / (series.length - 1 || 1)) * 100;
        const y = 100 - ((point.value - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [series]);

  return (
    <div className="chart-card" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="2.5"
          points={points}
        />
      </svg>
    </div>
  );
}
