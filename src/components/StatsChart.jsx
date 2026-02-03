import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

function formatCompact(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) {
    const v = Math.round((value / 1_000_000) * 10) / 10;
    return `${v}m`;
  }
  if (value >= 1_000) {
    const v = Math.round(value / 1_000);
    return `${v}k`;
  }
  return `${Math.round(value)}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="chart-tooltip-light">
      <div className="chart-tooltip-title">{label}</div>
      <div className="chart-tooltip-value">{formatCompact(value)}</div>
    </div>
  );
}

export default function StatsChart({ series = [], height = 240 }) {
  const data = (series || []).map((item) => ({
    label: item.label || "",
    value: Number(item.value || 0)
  }));

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const safeHeight = Math.max(220, Number(height || 240));
  return (
    <div
      className="chart-card chart-card-clean"
      style={{ height: safeHeight, minHeight: safeHeight, minWidth: 0 }}
    >
      <ResponsiveContainer width="100%" height={safeHeight} minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-bar)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--chart-bar)" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--chart-label)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--chart-label)", fontSize: 12 }}
            tickFormatter={formatCompact}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={[0, maxValue * 1.05]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(47, 107, 255, 0.08)" }} />
          <Bar
            dataKey="value"
            fill="url(#barGradient)"
            radius={[8, 8, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
