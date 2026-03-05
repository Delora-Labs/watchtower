"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Server,
  RefreshCw,
  Filter,
  X,
  Pause,
  Play,
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Clock,
  Monitor,
  AppWindow,
  AlertTriangle,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Sparkles,
  Loader2,
  Download,
  Calendar,
  Activity,
} from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id: number;
  server_id: string;
  app_id: string | null;
  app_name: string | null;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  server_name?: string;
}

interface ServerOption {
  id: string;
  name: string;
}

interface AppOption {
  id: string;
  name: string;
  server_id: string;
}

interface LogStats {
  timeRanges: {
    [key: string]: {
      total: number;
      errors: number;
      warnings: number;
    };
  };
  levelBreakdown: { level: string; count: number }[];
  topApps: { app_name: string; count: number; errors: number }[];
  errorTrend: { hour: string; errors: number; total: number }[];
}

interface AIAnalysis {
  summary: string;
  issues: { title: string; severity: string; count: number; description: string }[];
  recommendations: string[];
  logsAnalyzed?: number;
}

// Helper to detect if a log is part of a stack trace
function isStackTraceLine(message: string): boolean {
  return /^\s*at\s+/.test(message) || 
         /^\s+at\s+/.test(message) ||
         message.startsWith("    at ") ||
         message.includes("node_modules") && message.includes("(") ||
         /^\s*\^+$/.test(message);
}

// Group logs by stack traces
interface LogGroup {
  mainLog: LogEntry;
  stackLines: LogEntry[];
}

