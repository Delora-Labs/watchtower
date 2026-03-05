"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

interface MetricPoint {
  time: string;
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryPercent: number;
  disk: number;
}

interface ChartProps {
  data: MetricPoint[];
  range: string;
}

interface TooltipPayloadItem {
  value: number;
  name: string;
  dataKey: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  suffix?: string;
}

// Custom tooltip component
function CustomTooltip({ 
  active, 
  payload, 
  label,
  suffix = "%",
}: CustomTooltipProps) {
  if (active && payload && payload.length && label) {
    const date = parseISO(label);
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-gray-400 text-xs mb-1">
          {format(date, "MMM d, HH:mm:ss")}
        </p>
        {payload.map((entry: TooltipPayloadItem, index: number) => (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}{suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

function MemoryTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length && label) {
    const date = parseISO(label);
    const used = payload.find((p: TooltipPayloadItem) => p.dataKey === 'memoryUsed')?.value;
    const total = payload.find((p: TooltipPayloadItem) => p.dataKey === 'memoryTotal')?.value;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-gray-400 text-xs mb-1">
          {format(date, "MMM d, HH:mm:ss")}
        </p>
        <p className="text-sm font-medium text-emerald-400">
          Used: {formatMemory(used || 0)}
        </p>
        <p className="text-sm font-medium text-emerald-700">
          Total: {formatMemory(total || 0)}
        </p>
        {used && total && (
          <p className="text-xs text-gray-400 mt-1">
            {((used / total) * 100).toFixed(1)}% utilized
          </p>
        )}
      </div>
    );
  }
  return null;
}

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

function formatTimeLabel(time: string, range: string): string {
  const date = parseISO(time);
  if (range === "7d") {
    return format(date, "MMM d");
  } else if (range === "24h") {
    return format(date, "HH:mm");
  }
  return format(date, "HH:mm");
}

export function CpuChart({ data, range }: ChartProps) {
  const tickFormatter = useMemo(() => {
    return (time: string) => formatTimeLabel(time, range);
  }, [range]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            tickFormatter={tickFormatter}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={[0, 100]}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="cpu"
            name="CPU"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MemoryChart({ data, range }: ChartProps) {
  const tickFormatter = useMemo(() => {
    return (time: string) => formatTimeLabel(time, range);
  }, [range]);

  const maxMemory = useMemo(() => {
    if (!data || data.length === 0) return 100;
    const totals = data.map(d => d.memoryTotal).filter(v => typeof v === 'number' && !isNaN(v));
    if (totals.length === 0) return 100;
    const max = Math.max(...totals);
    return max > 0 ? max * 1.1 : 100;
  }, [data]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            tickFormatter={tickFormatter}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={[0, maxMemory]}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatMemory(v)}
          />
          <Tooltip content={<MemoryTooltip />} />
          <Area
            type="monotone"
            dataKey="memoryTotal"
            name="Total"
            stroke="#065f46"
            fill="#065f46"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="memoryUsed"
            name="Used"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DiskChart({ data, range }: ChartProps) {
  const tickFormatter = useMemo(() => {
    return (time: string) => formatTimeLabel(time, range);
  }, [range]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            tickFormatter={tickFormatter}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={[0, 100]}
            stroke="#6b7280"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="disk"
            name="Disk"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.4}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Sparkline for stat cards
export function Sparkline({ 
  data, 
  dataKey, 
  color,
  height = 40 
}: { 
  data: MetricPoint[]; 
  dataKey: keyof MetricPoint; 
  color: string;
  height?: number;
}) {
  // Take last 20 points for sparkline
  const sparkData = data.slice(-20);
  
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sparkData}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
