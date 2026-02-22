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
      background: "rgba(24, 15, 37, 0.92)",
      border: "1px solid rgba(205, 126, 255, 0.35)",
      borderRadius: "8px",
      padding: "10px 12px",
      color: "#f7ecff",
      fontSize: "0.9rem",
      boxShadow: "0 8px 18px rgba(8, 3, 16, 0.45)"
    }}>
      <div style={{ color: "#c6addc", margin: 0, fontSize: "0.875rem" }}>{label}</div>
      <div style={{ marginTop: "4px", fontWeight: "700", color: "#ef49ff" }}>{formatCompact(value)}</div>
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
  const highColor = "rgba(239, 73, 255, 0.95)";
  const lowColor = "rgba(134, 92, 170, 0.45)";

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
            tick={{ fill: "#a0aec0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#a0aec0", fontSize: 11 }}
            tickFormatter={formatCompact}
            axisLine={false}
            tickLine={false}
            width={50}
            domain={[0, maxValue * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(75, 123, 255, 0.08)" }} />
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
