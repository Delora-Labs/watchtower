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
  Trash2,
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

const LEVEL_COLORS = {
  error: "text-red-400 bg-red-950/50",
  warn: "text-yellow-400 bg-yellow-950/50",
  info: "text-blue-400 bg-blue-950/50",
  debug: "text-gray-400 bg-gray-800/50",
};

const LEVEL_BADGES = {
  error: "bg-red-600",
  warn: "bg-yellow-600",
  info: "bg-blue-600",
  debug: "bg-gray-600",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const lastLogIdRef = useRef<number>(0);
  const shouldAutoScroll = useRef(true);

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

        // For polling, only get logs after the last one we have
        if (isPolling && lastLogIdRef.current > 0) {
          // Get latest timestamp from our logs
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
          // Append new logs
          setLogs((prev) => {
            const newLogs = json.data.filter(
              (log: LogEntry) => log.id > lastLogIdRef.current
            );
            if (newLogs.length > 0) {
              const combined = [...prev, ...newLogs];
              // Keep last 1000 logs to prevent memory issues
              return combined.slice(-1000);
            }
            return prev;
          });
        } else if (!isPolling) {
          setLogs(json.data);
        }

        // Update last log id
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
    [selectedServer, selectedApp, selectedLevel, debouncedSearch, paused, logs]
  );

  // Initial load and when filters change
  useEffect(() => {
    setLoading(true);
    lastLogIdRef.current = 0;
    fetchLogs(false);
  }, [selectedServer, selectedApp, selectedLevel, debouncedSearch]);

  // Polling
  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      fetchLogs(true);
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchLogs, paused]);

  // Auto-scroll
  useEffect(() => {
    if (shouldAutoScroll.current && logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        logsContainerRef.current;
      // Auto-scroll if within 100px of bottom
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  const clearFilters = () => {
    setSelectedServer("");
    setSelectedApp("");
    setSelectedLevel("");
    setSearchText("");
    setDebouncedSearch("");
  };

  const hasFilters =
    selectedServer || selectedApp || selectedLevel || searchText;

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

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
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </button>

            <button
              onClick={() => fetchLogs(false)}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/30">
          {/* Mobile: Stack vertically, Desktop: flex row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <Filter className="w-4 h-4 text-gray-500" />
            </div>

            {/* Filter dropdowns - grid on mobile for 2 columns, flex on desktop */}
            <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
              {/* Server filter */}
              <select
                value={selectedServer}
                onChange={(e) => {
                  setSelectedServer(e.target.value);
                  setSelectedApp(""); // Reset app when server changes
                }}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
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
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="">All Apps</option>
                {filteredApps.map((app) => (
                  <option key={app.id} value={app.name}>
                    {app.name}
                  </option>
                ))}
              </select>

              {/* Level filter */}
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>

              {/* Clear filters - in grid on mobile */}
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition sm:hidden"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Search - full width on mobile */}
            <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 sm:py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Clear filters - desktop only */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
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

      {/* Logs container */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-4 font-mono text-sm"
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
          <div className="space-y-0.5">
            {logs.map((log, index) => {
              // Show date separator if date changed
              const prevLog = logs[index - 1];
              const showDateSeparator =
                !prevLog ||
                formatDate(log.timestamp) !== formatDate(prevLog.timestamp);

              return (
                <div key={log.id}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-2 my-3 text-gray-500 text-xs">
                      <div className="flex-1 border-t border-gray-800" />
                      <span>{formatDate(log.timestamp)}</span>
                      <div className="flex-1 border-t border-gray-800" />
                    </div>
                  )}
                  <div
                    className={`rounded ${LEVEL_COLORS[log.level]} overflow-x-auto`}
                  >
                    <div className="flex items-start gap-2 px-2 py-1 min-w-max">
                      {/* Timestamp */}
                      <span className="text-gray-500 shrink-0 text-xs sm:text-sm">
                        {formatTimestamp(log.timestamp)}
                      </span>

                      {/* Level badge */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${LEVEL_BADGES[log.level]}`}
                      >
                        {log.level.slice(0, 3)}
                      </span>

                      {/* Server/App - hidden on mobile to save space */}
                      <span className="text-purple-400 shrink-0 hidden sm:inline">
                        [{log.server_name || log.server_id.slice(0, 8)}
                        {log.app_name && `:${log.app_name}`}]
                      </span>
                      {/* Abbreviated server/app on mobile */}
                      <span className="text-purple-400 shrink-0 sm:hidden text-xs">
                        [{log.app_name || log.server_name?.slice(0, 6) || log.server_id.slice(0, 4)}]
                      </span>

                      {/* Message - horizontal scroll for long lines */}
                      <span className="text-gray-200 whitespace-pre">
                        {log.message}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile floating pause/resume button */}
      <div className="sm:hidden fixed bottom-20 right-4 z-20">
        <button
          onClick={() => setPaused(!paused)}
          className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition ${
            paused
              ? "bg-green-600 hover:bg-green-700"
              : "bg-yellow-600 hover:bg-yellow-700"
          }`}
        >
          {paused ? (
            <Play className="w-6 h-6" />
          ) : (
            <Pause className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Footer status */}
      <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
        <span>
          {paused ? (
            <span className="text-yellow-400">⏸ Paused</span>
          ) : (
            <span className="text-green-400">● Live</span>
          )}{" "}
          • Polling every 2s
        </span>
        <span className="hidden sm:inline">
          {shouldAutoScroll.current ? "Auto-scrolling" : "Scroll locked"}
        </span>
      </div>
    </div>
  );
}
