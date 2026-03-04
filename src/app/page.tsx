"use client";

import { useEffect, useState, useCallback } from "react";
import { formatUptime, formatBytes } from "@/lib/utils";
import {
  Server,
  RefreshCw,
  Plus,
  ExternalLink,
  RotateCcw,
  Wifi,
  WifiOff,
  Cpu,
  HardDrive,
  Clock,
  AlertCircle,
} from "lucide-react";

interface App {
  id: string;
  server_id: string;
  pm2_id: number;
  pm2_name: string;
  display_name: string | null;
  url: string | null;
  status: string;
  cpu_percent: number;
  memory_mb: number;
  uptime_ms: number;
  restarts: number;
  last_seen: string;
}

interface ServerData {
  id: string;
  name: string;
  hostname: string;
  os: string;
  ip_address: string;
  last_heartbeat: string;
  is_online: boolean;
  apps: App[];
}

export default function Dashboard() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerKey, setNewServerKey] = useState<string | null>(null);
  const [restartingApp, setRestartingApp] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/servers");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setServers(json.data);
        setError(null);
      }
    } catch {
      setError("Failed to fetch servers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 10000);
    return () => clearInterval(interval);
  }, [fetchServers]);

  const addServer = async () => {
    if (!newServerName.trim()) return;

    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServerName }),
      });
      const json = await res.json();
      if (json.data) {
        setNewServerKey(json.data.apiKey);
        setNewServerName("");
        fetchServers();
      }
    } catch {
      setError("Failed to add server");
    }
  };

  const restartApp = async (serverId: string, appName: string) => {
    setRestartingApp(`${serverId}:${appName}`);
    try {
      await fetch(`/api/servers/${serverId}/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName }),
      });
      // Wait a bit then refresh
      setTimeout(fetchServers, 2000);
    } catch {
      setError("Failed to restart app");
    } finally {
      setTimeout(() => setRestartingApp(null), 3000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "stopped":
        return "bg-red-500";
      case "errored":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  const isOnline = (lastHeartbeat: string) => {
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < 60000; // 60 seconds
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Watchtower</h1>
              <p className="text-xs text-gray-400">Server Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchServers}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddServer(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-900/50 border border-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Server Modal */}
        {showAddServer && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Add Server</h2>
              {newServerKey ? (
                <div>
                  <p className="text-gray-400 mb-2">Server created! Copy this API key:</p>
                  <div className="bg-gray-800 p-3 rounded-lg font-mono text-sm break-all mb-4">
                    {newServerKey}
                  </div>
                  <p className="text-yellow-400 text-sm mb-4">
                    ⚠️ Save this key - it won&apos;t be shown again!
                  </p>
                  <button
                    onClick={() => {
                      setShowAddServer(false);
                      setNewServerKey(null);
                    }}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Server name (e.g., ubuntu-prod)"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 mb-4"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddServer(false)}
                      className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addServer}
                      className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Servers */}
        {servers.length === 0 ? (
          <div className="text-center py-20">
            <Server className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-bold mb-2">No servers yet</h2>
            <p className="text-gray-400 mb-4">Add a server to start monitoring</p>
            <button
              onClick={() => setShowAddServer(true)}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
            >
              Add Server
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {servers.map((server) => (
              <div
                key={server.id}
                className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden"
              >
                {/* Server Header */}
                <div className="px-4 py-3 bg-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isOnline(server.last_heartbeat) ? (
                      <Wifi className="w-5 h-5 text-green-400" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <h2 className="font-bold">{server.name}</h2>
                      <p className="text-xs text-gray-400">
                        {server.hostname || server.ip_address || "Waiting for heartbeat..."}
                        {server.os && ` • ${server.os}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {server.last_heartbeat
                      ? new Date(server.last_heartbeat).toLocaleTimeString()
                      : "Never"}
                  </div>
                </div>

                {/* Apps */}
                {server.apps.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No apps yet - waiting for agent heartbeat
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {server.apps.map((app) => (
                      <div
                        key={app.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-gray-800/30"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${getStatusColor(app.status)}`}
                          />
                          <div>
                            <div className="font-medium">
                              {app.display_name || app.pm2_name}
                            </div>
                            {app.url && (
                              <a
                                href={app.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                              >
                                {app.url.replace(/https?:\/\//, "")}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right text-sm">
                            <div className="flex items-center gap-1 text-gray-400">
                              <Cpu className="w-3 h-3" />
                              {app.cpu_percent}%
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="flex items-center gap-1 text-gray-400">
                              <HardDrive className="w-3 h-3" />
                              {formatBytes(app.memory_mb)}
                            </div>
                          </div>
                          <div className="text-right text-sm w-20">
                            <div className="text-gray-400">
                              {formatUptime(app.uptime_ms)}
                            </div>
                          </div>
                          <div className="text-right text-sm w-12 text-gray-500">
                            ↻ {app.restarts}
                          </div>
                          <button
                            onClick={() => restartApp(server.id, app.pm2_name)}
                            disabled={restartingApp === `${server.id}:${app.pm2_name}`}
                            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition disabled:opacity-50"
                            title="Restart"
                          >
                            <RotateCcw
                              className={`w-4 h-4 ${
                                restartingApp === `${server.id}:${app.pm2_name}`
                                  ? "animate-spin"
                                  : ""
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
