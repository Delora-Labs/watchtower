"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  Globe,
} from "lucide-react";

// Dynamic imports for recharts to avoid SSR issues
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((mod) => mod.Line),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);
const AreaChart = dynamic(
  () => import("recharts").then((mod) => mod.AreaChart),
  { ssr: false }
);
const Area = dynamic(
  () => import("recharts").then((mod) => mod.Area),
  { ssr: false }
);

interface HealthCheck {
  id: string;
  name: string;
  url: string;
  method: string;
  expected_status: number;
  timeout_ms: number;
  interval_ms: number;
  enabled: boolean;
  created_at: string;
}

interface UptimeStats {
  period: string;
  total_checks: number;
  up_checks: number;
  down_checks: number;
  uptime_percent: number;
  avg_response_time_ms: number | null;
}

interface ChartDataPoint {
  time_bucket: string;
  avg_response_time: number;
  up_count: number;
  down_count: number;
  total_count: number;
}

interface Result {
  id: string;
  status: "up" | "down";
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: string;
}

export default function HealthCheckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
  const [uptimeStats, setUptimeStats] = useState<UptimeStats[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [days, setDays] = useState(7);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/health-checks/${id}/history?days=${days}`);
      const json = await res.json();
      
      if (json.error) {
        setError(json.error);
      } else {
        setHealthCheck(json.healthCheck);
        setUptimeStats(json.uptimeStats || []);
        setChartData(json.chartData || []);
        setResults(json.results || []);
        setError(null);
      }
    } catch {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [id, days]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getStats = (period: string) => {
    return uptimeStats.find((s) => s.period === period) || {
      uptime_percent: 0,
      avg_response_time_ms: null,
      total_checks: 0,
      up_checks: 0,
      down_checks: 0,
    };
  };

  if (loading && !healthCheck) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !healthCheck) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-blue-400 hover:underline mt-4 block"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const stats7d = getStats("7d");
  const stats30d = getStats("30d");
  const stats90d = getStats("90d");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{healthCheck?.name}</h1>
            <p className="text-xs text-gray-400 truncate flex items-center gap-2">
              <Globe className="w-3 h-3" />
              {healthCheck?.url}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Uptime Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { period: "7d", label: "Last 7 Days", stats: stats7d },
            { period: "30d", label: "Last 30 Days", stats: stats30d },
            { period: "90d", label: "Last 90 Days", stats: stats90d },
          ].map(({ period, label, stats }) => (
            <div
              key={period}
              className="rounded-xl bg-gray-900 border border-gray-800 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{label}</span>
                <Calendar className="w-4 h-4 text-gray-500" />
              </div>
              <div className="text-3xl font-bold mb-1">
                <span
                  className={
                    Number(stats.uptime_percent) >= 99.9
                      ? "text-green-400"
                      : Number(stats.uptime_percent) >= 99
                      ? "text-yellow-400"
                      : "text-red-400"
                  }
                >
                  {Number(stats.uptime_percent || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  {stats.up_checks} up
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-400" />
                  {stats.down_checks} down
                </span>
              </div>
              {stats.avg_response_time_ms && (
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Avg: {stats.avg_response_time_ms}ms
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Show:</span>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                days === d
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>

        {/* Response Time Chart */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold">Response Time</h2>
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time_bucket"
                    stroke="#6b7280"
                    fontSize={10}
                    tickFormatter={(v) => formatTime(v)}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={10}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(v) => `${formatDate(v)} ${formatTime(v)}`}
                    formatter={(value) => [`${value}ms`, "Avg Response"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_response_time"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorResponse)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-400" />
            <h2 className="font-bold">Status Timeline</h2>
          </div>
          <div className="h-20">
            {chartData.length > 0 ? (
              <div className="flex h-8 rounded overflow-hidden gap-0.5">
                {chartData.map((point, i) => {
                  const upPercent = point.total_count > 0 
                    ? (point.up_count / point.total_count) * 100 
                    : 100;
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${
                        upPercent === 100
                          ? "bg-green-500"
                          : upPercent >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      title={`${formatDate(point.time_bucket)} ${formatTime(point.time_bucket)}: ${upPercent.toFixed(0)}% up`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{chartData[0] && formatDate(chartData[0].time_bucket)}</span>
              <span>Now</span>
            </div>
          </div>
        </div>

        {/* Recent Checks Table */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <h2 className="font-bold">Recent Checks</h2>
            <span className="text-sm text-gray-400">({results.length})</span>
          </div>
          <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No checks recorded yet
              </div>
            ) : (
              results.slice(0, 50).map((result) => (
                <div
                  key={result.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-800/30"
                >
                  <div className="flex items-center gap-3">
                    {result.status === "up" ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <div className="text-sm">
                        {new Date(result.checked_at).toLocaleString()}
                      </div>
                      {result.error_message && (
                        <div className="text-xs text-red-400 truncate max-w-xs">
                          {result.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {result.status_code && (
                      <span
                        className={`px-2 py-0.5 rounded ${
                          result.status_code >= 200 && result.status_code < 300
                            ? "bg-green-900/50 text-green-400"
                            : result.status_code >= 400
                            ? "bg-red-900/50 text-red-400"
                            : "bg-yellow-900/50 text-yellow-400"
                        }`}
                      >
                        {result.status_code}
                      </span>
                    )}
                    {result.response_time_ms !== null && (
                      <span className="text-gray-400">
                        {result.response_time_ms}ms
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Health Check Config */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <h2 className="font-bold mb-4">Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Method</div>
              <div className="font-medium">{healthCheck?.method}</div>
            </div>
            <div>
              <div className="text-gray-400">Expected Status</div>
              <div className="font-medium">{healthCheck?.expected_status}</div>
            </div>
            <div>
              <div className="text-gray-400">Timeout</div>
              <div className="font-medium">{healthCheck?.timeout_ms}ms</div>
            </div>
            <div>
              <div className="text-gray-400">Check Interval</div>
              <div className="font-medium">
                {healthCheck?.interval_ms
                  ? healthCheck.interval_ms >= 3600000
                    ? `${healthCheck.interval_ms / 3600000}h`
                    : `${healthCheck.interval_ms / 60000}min`
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
