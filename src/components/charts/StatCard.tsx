"use client";

import { ReactNode } from "react";
import { Sparkline } from "./MetricsCharts";

interface MetricPoint {
  time: string;
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryPercent: number;
  disk: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon: ReactNode;
  color: "blue" | "green" | "yellow" | "red";
  sparklineData?: MetricPoint[];
  sparklineKey?: keyof MetricPoint;
}

const colorMap = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    spark: "#3b82f6",
  },
  green: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    spark: "#10b981",
  },
  yellow: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    spark: "#f59e0b",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    spark: "#ef4444",
  },
};

export function StatCard({
  title,
  value,
  unit,
  subtext,
  icon,
  color,
  sparklineData,
  sparklineKey,
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div className={`rounded-xl ${colors.bg} border ${colors.border} p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
          {icon}
        </div>
        {sparklineData && sparklineKey && sparklineData.length > 0 && (
          <div className="w-24 h-10">
            <Sparkline 
              data={sparklineData} 
              dataKey={sparklineKey} 
              color={colors.spark}
            />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-gray-400 text-sm">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${colors.text}`}>{value}</span>
          {unit && <span className="text-gray-500 text-lg">{unit}</span>}
        </div>
        {subtext && (
          <p className="text-gray-500 text-xs mt-1">{subtext}</p>
        )}
      </div>
    </div>
  );
}
