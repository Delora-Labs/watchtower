"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Server,
  RefreshCw,
  ArrowLeft,
  Cpu,
  HardDrive,
  Database,
  Activity,
  ChevronDown,
} from "lucide-react";

// Dynamic imports for recharts components to avoid SSR issues
const CpuChart = dynamic(
  () => import("@/components/charts/MetricsCharts").then((mod) => mod.CpuChart),
  { ssr: false, loading: () => <div className="h-64 bg-gray-800/50 rounded animate-pulse" /> }
);
const MemoryChart = dynamic(
  () => import("@/components/charts/MetricsCharts").then((mod) => mod.MemoryChart),
  { ssr: false, loading: () => <div className="h-64 bg-gray-800/50 rounded animate-pulse" /> }
);
const DiskChart = dynamic(
  () => import("@/components/charts/MetricsCharts").then((mod) => mod.DiskChart),
  { ssr: false, loading: () => <div className="h-64 bg-gray-800/50 rounded animate-pulse" /> }
);
const StatCard = dynamic(
  () => import("@/components/charts/StatCard").then((mod) => mod.StatCard),
  { ssr: false, loading: () => <div className="h-32 bg-gray-800/50 rounded animate-pulse" /> }
);
import { formatDistanceToNow } from "date-fns";

interface ServerInfo {
  id: string;
  name: string;
  hostname: string;
  os: string;
  ip_address: string;
  last_heartbeat: string;
}

interface MetricPoint {
  time: string;
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryPercent: number;
  disk: number;
}

interface MetricsData {
  metrics: MetricPoint[];
  current: {
    cpu: number;
    memoryUsed: number;
    memoryTotal: number;
    memoryPercent: number;
    disk: number;
    recordedAt: string;
  } | null;
  summary: {
    avg_cpu: number;
    max_cpu: number;
    avg_memory: number;
    max_memory: number;
    avg_disk: number;
    max_disk: number;
  } | null;
  range: string;
  count: number;
}

interface AppStats {
  pm2_name: string;
  display_name: string | null;
  cpu_percent: number;
  memory_mb: number;
  avg_cpu_5min: number;
  avg_memory_5min: number;
  status: string;
}