function groupLogs(logs: LogEntry[]): LogGroup[] {
  const groups: LogGroup[] = [];
  let currentGroup: LogGroup | null = null;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    
    if (isStackTraceLine(log.message)) {
      // This is a stack trace line - add to current group if exists
      if (currentGroup) {
        currentGroup.stackLines.push(log);
      } else {
        // Orphan stack line - treat as main log
        groups.push({ mainLog: log, stackLines: [] });
      }
    } else {
      // This is a main log line
      // Save previous group if exists
      if (currentGroup) {
        groups.push(currentGroup);
      }
      // Start new group (only for errors that might have stack traces)
      if (log.level === "error") {
        currentGroup = { mainLog: log, stackLines: [] };
      } else {
        currentGroup = null;
        groups.push({ mainLog: log, stackLines: [] });
      }
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

const LEVEL_COLORS = {
  error: "text-red-400 bg-red-950/50 border-red-900/50",
  warn: "text-yellow-400 bg-yellow-950/50 border-yellow-900/50",
  info: "text-blue-400 bg-blue-950/50 border-blue-900/50",
  debug: "text-gray-400 bg-gray-800/50 border-gray-700/50",
};

const LEVEL_BADGES = {
  error: "bg-red-600",
  warn: "bg-yellow-600",
  info: "bg-blue-600",
  debug: "bg-gray-600",
};

// AI Analysis Panel Component
function AIAnalysisPanel({
  analysis,
  loading,
  onAnalyze,
  selectedTimeRange,
  onTimeRangeChange,
}: {
  analysis: AIAnalysis | null;
  loading: boolean;
  onAnalyze: () => void;
  selectedTimeRange: string;
  onTimeRangeChange: (range: string) => void;
}) {
  return (
    <div className="p-4 rounded-lg bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="font-medium">AI Log Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => onTimeRangeChange(e.target.value)}
            className="px-2 py-1 text-sm rounded bg-gray-800 border border-gray-700"
          >
            <option value="1h">Last 1h</option>
            <option value="6h">Last 6h</option>
            <option value="24h">Last 24h</option>
          </select>
          <button
            onClick={onAnalyze}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loading ? "Analyzing..." : "Analyze Errors"}
          </button>
        </div>
      </div>

      {analysis ? (
        <div className="space-y-3">
          {/* Summary */}
          <div className="text-sm text-gray-300 bg-gray-900/50 rounded p-3">
            <strong className="text-purple-400">Summary:</strong> {analysis.summary}
            {analysis.logsAnalyzed && (
              <span className="text-gray-500 text-xs ml-2">
                ({analysis.logsAnalyzed} logs analyzed)
              </span>
            )}
          </div>

          {/* Issues */}
          {analysis.issues && analysis.issues.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Issues Found</div>
              <div className="space-y-2">
                {analysis.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded text-sm ${
                      issue.severity === "high"
                        ? "bg-red-900/30 border-l-2 border-red-500"
                        : issue.severity === "medium"
                        ? "bg-yellow-900/30 border-l-2 border-yellow-500"
                        : "bg-gray-800/50 border-l-2 border-gray-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{issue.title}</span>
                      {issue.count && (
                        <span className="text-xs text-gray-500">{issue.count}x</span>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs mt-1">{issue.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Recommendations
              </div>
              <ul className="space-y-1">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-500 text-center py-4">
          Click &quot;Analyze Errors&quot; to get AI-powered insights on recent errors and warnings
        </div>
      )}
    </div>
  );
}

// Stats Dashboard Component
function LogsDashboard({
  stats,
  loading,
  onLevelClick,
  onAppClick,
  analysis,
  analysisLoading,
  onAnalyze,
  analysisTimeRange,
  onAnalysisTimeRangeChange,
}: {
  stats: LogStats | null;
  loading: boolean;
  onLevelClick: (level: string) => void;
  onAppClick: (app: string) => void;
  analysis: AIAnalysis | null;
  analysisLoading: boolean;
  onAnalyze: () => void;
  analysisTimeRange: string;
  onAnalysisTimeRangeChange: (range: string) => void;
}) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-800/50 rounded-lg" />
        ))}
      </div>
    );
  }

  const ranges = [
    { key: "1h", label: "1 Hour" },
    { key: "6h", label: "6 Hours" },
    { key: "24h", label: "24 Hours" },
    { key: "7d", label: "7 Days" },
  ];

  return (
    <div className="space-y-4 mb-4">
      {/* Time range stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ranges.map(({ key, label }) => {
          const data = stats.timeRanges[key];
          return (
            <div
              key={key}
              className="text-left p-4 rounded-lg bg-gray-900 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {label}
                </span>
                <TrendingUp className="w-4 h-4 text-gray-600" />
              </div>
              <div className="text-2xl font-bold text-white">
                {data?.total?.toLocaleString() || 0}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs">
                {data?.errors > 0 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {data.errors} errors
                  </span>
                )}
                {data?.warnings > 0 && (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {data.warnings} warn
                  </span>
                )}
                {!data?.errors && !data?.warnings && (
                  <span className="text-green-400">✓ Clean</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Analysis Panel */}
      <AIAnalysisPanel
        analysis={analysis}
        loading={analysisLoading}
        onAnalyze={onAnalyze}
        selectedTimeRange={analysisTimeRange}
        onTimeRangeChange={onAnalysisTimeRangeChange}
      />

      {/* Level breakdown & Top Errors by App */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Level breakdown */}
        <div className="p-4 rounded-lg bg-gray-900 border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">By Level (24h)</span>
          </div>
          <div className="space-y-2">
            {stats.levelBreakdown.map(({ level, count }) => {
              const total = stats.timeRanges["24h"]?.total || 1;
              const percent = Math.round((count / total) * 100);
              return (
                <button
                  key={level}
                  onClick={() => onLevelClick(level)}
                  className="w-full flex items-center gap-2 text-sm hover:bg-gray-800/50 rounded p-1 -m-1 transition"
                >
                  <span
                    className={`w-3 h-3 rounded ${
                      LEVEL_BADGES[level as keyof typeof LEVEL_BADGES] || "bg-gray-600"
                    }`}
                  />
                  <span className="capitalize text-gray-300 w-16">{level}</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        LEVEL_BADGES[level as keyof typeof LEVEL_BADGES] || "bg-gray-600"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-gray-500 w-16 text-right">
                    {count.toLocaleString()}
                  </span>
                </button>
              );
            })}
            {stats.levelBreakdown.length === 0 && (
              <div className="text-gray-500 text-sm">No logs in last 24h</div>
            )}
          </div>
        </div>

        {/* Top Errors by App */}
        <div className="p-4 rounded-lg bg-gray-900 border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium">Top Errors by App (24h)</span>
          </div>
          <div className="space-y-2">
            {stats.topApps.length > 0 ? (
              stats.topApps.slice(0, 5).map(({ app_name, errors }) => (
                <button
                  key={app_name}
                  onClick={() => {
                    onAppClick(app_name);
                    onLevelClick("error");
                  }}
                  className="w-full flex items-center justify-between text-sm hover:bg-gray-800/50 rounded p-1 -m-1 transition"
                >
                  <span className="text-gray-300 truncate">{app_name}</span>
                  <span className="text-red-400 font-medium">
                    {errors.toLocaleString()} errors
                  </span>
                </button>
              ))
            ) : (
              <div className="text-green-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                No errors in last 24h! 🎉
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Expandable Log Row Component
function LogRow({
  log,
  isExpanded,
  onToggle,
}: {
  log: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatFullTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded border ${LEVEL_COLORS[log.level]} transition-all`}>
      {/* Collapsed row - clickable */}
      <div
        onClick={onToggle}
        className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition"
      >
        {/* Expand icon */}
        <span className="text-gray-500 mt-0.5 shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        {/* Timestamp */}
        <span className="text-gray-500 shrink-0 text-xs sm:text-sm font-mono">
          {formatTimestamp(log.timestamp)}
        </span>

        {/* Level badge */}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${LEVEL_BADGES[log.level]}`}
        >
          {log.level.slice(0, 3)}
        </span>

        {/* Server/App tag */}
        <span className="text-purple-400 shrink-0 text-xs sm:text-sm">
          [{log.server_name || log.server_id.slice(0, 8)}
          {log.app_name && `:${log.app_name}`}]
        </span>

        {/* Message - truncated in collapsed view */}
        <span
          className={`text-gray-200 text-sm ${
            !isExpanded ? "truncate" : "whitespace-pre-wrap break-all"
          }`}
        >
          {log.message}
        </span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-gray-700/50 bg-gray-900/50 px-4 py-3 space-y-3">
          {/* Full message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Message
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(log.message);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded transition"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap break-all bg-gray-950 rounded p-3 overflow-x-auto">
              {log.message}
            </pre>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Timestamp</div>
                <div className="text-gray-300">{formatFullTimestamp(log.timestamp)}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Monitor className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Server</div>
                <div className="text-gray-300">
                  {log.server_name || log.server_id.slice(0, 12)}
                </div>
              </div>
            </div>

            {log.app_name && (
              <div className="flex items-start gap-2">
                <AppWindow className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Application</div>
                  <div className="text-gray-300">{log.app_name}</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <div
                className={`w-4 h-4 rounded ${LEVEL_BADGES[log.level]} mt-0.5 shrink-0`}
              />
              <div>
                <div className="text-xs text-gray-500">Level</div>
                <div className="text-gray-300 capitalize">{log.level}</div>
              </div>
            </div>
          </div>

          {/* Log ID for debugging */}
          <div className="text-xs text-gray-600">Log ID: {log.id}</div>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [showDashboard, setShowDashboard] = useState(true);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestLogId, setOldestLogId] = useState<number | null>(null);

  // AI Analysis state
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisTimeRange, setAnalysisTimeRange] = useState("1h");

  // Filters
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Time range filters
  const [fromTime, setFromTime] = useState<string>("");
  const [toTime, setToTime] = useState<string>("");

  // Export state
  const [exporting, setExporting] = useState(false);

  // SSE Streaming state
  const [useStreaming, setUseStreaming] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const lastLogIdRef = useRef<number>(0);
  const shouldAutoScroll = useRef(true);

  // Helper to format date for datetime-local input
  const formatDateTimeLocal = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Quick time presets
  const applyTimePreset = (preset: string) => {
    const now = new Date();
    let from: Date;
    
    switch (preset) {
      case "1h":
        from = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "6h":
        from = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case "24h":
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }
    
    setFromTime(formatDateTimeLocal(from));
    setToTime(formatDateTimeLocal(now));
  };

  // Export logs as CSV
  const exportLogs = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedServer) params.set("server", selectedServer);
      if (selectedApp) params.set("app", selectedApp);
      if (selectedLevel) params.set("level", selectedLevel);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (fromTime) params.set("from", new Date(fromTime).toISOString());
      if (toTime) params.set("to", new Date(toTime).toISOString());

      const res = await fetch(`/api/logs/export?${params.toString()}`);
      
      if (!res.ok) {
        throw new Error("Export failed");
      }

      // Get the blob and download it
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchtower-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to export logs:", err);
      setError("Failed to export logs");
    } finally {
      setExporting(false);
    }
  };

  // Toggle log expansion
  const toggleExpanded = (logId: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // AI Analysis
  const runAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch("/api/logs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeRange: analysisTimeRange,
          server: selectedServer || undefined,
          app: selectedApp || undefined,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setAnalysis(json.data);
      }
    } catch (err) {
      console.error("Failed to analyze logs:", err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedServer) params.set("server", selectedServer);

      const res = await fetch(`/api/logs/stats?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedServer]);

  // Load stats on mount and when server changes
  useEffect(() => {
    setStatsLoading(true);
    fetchStats();
  }, [fetchStats]);

  // Refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Load servers and apps for filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetch("/api/servers");
        const json = await res.json();
        if (json.data) {
          const serverList: ServerOption[] = json.data.map(
            (s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            })
          );
          setServers(serverList);

          // Extract apps from all servers
          const appList: AppOption[] = [];
          for (const server of json.data) {
            if (server.apps) {
              for (const app of server.apps) {
                appList.push({
                  id: app.id,
                  name: app.display_name || app.pm2_name,
                  server_id: server.id,
                });
              }
            }
          }
          setApps(appList);
        }
      } catch (err) {
        console.error("Failed to load filters:", err);
      }
    };
    loadFilters();
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(
    async (isPolling = false) => {
      if (paused && isPolling) return;

      try {
        const params = new URLSearchParams();
        if (selectedServer) params.set("server", selectedServer);
        if (selectedApp) params.set("app", selectedApp);
        if (selectedLevel) params.set("level", selectedLevel);
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (fromTime) params.set("from", new Date(fromTime).toISOString());
        if (toTime) params.set("to", new Date(toTime).toISOString());

        // For polling, only get logs after the last one we have
        if (isPolling && lastLogIdRef.current > 0) {
          const lastLog = logs[logs.length - 1];
          if (lastLog) {
            params.set("after", lastLog.timestamp);
          }
        }

        params.set("limit", isPolling ? "50" : "200");

        const res = await fetch(`/api/logs?${params.toString()}`);
        const json = await res.json();

        if (json.error) {
          setError(json.error);
          return;
        }

        if (isPolling && json.data.length > 0) {
          setLogs((prev) => {
            const newLogs = json.data.filter(
              (log: LogEntry) => log.id > lastLogIdRef.current
            );
            if (newLogs.length > 0) {
              const combined = [...prev, ...newLogs];
              return combined.slice(-1000);
            }
            return prev;
          });
        } else if (!isPolling) {
          setLogs(json.data);
          // Set oldest log ID for pagination
          if (json.data.length > 0) {
            const minId = Math.min(...json.data.map((l: LogEntry) => l.id));
            setOldestLogId(minId);
            setHasMore(json.data.length === 200);
          }
        }

        if (json.data.length > 0) {
          const maxId = Math.max(...json.data.map((l: LogEntry) => l.id));
          if (maxId > lastLogIdRef.current) {
            lastLogIdRef.current = maxId;
          }
        }

        setError(null);
      } catch (err) {
        console.error("Failed to fetch logs:", err);
        if (!isPolling) {
          setError("Failed to fetch logs");
        }
      } finally {
        if (!isPolling) {
          setLoading(false);
        }
      }
    },
    [selectedServer, selectedApp, selectedLevel, debouncedSearch, fromTime, toTime, paused, logs]
  );

  // Load more (older logs)
  const loadMore = async () => {
    if (!hasMore || loadingMore || !oldestLogId) return;
    
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (selectedServer) params.set("server", selectedServer);
      if (selectedApp) params.set("app", selectedApp);
      if (selectedLevel) params.set("level", selectedLevel);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("before_id", oldestLogId.toString());
      params.set("limit", "100");

      const res = await fetch(`/api/logs?${params.toString()}`);
      const json = await res.json();

      if (json.data && json.data.length > 0) {
        setLogs((prev) => [...json.data, ...prev]);
        const minId = Math.min(...json.data.map((l: LogEntry) => l.id));
        setOldestLogId(minId);
        setHasMore(json.data.length === 100);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load more logs:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Initial load and when filters change
  useEffect(() => {
    setLoading(true);
    lastLogIdRef.current = 0;
    setExpandedLogs(new Set());
    setHasMore(true);
    setOldestLogId(null);
    fetchLogs(false);
  }, [selectedServer, selectedApp, selectedLevel, debouncedSearch, fromTime, toTime]);

  // SSE Streaming connection
  useEffect(() => {
    if (!useStreaming || paused) {
      // Close existing connection when switching off or paused
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setStreamConnected(false);
      }
      return;
    }

    // Build SSE URL with filters
    const params = new URLSearchParams();
    if (selectedServer) params.set("server", selectedServer);
    if (selectedApp) params.set("app", selectedApp);
    if (selectedLevel) params.set("level", selectedLevel);

    const url = `/api/logs/stream?${params.toString()}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStreamConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "connected") {
          setStreamConnected(true);
        } else if (data.type === "logs" && data.data?.length > 0) {
          setLogs((prev) => {
            const newLogs = data.data.filter(
              (log: LogEntry) => log.id > lastLogIdRef.current
            );
            if (newLogs.length > 0) {
              const combined = [...prev, ...newLogs];
              // Update last log ID
              lastLogIdRef.current = Math.max(...newLogs.map((l: LogEntry) => l.id));
              return combined.slice(-1000);
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      setStreamConnected(false);
      // EventSource will auto-reconnect
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setStreamConnected(false);
    };
  }, [useStreaming, paused, selectedServer, selectedApp, selectedLevel]);

  // Polling (only when not using streaming)
  useEffect(() => {
    if (paused || useStreaming) return;

    const interval = setInterval(() => {
      fetchLogs(true);
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchLogs, paused, useStreaming]);

  // Auto-scroll
  useEffect(() => {
    if (shouldAutoScroll.current && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  const clearFilters = () => {
    setSelectedServer("");
    setSelectedApp("");
    setSelectedLevel("");
    setSearchText("");
    setDebouncedSearch("");
    setFromTime("");
    setToTime("");
  };

  const hasFilters = selectedServer || selectedApp || selectedLevel || searchText || fromTime || toTime;

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Filter apps based on selected server
  const filteredApps = selectedServer
    ? apps.filter((app) => app.server_id === selectedServer)
    : apps;

  // Get unique app names for the dropdown
  const uniqueAppNames = [...new Set(apps.map((a) => a.name))].sort();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Live Logs</h1>
                <p className="text-xs text-gray-400">
                  {logs.length} entries
                  {paused && " • Paused"}
                  {hasFilters && " • Filtered"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle dashboard */}
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`p-2 rounded-lg transition ${
                showDashboard
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
              title={showDashboard ? "Hide dashboard" : "Show dashboard"}
            >
              <BarChart3 className="w-4 h-4" />
            </button>

            {/* Streaming vs Polling toggle */}
            <button
              onClick={() => setUseStreaming(!useStreaming)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm ${
                useStreaming
                  ? streamConnected
                    ? "bg-cyan-600 text-white"
                    : "bg-cyan-800 text-cyan-200"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
              title={useStreaming ? "Using SSE streaming (500ms)" : "Using polling (2s)"}
            >
              <Activity className={`w-4 h-4 ${useStreaming && streamConnected ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">
                {useStreaming ? (streamConnected ? "Stream" : "Connecting...") : "Poll"}
              </span>
            </button>

            <button
              onClick={() => setPaused(!paused)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                paused
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-yellow-600 hover:bg-yellow-700"
              }`}
            >
              {paused ? (
                <>
                  <Play className="w-4 h-4" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                fetchLogs(false);
                fetchStats();
              }}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/30">
          <div className="flex flex-col gap-3">
            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 hidden sm:block" />

              {/* Server filter */}
              <select
                value={selectedServer}
                onChange={(e) => {
                  setSelectedServer(e.target.value);
                  setSelectedApp("");
                }}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none min-w-[140px]"
              >
                <option value="">All Servers</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>

              {/* App filter */}
              <select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none min-w-[140px]"
              >
                <option value="">All Apps</option>
                {(selectedServer
                  ? filteredApps.map((a) => a.name)
                  : uniqueAppNames
                ).map((appName) => (
                  <option key={appName} value={appName}>
                    {appName}
                  </option>
                ))}
              </select>

              {/* Level filter */}
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none min-w-[120px]"
              >
                <option value="">All Levels</option>
                <option value="error">🔴 Error</option>
                <option value="warn">🟡 Warning</option>
                <option value="info">🔵 Info</option>
                <option value="debug">⚪ Debug</option>
              </select>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-900/50 hover:bg-red-900 text-red-400 text-sm transition"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}

              {/* Export button */}
              <button
                onClick={exportLogs}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm transition disabled:opacity-50 ml-auto"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export CSV"}</span>
              </button>
            </div>

            {/* Time Range row */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500 hidden sm:block" />
              
              {/* From */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">From:</span>
                <input
                  type="datetime-local"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* To */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">To:</span>
                <input
                  type="datetime-local"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Quick presets */}
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-gray-500 hidden sm:inline">Quick:</span>
                {[
                  { key: "1h", label: "1h" },
                  { key: "6h", label: "6h" },
                  { key: "24h", label: "24h" },
                  { key: "7d", label: "7d" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => applyTimePreset(key)}
                    className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Clear time filters */}
              {(fromTime || toTime) && (
                <button
                  onClick={() => { setFromTime(""); setToTime(""); }}
                  className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-400 transition"
                >
                  Clear time
                </button>
              )}
            </div>

            {/* Search row */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search log messages..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Active filters summary */}
            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">Active filters:</span>
                {selectedServer && (
                  <span className="px-2 py-1 rounded bg-purple-900/50 text-purple-300">
                    Server: {servers.find((s) => s.id === selectedServer)?.name}
                  </span>
                )}
                {selectedApp && (
                  <span className="px-2 py-1 rounded bg-blue-900/50 text-blue-300">
                    App: {selectedApp}
                  </span>
                )}
                {selectedLevel && (
                  <span
                    className={`px-2 py-1 rounded ${
                      selectedLevel === "error"
                        ? "bg-red-900/50 text-red-300"
                        : selectedLevel === "warn"
                        ? "bg-yellow-900/50 text-yellow-300"
                        : selectedLevel === "info"
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    Level: {selectedLevel}
                  </span>
                )}
                {debouncedSearch && (
                  <span className="px-2 py-1 rounded bg-gray-700 text-gray-300">
                    Search: &quot;{debouncedSearch}&quot;
                  </span>
                )}
                {fromTime && (
                  <span className="px-2 py-1 rounded bg-green-900/50 text-green-300">
                    From: {new Date(fromTime).toLocaleString()}
                  </span>
                )}
                {toTime && (
                  <span className="px-2 py-1 rounded bg-green-900/50 text-green-300">
                    To: {new Date(toTime).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-900/50 border border-red-700 flex items-center gap-2 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dashboard */}
      {showDashboard && (
        <div className="px-4 pt-4">
          <LogsDashboard
            stats={stats}
            loading={statsLoading}
            onLevelClick={(level) => setSelectedLevel(level)}
            onAppClick={(app) => setSelectedApp(app)}
            analysis={analysis}
            analysisLoading={analysisLoading}
            onAnalyze={runAnalysis}
            analysisTimeRange={analysisTimeRange}
            onAnalysisTimeRangeChange={setAnalysisTimeRange}
          />
        </div>
      )}

      {/* Logs container */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-4"
      >
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Server className="w-12 h-12 mb-4" />
            <p>No logs found</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-purple-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Load More (older logs) button at top */}
            {hasMore && logs.length > 0 && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 mb-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading older logs...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 rotate-180" />
                    Load older logs
                  </>
                )}
              </button>
            )}
            {(() => {
              const groupedLogs = groupLogs(logs);
              let lastDate = "";
              
              return groupedLogs.map((group, groupIndex) => {
                const log = group.mainLog;
                const currentDate = formatDate(log.timestamp);
                const showDateSeparator = currentDate !== lastDate;
                lastDate = currentDate;
                const hasStack = group.stackLines.length > 0;

                return (
                  <div key={log.id}>
                    {showDateSeparator && (
                      <div className="flex items-center gap-2 my-4 text-gray-500 text-xs">
                        <div className="flex-1 border-t border-gray-800" />
                        <span className="px-2 py-1 bg-gray-900 rounded">
                          {currentDate}
                        </span>
                        <div className="flex-1 border-t border-gray-800" />
                      </div>
                    )}
                    <LogRow
                      log={log}
                      isExpanded={expandedLogs.has(log.id)}
                      onToggle={() => toggleExpanded(log.id)}
                    />
                    {/* Stack trace lines - collapsed by default, shown when main error is expanded */}
                    {hasStack && expandedLogs.has(log.id) && (
                      <div className="ml-6 border-l-2 border-gray-700 pl-2 space-y-0.5">
                        <div className="text-xs text-gray-500 py-1">
                          Stack trace ({group.stackLines.length} lines)
                        </div>
                        {group.stackLines.map((stackLog) => (
                          <div
                            key={stackLog.id}
                            className="text-xs text-gray-500 font-mono py-0.5 hover:text-gray-400"
                          >
                            {stackLog.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Show collapsed stack indicator */}
                    {hasStack && !expandedLogs.has(log.id) && (
                      <div 
                        onClick={() => toggleExpanded(log.id)}
                        className="ml-6 text-xs text-gray-600 py-1 cursor-pointer hover:text-gray-400"
                      >
                        + {group.stackLines.length} more lines (click to expand)
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
        <span>
          {paused ? (
            <span className="text-yellow-400">⏸ Paused</span>
          ) : useStreaming ? (
            streamConnected ? (
              <span className="text-cyan-400">● SSE Stream (500ms)</span>
            ) : (
              <span className="text-cyan-600">○ Connecting...</span>
            )
          ) : (
            <span className="text-green-400">● Polling (2s)</span>
          )}
        </span>
        <span>Click on a log to expand details</span>
      </div>
    </div>
  );
}
