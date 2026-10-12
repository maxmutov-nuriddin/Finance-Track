import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from "recharts";
import { formatCompact } from "../lib/format";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border-2)",
      borderRadius: "10px",
      padding: "10px 12px",
      color: "var(--ink)",
      fontSize: "0.875rem",
      boxShadow: "var(--shadow-md)"
    }}>
      <div style={{ color: "var(--ink-muted)", margin: 0, fontSize: "0.8rem" }}>{label}</div>
      <div style={{ marginTop: "4px", fontWeight: "700", color: "var(--brand)" }}>{formatCompact(value)}</div>
    </div>
  );
}

export default function StatsChart({ series = [], height = 240 }) {
  const data = (series || []).map((item) => ({
    label: item.label || "",
    value: Number(item.value || 0)
  }));

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const threshold = maxValue * 0.5; // Values above 50% of max are "high"
  const highColor = "var(--brand)";
  const lowColor = "rgba(79, 110, 247, 0.35)";

  const safeHeight = Math.max(220, Number(height || 240));
  return (
    <div
      className="chart-card chart-card-clean"
      style={{ height: safeHeight, minHeight: safeHeight, minWidth: 0 }}
    >
      <ResponsiveContainer width="100%" height={safeHeight} minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 4 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            tickFormatter={formatCompact}
            axisLine={false}
            tickLine={false}
            width={50}
            domain={[0, maxValue * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--brand-dim)" }} />
          <Bar
            dataKey="value"
            radius={[12, 12, 12, 12]}
            maxBarSize={32}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.value > threshold ? highColor : lowColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