const timeRanges = [
  { value: "1h", label: "1H", fullLabel: "Last 1 Hour" },
  { value: "6h", label: "6H", fullLabel: "Last 6 Hours" },
  { value: "24h", label: "24H", fullLabel: "Last 24 Hours" },
  { value: "7d", label: "7D", fullLabel: "Last 7 Days" },
];

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}`;
  }
  return `${Math.round(mb)}`;
}

function getMemoryUnit(mb: number): string {
  return mb >= 1024 ? "GB" : "MB";
}

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [range, setRange] = useState("1h");
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [appStats, setAppStats] = useState<AppStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showServerDropdown, setShowServerDropdown] = useState(false);

  // Reduce data points on mobile for performance
  const displayMetrics = useMemo(() => {
    if (!metricsData?.metrics) return null;
    if (!isMobile || metricsData.metrics.length <= 50) return metricsData;
    
    // Sample every Nth point on mobile to reduce to ~50 points
    const step = Math.ceil(metricsData.metrics.length / 50);
    const sampledMetrics = metricsData.metrics.filter((_, i) => i % step === 0);
    
    return {
      ...metricsData,
      metrics: sampledMetrics,
    };
  }, [metricsData, isMobile]);

  // Fetch servers list
  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/servers");
      const json = await res.json();
      if (json.data) {
        setServers(json.data);
        // Set initial server from URL or first server
        const urlServerId = searchParams.get("server");
        if (urlServerId && json.data.find((s: ServerInfo) => s.id === urlServerId)) {
          setSelectedServer(urlServerId);
        } else if (json.data.length > 0 && !selectedServer) {
          setSelectedServer(json.data[0].id);
        }
      }
    } catch {
      setError("Failed to fetch servers");
    }
  }, [searchParams, selectedServer]);

  // Fetch metrics for selected server
  const fetchMetrics = useCallback(async () => {
    if (!selectedServer) return;
    
    try {
      setLoading(true);
      const res = await fetch(`/api/servers/${selectedServer}/metrics?range=${range}`);
      const json = await res.json();
      if (json.data) {
        setMetricsData(json.data);
        setError(null);
      } else if (json.error) {
        setError(json.error);
      }
    } catch {
      setError("Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  }, [selectedServer, range]);

  // Fetch app stats
  const fetchAppStats = useCallback(async () => {
    if (!selectedServer) return;
    
    try {
      const res = await fetch("/api/servers");
      const json = await res.json();
      if (json.data) {
        const server = json.data.find((s: { id: string; apps: AppStats[] }) => s.id === selectedServer);
        if (server) {
          setAppStats(server.apps || []);
        }
      }
    } catch {
      // Silently fail for app stats
    }
  }, [selectedServer]);

  // Initial load
  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Load metrics when server or range changes
  useEffect(() => {
    fetchMetrics();
    fetchAppStats();
  }, [fetchMetrics, fetchAppStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetrics();
      fetchAppStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics, fetchAppStats]);

  // Update URL when server changes
  useEffect(() => {
    if (selectedServer) {
      router.replace(`/analytics?server=${selectedServer}`, { scroll: false });
    }
  }, [selectedServer, router]);

  const currentServer = servers.find(s => s.id === selectedServer);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Top row: Title and refresh */}
          <div className="flex items-center justify-between mb-3 sm:mb-0">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/"
                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-800 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold">Analytics</h1>
                  <p className="text-xs text-gray-400 hidden sm:block">Server Metrics</p>
                </div>
              </div>
            </div>
            
            {/* Desktop controls */}
            <div className="hidden md:flex items-center gap-3">
              {/* Server Selector */}
              <div className="relative z-30">
                <button
                  onClick={() => setShowServerDropdown(!showServerDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition min-w-[200px]"
                >
                  <Server className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-left truncate">
                    {currentServer?.name || "Select Server"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                
                {showServerDropdown && (
                  <div className="absolute top-full mt-2 right-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-20">
                    {servers.map((server) => (
                      <button
                        key={server.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedServer(server.id);
                          setShowServerDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition flex items-center gap-3 ${
                          server.id === selectedServer ? "bg-gray-700" : ""
                        }`}
                      >
                        <Server className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{server.name}</div>
                          <div className="text-xs text-gray-400">
                            {server.hostname || server.ip_address}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Range Selector */}
              <div className="flex rounded-lg bg-gray-800 overflow-hidden">
                {timeRanges.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={`px-3 py-2 text-sm transition ${
                      range === r.value
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {r.value}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  fetchMetrics();
                  fetchAppStats();
                }}
                disabled={loading}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Mobile refresh button */}
            <button
              onClick={() => {
                fetchMetrics();
                fetchAppStats();
              }}
              disabled={loading}
              className="md:hidden p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Mobile controls row */}
          <div className="md:hidden flex flex-col gap-2">
            {/* Server Selector - Full width on mobile */}
            <div className="relative z-30">
              <button
                onClick={() => setShowServerDropdown(!showServerDropdown)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition w-full"
              >
                <Server className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-left truncate text-sm">
                  {currentServer?.name || "Select Server"}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showServerDropdown ? "rotate-180" : ""}`} />
              </button>
              
              {showServerDropdown && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-20 max-h-64 overflow-y-auto">
                  {servers.map((server) => (
                    <button
                      key={server.id}
                      onClick={(e) => {
                          e.stopPropagation();
                          setSelectedServer(server.id);
                          setShowServerDropdown(false);
                        }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-700 active:bg-gray-600 transition flex items-center gap-3 ${
                        server.id === selectedServer ? "bg-gray-700" : ""
                      }`}
                    >
                      <Server className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{server.name}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {server.hostname || server.ip_address}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time Range Selector - Horizontal scroll on mobile */}
            <div className="overflow-x-auto -mx-3 px-3 scrollbar-hide">
              <div className="flex rounded-lg bg-gray-800 overflow-hidden w-fit min-w-full">
                {timeRanges.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={`flex-1 min-w-[60px] px-3 py-2 text-sm font-medium transition whitespace-nowrap touch-manipulation ${
                      range === r.value
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white active:bg-gray-700"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {error && (
          <div className="mb-4 p-3 sm:p-4 rounded-lg bg-red-900/50 border border-red-700 text-sm">
            {error}
          </div>
        )}

        {!selectedServer ? (
          <div className="text-center py-12 sm:py-20">
            <Server className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-lg sm:text-xl font-bold mb-2">No Server Selected</h2>
            <p className="text-gray-400 text-sm">Select a server to view analytics</p>
          </div>
        ) : loading && !metricsData ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : !displayMetrics || displayMetrics.metrics.length === 0 ? (
          <div className="text-center py-12 sm:py-20">
            <Activity className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-lg sm:text-xl font-bold mb-2">No Metrics Data</h2>
            <p className="text-gray-400 text-sm">Waiting for metrics from the server agent</p>
          </div>
        ) : (
          <>
            {/* Stats Cards - Stack on mobile */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <StatCard
                title="CPU Usage"
                value={metricsData?.current?.cpu ?? 0}
                unit="%"
                subtext={`Avg: ${metricsData?.summary?.avg_cpu?.toFixed(1) ?? 0}% • Max: ${metricsData?.summary?.max_cpu?.toFixed(1) ?? 0}%`}
                icon={<Cpu className="w-4 h-4 sm:w-5 sm:h-5" />}
                color="blue"
                sparklineData={displayMetrics.metrics}
                sparklineKey="cpu"
              />
              <StatCard
                title="Memory Used"
                value={formatMemory(metricsData?.current?.memoryUsed ?? 0)}
                unit={getMemoryUnit(metricsData?.current?.memoryUsed ?? 0)}
                subtext={`${metricsData?.current?.memoryPercent?.toFixed(1) ?? 0}% of ${formatMemory(metricsData?.current?.memoryTotal ?? 0)} ${getMemoryUnit(metricsData?.current?.memoryTotal ?? 0)}`}
                icon={<HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />}
                color="green"
                sparklineData={displayMetrics.metrics}
                sparklineKey="memoryUsed"
              />
              <StatCard
                title="Disk Usage"
                value={metricsData?.current?.disk ?? 0}
                unit="%"
                subtext={`Avg: ${metricsData?.summary?.avg_disk?.toFixed(1) ?? 0}% • Max: ${metricsData?.summary?.max_disk?.toFixed(1) ?? 0}%`}
                icon={<Database className="w-4 h-4 sm:w-5 sm:h-5" />}
                color="yellow"
                sparklineData={displayMetrics.metrics}
                sparklineKey="disk"
              />
              <StatCard
                title="Data Points"
                value={metricsData?.count ?? 0}
                subtext={metricsData?.current?.recordedAt 
                  ? `Updated ${formatDistanceToNow(new Date(metricsData.current.recordedAt))} ago`
                  : "No recent data"
                }
                icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />}
                color="blue"
              />
            </div>

            {/* Charts - Stacked vertically, touch-friendly */}
            <div className="space-y-4 sm:space-y-6">
              {/* CPU Chart */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    <h2 className="text-base sm:text-lg font-bold">CPU Usage</h2>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-400">
                    {timeRanges.find(r => r.value === range)?.fullLabel}
                  </span>
                </div>
                <div className="touch-pan-x touch-pan-y">
                  <CpuChart data={displayMetrics.metrics} range={range} />
                </div>
              </div>

              {/* Memory Chart */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-6 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                    <h2 className="text-base sm:text-lg font-bold">Memory Usage</h2>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-500"></span>
                      Used
                    </span>
                    <span className="flex items-center gap-1.5 sm:gap-2">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-900"></span>
                      Total
                    </span>
                  </div>
                </div>
                <div className="touch-pan-x touch-pan-y">
                  <MemoryChart data={displayMetrics.metrics} range={range} />
                </div>
              </div>

              {/* Disk Chart */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    <h2 className="text-base sm:text-lg font-bold">Disk Usage</h2>
                  </div>
                </div>
                <div className="touch-pan-x touch-pan-y">
                  <DiskChart data={displayMetrics.metrics} range={range} />
                </div>
              </div>
            </div>

            {/* App Resource Breakdown */}
            {appStats.length > 0 && (
              <div className="mt-4 sm:mt-6 rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <h2 className="text-base sm:text-lg font-bold">Application Resources</h2>
                </div>

                {/* Mobile: Card layout */}
                <div className="sm:hidden space-y-3">
                  {appStats
                    .sort((a, b) => b.cpu_percent - a.cpu_percent)
                    .map((app) => (
                      <div 
                        key={app.pm2_name} 
                        className="bg-gray-800/50 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm truncate mr-2">
                            {app.display_name || app.pm2_name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                            app.status === 'online' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div title={`Instant: ${app.cpu_percent}%`}>
                            <div className="text-xs text-gray-400 mb-1">CPU <span className="text-gray-500">(5m avg)</span></div>
                            <div className="text-blue-400 font-medium text-sm">{Math.round(app.avg_cpu_5min ?? app.cpu_percent)}%</div>
                            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${Math.min(app.avg_cpu_5min ?? app.cpu_percent, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div title={`Instant: ${app.memory_mb >= 1024 ? `${(app.memory_mb / 1024).toFixed(1)} GB` : `${Math.round(app.memory_mb)} MB`}`}>
                            <div className="text-xs text-gray-400 mb-1">Memory <span className="text-gray-500">(5m avg)</span></div>
                            <div className="text-emerald-400 font-medium text-sm">
                              {(app.avg_memory_5min ?? app.memory_mb) >= 1024 
                                ? `${((app.avg_memory_5min ?? app.memory_mb) / 1024).toFixed(1)} GB`
                                : `${Math.round(app.avg_memory_5min ?? app.memory_mb)} MB`
                              }
                            </div>
                            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ 
                                  width: `${Math.min(((app.avg_memory_5min ?? app.memory_mb) / (metricsData?.current?.memoryTotal || 1000)) * 100, 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Desktop: Table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                        <th className="pb-3">Application</th>
                        <th className="pb-3 text-right">Status</th>
                        <th className="pb-3 text-right">CPU <span className="text-xs text-gray-500">(5m avg)</span></th>
                        <th className="pb-3 text-right">Memory <span className="text-xs text-gray-500">(5m avg)</span></th>
                        <th className="pb-3 w-48">CPU Bar</th>
                        <th className="pb-3 w-48">Memory Bar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {appStats
                        .sort((a, b) => (b.avg_cpu_5min ?? b.cpu_percent) - (a.avg_cpu_5min ?? a.cpu_percent))
                        .map((app) => (
                          <tr key={app.pm2_name} className="hover:bg-gray-800/30">
                            <td className="py-3">
                              <span className="font-medium">
                                {app.display_name || app.pm2_name}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                app.status === 'online' 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="py-3 text-right text-blue-400" title={`Instant: ${app.cpu_percent}%`}>
                              {Math.round(app.avg_cpu_5min ?? app.cpu_percent)}%
                            </td>
                            <td className="py-3 text-right text-emerald-400" title={`Instant: ${app.memory_mb >= 1024 ? `${(app.memory_mb / 1024).toFixed(1)} GB` : `${Math.round(app.memory_mb)} MB`}`}>
                              {(app.avg_memory_5min ?? app.memory_mb) >= 1024 
                                ? `${((app.avg_memory_5min ?? app.memory_mb) / 1024).toFixed(1)} GB`
                                : `${Math.round(app.avg_memory_5min ?? app.memory_mb)} MB`
                              }
                            </td>
                            <td className="py-3">
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(app.avg_cpu_5min ?? app.cpu_percent, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ 
                                    width: `${Math.min(((app.avg_memory_5min ?? app.memory_mb) / (metricsData?.current?.memoryTotal || 1000)) * 100, 100)}%` 
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Click outside to close dropdown */}
      {showServerDropdown && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowServerDropdown(false)}
        />
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
