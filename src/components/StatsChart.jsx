import { useMemo } from "react";

export default function StatsChart({ series = [], height = 180, targetValue = null }) {
  const { points, min, max } = useMemo(() => {
    if (!Array.isArray(series) || !series.length) {
      return { points: "", min: 0, max: 1 };
    }
    const values = series.map((p) => p.value);
    if (Number.isFinite(targetValue)) {
      values.push(targetValue);
    }
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    const nextPoints = series
      .map((point, index) => {
        const x = (index / (series.length - 1 || 1)) * 100;
        const y = 100 - ((point.value - minValue) / range) * 100;
        return `${x},${y}`;
      })
      .join(" ");
    return { points: nextPoints, min: minValue, max: maxValue };
  }, [series, targetValue]);

  const targetY = useMemo(() => {
    if (!Number.isFinite(targetValue)) return null;
    const range = max - min || 1;
    return 100 - ((targetValue - min) / range) * 100;
  }, [targetValue, min, max]);

  return (
    <div className="chart-card" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        {targetY !== null && (
          <line
            x1="0"
            y1={targetY}
            x2="100"
            y2={targetY}
            stroke="var(--chart-target)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
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
