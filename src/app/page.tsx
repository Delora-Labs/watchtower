"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { formatUptime, formatBytes } from "@/lib/utils";
import { WatchtowerIcon, WatchtowerBeacon } from "@/components/WatchtowerIcon";
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
  FileText,
  X,
  Settings,
  Bell,
  BellOff,
  UsersRound,
  BarChart3,
  Play,
  Square,
  ChevronRight,
  Menu,
  Globe,
  Activity,
} from "lucide-react";

interface App {
  id: string;
  server_id: string;
  pm2_id: number;
  pm2_name: string;
  display_name: string | null;
  url: string | null;
  category: string | null;
  notifications_enabled: boolean;
  status: string;
  cpu_percent: number;
  memory_mb: number;
  uptime_ms: number;
  restarts: number;
  last_seen: string;
  assignment?: {
    team_id: string | null;
    notify_on_down: boolean;
    notify_on_restart: boolean;
  };
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

interface Team {
  id: string;
  name: string;
  teams_webhook_url: string | null;
}

interface AppFormData {
  display_name: string;
  url: string;
  category: string;
  notifications_enabled: boolean;
  team_id: string;
  notify_on_down: boolean;
  notify_on_restart: boolean;
}

interface HealthCheck {
  id: string;
  name: string;
  url: string;
  method: string;
  expected_status: number;
  timeout_ms: number;
  interval_ms: number;
  enabled: boolean;
  latest_status: string | null;
  latest_response_time_ms: number | null;
  latest_checked_at: string | null;
}

const CATEGORIES = [
  { value: "", label: "No category" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "api", label: "API" },
  { value: "database", label: "Database" },
  { value: "worker", label: "Worker" },
  { value: "monitoring", label: "Monitoring" },
  { value: "other", label: "Other" },
];

function HeartbeatCountdown({ lastHeartbeat, intervalSec }: { lastHeartbeat: string; intervalSec: number }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [sinceLast, setSinceLast] = useState<number | null>(null);

  useEffect(() => {
    if (!lastHeartbeat) return;
    
    const updateCountdown = () => {
      const lastTime = new Date(lastHeartbeat).getTime();
      const nextTime = lastTime + intervalSec * 1000;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((nextTime - now) / 1000));
      setTimeLeft(remaining);
      setSinceLast(Math.floor((now - lastTime) / 1000));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lastHeartbeat, intervalSec]);

  const isOverdue = timeLeft === 0;

  return (
    <div className="text-xs flex items-center gap-2">
      <div className="flex items-center gap-1 text-gray-400">
        <Clock className="w-3 h-3" />
        <span className="hidden sm:inline">
          {lastHeartbeat ? new Date(lastHeartbeat).toLocaleTimeString() : "Never"}
        </span>
        <span className="sm:hidden">
          {lastHeartbeat ? new Date(lastHeartbeat).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Never"}
        </span>
      </div>
      {timeLeft !== null && (
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          isOverdue ? 'bg-yellow-600/30 text-yellow-400' : 'bg-blue-600/30 text-blue-400'
        }`}>
          {isOverdue ? `⏳ ${sinceLast}s` : `⏱ ${timeLeft}s`}
        </div>
      )}
    </div>
  );
}

// Bottom Sheet component for mobile actions
function BottomSheet({ 
  isOpen, 
  onClose, 
  app, 
  server,
  onViewLogs,
  onRestart,
  onStartStop,
  onSettings,
  restartingApp,
  actionInProgress,
}: {
  isOpen: boolean;
  onClose: () => void;
  app: App | null;
  server: ServerData | null;
  onViewLogs: (serverId: string, appName: string) => void;
  onRestart: (serverId: string, appName: string) => void;
  onStartStop: (serverId: string, appName: string, action: "start" | "stop") => void;
  onSettings: (app: App) => void;
  restartingApp: string | null;
  actionInProgress: string | null;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      setCurrentY(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentY > 100) {
      onClose();
    }
    setCurrentY(0);
  };

  if (!isOpen || !app || !server) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "stopped": return "bg-red-500";
      case "errored": return "bg-red-500";
      default: return "bg-yellow-500";
    }
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl border-t border-gray-700 transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${currentY}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* App Info Header */}
        <div className="px-4 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(app.status)}`} />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate">
                {app.display_name || app.pm2_name}
              </h3>
              <p className="text-sm text-gray-400 truncate">{server.name}</p>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              app.status === 'online' ? 'bg-green-900/50 text-green-400' :
              app.status === 'stopped' ? 'bg-red-900/50 text-red-400' :
              'bg-yellow-900/50 text-yellow-400'
            }`}>
              {app.status}
            </span>
          </div>
          
          {/* Stats Row */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Cpu className="w-4 h-4" />
              <span>{app.cpu_percent}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <HardDrive className="w-4 h-4" />
              <span>{formatBytes(app.memory_mb)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{formatUptime(app.uptime_ms)}</span>
            </div>
            <div className="text-gray-500">
              ↻ {app.restarts}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          {app.status === "stopped" || app.status === "errored" ? (
            <button
              onClick={() => {
                onStartStop(server.id, app.pm2_name, "start");
                onClose();
              }}
              disabled={actionInProgress === `${server.id}:${app.pm2_name}:start`}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-green-900/30 hover:bg-green-900/50 text-green-400 transition min-h-[56px] disabled:opacity-50"
            >
              <Play className="w-6 h-6" />
              <span className="text-lg font-medium">Start App</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onStartStop(server.id, app.pm2_name, "stop");
                onClose();
              }}
              disabled={actionInProgress === `${server.id}:${app.pm2_name}:stop`}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-red-900/30 hover:bg-red-900/50 text-red-400 transition min-h-[56px] disabled:opacity-50"
            >
              <Square className="w-6 h-6" />
              <span className="text-lg font-medium">Stop App</span>
            </button>
          )}

          <button
            onClick={() => {
              onRestart(server.id, app.pm2_name);
              onClose();
            }}
            disabled={restartingApp === `${server.id}:${app.pm2_name}`}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 transition min-h-[56px] disabled:opacity-50"
          >
            <RotateCcw className={`w-6 h-6 ${restartingApp === `${server.id}:${app.pm2_name}` ? 'animate-spin' : ''}`} />
            <span className="text-lg font-medium">Restart App</span>
          </button>

          <button
            onClick={() => {
              onViewLogs(server.id, app.pm2_name);
              onClose();
            }}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 transition min-h-[56px]"
          >
            <FileText className="w-6 h-6" />
            <span className="text-lg font-medium">View Logs</span>
          </button>

          <button
            onClick={() => {
              onSettings(app);
              onClose();
            }}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 transition min-h-[56px]"
          >
            <Settings className="w-6 h-6" />
            <span className="text-lg font-medium">Settings</span>
          </button>

          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 transition min-h-[56px]"
            >
              <ExternalLink className="w-6 h-6" />
              <span className="text-lg font-medium">Open URL</span>
            </a>
          )}
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-8" />
      </div>
    </div>
  );
}

// Swipeable App Row component
function AppRow({
  app,
  server,
  onOpenSheet,
  onOpenSettings,
  onViewLogs,
  onRestart,
  onStartStop,
  restartingApp,
  actionInProgress,
}: {
  app: App;
  server: ServerData;
  onOpenSheet: (app: App, server: ServerData) => void;
  onOpenSettings: (app: App) => void;
  onViewLogs: (serverId: string, appName: string) => void;
  onRestart: (serverId: string, appName: string) => void;
  onStartStop: (serverId: string, appName: string, action: "start" | "stop") => void;
  restartingApp: string | null;
  actionInProgress: string | null;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "stopped": return "bg-red-500";
      case "errored": return "bg-red-500";
      default: return "bg-yellow-500";
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX;
    // Only allow left swipe, max -120px
    if (diff < 0 && diff > -120) {
      setSwipeX(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < -60) {
      // Snap to reveal actions
      setSwipeX(-100);
    } else {
      setSwipeX(0);
    }
  };

  const resetSwipe = () => setSwipeX(0);

  return (
    <div className="relative overflow-hidden">
      {/* Swipe actions (revealed on swipe) - mobile only */}
      <div className="md:hidden absolute right-0 top-0 bottom-0 flex items-stretch">
        <button
          onClick={() => {
            onViewLogs(server.id, app.pm2_name);
            resetSwipe();
          }}
          className="w-[50px] bg-blue-600 flex items-center justify-center"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            onRestart(server.id, app.pm2_name);
            resetSwipe();
          }}
          className="w-[50px] bg-orange-600 flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Main Row Content */}
      <div
        ref={rowRef}
        className="relative bg-gray-900 transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile Layout */}
        <div
          className="md:hidden px-4 py-3 active:bg-gray-800/50 cursor-pointer"
          onClick={() => onOpenSheet(app, server)}
        >
          <div className="flex items-start gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getStatusColor(app.status)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {app.display_name || app.pm2_name}
                </span>
                {app.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                    {app.category}
                  </span>
                )}
                {!app.notifications_enabled && (
                  <BellOff className="w-3 h-3 text-gray-500 flex-shrink-0" />
                )}
              </div>
              
              {/* Mobile stats row */}
              <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  {app.cpu_percent}%
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatBytes(app.memory_mb)}
                </span>
                <span>{formatUptime(app.uptime_ms)}</span>
                <span className="text-gray-500">↻{app.restarts}</span>
              </div>

              {app.url && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 text-xs text-blue-400 hover:underline flex items-center gap-1 truncate"
                >
                  {app.url.replace(/https?:\/\//, "")}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              )}
            </div>
            
            {/* Mobile action hint */}
            <div className="flex items-center gap-2">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div
          className="hidden md:flex px-4 py-3 items-center justify-between hover:bg-gray-800/30 cursor-pointer group"
          onClick={() => onOpenSettings(app)}
        >
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(app.status)}`} />
            <div>
              <div className="font-medium flex items-center gap-2">
                {app.display_name || app.pm2_name}
                {app.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                    {app.category}
                  </span>
                )}
                {!app.notifications_enabled && (
                  <span title="Notifications disabled">
                    <BellOff className="w-3 h-3 text-gray-500" />
                  </span>
                )}
              </div>
              {app.url && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings(app);
              }}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition opacity-0 group-hover:opacity-100"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewLogs(server.id, app.pm2_name);
              }}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition"
              title="View Logs"
            >
              <FileText className="w-4 h-4" />
            </button>
            {app.status === "stopped" || app.status === "errored" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartStop(server.id, app.pm2_name, "start");
                }}
                disabled={actionInProgress === `${server.id}:${app.pm2_name}:start`}
                className="p-2 rounded-lg hover:bg-green-700 text-green-400 hover:text-white transition disabled:opacity-50"
                title="Start"
              >
                <Play className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartStop(server.id, app.pm2_name, "stop");
                }}
                disabled={actionInProgress === `${server.id}:${app.pm2_name}:stop`}
                className="p-2 rounded-lg hover:bg-red-700 text-red-400 hover:text-white transition disabled:opacity-50"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestart(server.id, app.pm2_name);
              }}
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
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerKey, setNewServerKey] = useState<string | null>(null);
  const [restartingApp, setRestartingApp] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [viewingLogs, setViewingLogs] = useState<{ serverId: string; appName: string } | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Bottom sheet state for mobile
  const [sheetApp, setSheetApp] = useState<App | null>(null);
  const [sheetServer, setSheetServer] = useState<ServerData | null>(null);
  
  // App settings modal state
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [appForm, setAppForm] = useState<AppFormData>({
    display_name: "",
    url: "",
    category: "",
    notifications_enabled: true,
    team_id: "",
    notify_on_down: true,
    notify_on_restart: false,
  });
  const [savingApp, setSavingApp] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const json = await res.json();
      if (!json.error) {
        setTeams(json.data);
      }
    } catch {
      // Ignore team fetch errors
    }
  }, []);

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

  const fetchHealthChecks = useCallback(async () => {
    try {
      const res = await fetch("/api/health-checks");
      const json = await res.json();
      if (!json.error) {
        setHealthChecks(json.data);
      }
    } catch {
      // Ignore health check fetch errors
    }
  }, []);

  useEffect(() => {
    fetchServers();
    fetchTeams();
    fetchHealthChecks();
    const interval = setInterval(() => {
      fetchServers();
      fetchHealthChecks();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchServers, fetchTeams, fetchHealthChecks]);

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

  const openAppSettings = async (app: App) => {
    setEditingApp(app);
    setAppForm({
      display_name: app.display_name || "",
      url: app.url || "",
      category: app.category || "",
      notifications_enabled: app.notifications_enabled ?? true,
      team_id: "",
      notify_on_down: true,
      notify_on_restart: false,
    });
    
    // Fetch current assignment
    try {
      const res = await fetch(`/api/apps/${app.id}`);
      const json = await res.json();
      if (json.data?.assignment) {
        setAppForm(prev => ({
          ...prev,
          team_id: json.data.assignment.team_id || "",
          notify_on_down: json.data.assignment.notify_on_down ?? true,
          notify_on_restart: json.data.assignment.notify_on_restart ?? false,
        }));
      }
    } catch {
      // Ignore
    }
  };

  const closeAppSettings = () => {
    setEditingApp(null);
    setAppForm({
      display_name: "",
      url: "",
      category: "",
      notifications_enabled: true,
      team_id: "",
      notify_on_down: true,
      notify_on_restart: false,
    });
  };

  const saveAppSettings = async () => {
    if (!editingApp) return;
    
    setSavingApp(true);
    try {
      const res = await fetch(`/api/apps/${editingApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: appForm.display_name,
          url: appForm.url,
          category: appForm.category,
          notifications_enabled: appForm.notifications_enabled,
          team_id: appForm.team_id || null,
          notify_on_down: appForm.notify_on_down,
          notify_on_restart: appForm.notify_on_restart,
        }),
      });
      
      if (res.ok) {
        closeAppSettings();
        fetchServers();
      } else {
        const json = await res.json();
        setError(json.error || "Failed to save app settings");
      }
    } catch {
      setError("Failed to save app settings");
    } finally {
      setSavingApp(false);
    }
  };

  const viewLogs = async (serverId: string, appName: string) => {
    setViewingLogs({ serverId, appName });
    setLoadingLogs(true);
    setLogs("");
    
    try {
      const res = await fetch(`/api/servers/${serverId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName }),
      });
      const json = await res.json();
      if (json.logs) {
        setLogs(json.logs);
      } else if (json.pending) {
        // Poll for result
        const pollLogs = async (commandId: string, attempts = 0) => {
          if (attempts > 30) {
            setLogs("Timeout waiting for logs");
            return;
          }
          await new Promise(r => setTimeout(r, 1000));
          const res = await fetch(`/api/commands/${commandId}/status`);
          const json = await res.json();
          if (json.status === 'completed') {
            setLogs(json.result || "No logs available");
          } else if (json.status === 'failed') {
            setLogs(`Error: ${json.result}`);
          } else {
            pollLogs(commandId, attempts + 1);
          }
        };
        pollLogs(json.commandId);
      }
    } catch {
      setLogs("Failed to fetch logs");
    } finally {
      setLoadingLogs(false);
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

  const sendCommand = async (serverId: string, appName: string, action: "start" | "stop") => {
    const key = `${serverId}:${appName}:${action}`;
    setActionInProgress(key);
    try {
      await fetch(`/api/servers/${serverId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, action }),
      });
      setTimeout(fetchServers, 2000);
    } catch {
      setError(`Failed to ${action} app`);
    } finally {
      setTimeout(() => setActionInProgress(null), 3000);
    }
  };

  const isOnline = (lastHeartbeat: string) => {
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < 60000; // 60 seconds
  };

  const openBottomSheet = (app: App, server: ServerData) => {
    setSheetApp(app);
    setSheetServer(server);
  };

  const closeBottomSheet = () => {
    setSheetApp(null);
    setSheetServer(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WatchtowerIcon className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0" />
            <div>
              <h1 className="text-lg md:text-xl font-bold">Watchtower</h1>
              <p className="text-xs text-gray-400 hidden sm:block">Delora Labs Monitoring System</p>
            </div>
          </div>
          
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/logs"
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
              title="Live Logs"
            >
              <FileText className="w-4 h-4" />
            </Link>
            <button
              onClick={fetchServers}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/analytics"
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
              title="Analytics"
            >
              <BarChart3 className="w-4 h-4" />
            </Link>
            <Link
              href="/settings"
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setShowAddServer(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
          </div>

          {/* Mobile nav */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={fetchServers}
              className="p-3 min-w-[44px] min-h-[44px] rounded-lg bg-gray-800 hover:bg-gray-700 transition flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-3 min-w-[44px] min-h-[44px] rounded-lg bg-gray-800 hover:bg-gray-700 transition flex items-center justify-center"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-gray-900">
            <div className="px-4 py-3 space-y-2">
              <Link
                href="/logs"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition min-h-[48px]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileText className="w-5 h-5" />
                <span>Live Logs</span>
              </Link>
              <Link
                href="/analytics"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition min-h-[48px]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <BarChart3 className="w-5 h-5" />
                <span>Analytics</span>
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition min-h-[48px]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
              <button
                onClick={() => {
                  setShowAddServer(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition min-h-[48px]"
              >
                <Plus className="w-5 h-5" />
                <span>Add Server</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        {error && (
          <div className="mb-4 p-3 md:p-4 rounded-lg bg-red-900/50 border border-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="flex-1 text-sm md:text-base">{error}</span>
            <button onClick={() => setError(null)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Bottom Sheet for mobile */}
        <BottomSheet
          isOpen={!!sheetApp}
          onClose={closeBottomSheet}
          app={sheetApp}
          server={sheetServer}
          onViewLogs={viewLogs}
          onRestart={restartApp}
          onStartStop={sendCommand}
          onSettings={openAppSettings}
          restartingApp={restartingApp}
          actionInProgress={actionInProgress}
        />

        {/* App Settings Modal */}
        {editingApp && (
          <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50">
            <div className="bg-gray-900 rounded-t-xl md:rounded-xl w-full max-w-md border-t md:border border-gray-700 max-h-[90vh] overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h2 className="font-bold">App Settings</h2>
                </div>
                <button
                  onClick={closeAppSettings}
                  className="p-2 min-w-[44px] min-h-[44px] rounded hover:bg-gray-700 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* PM2 Name (readonly) */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    PM2 Process Name
                  </label>
                  <div className="px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 font-mono text-sm">
                    {editingApp.pm2_name}
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    placeholder={editingApp.pm2_name}
                    value={appForm.display_name}
                    onChange={(e) => setAppForm({ ...appForm, display_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none transition text-base"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={appForm.url}
                    onChange={(e) => setAppForm({ ...appForm, url: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none transition text-base"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Category
                  </label>
                  <select
                    value={appForm.category}
                    onChange={(e) => setAppForm({ ...appForm, category: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none transition text-base"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notifications Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Notifications
                  </label>
                  <button
                    type="button"
                    onClick={() => setAppForm({ ...appForm, notifications_enabled: !appForm.notifications_enabled })}
                    className={`flex items-center gap-3 w-full px-4 py-4 rounded-lg border transition min-h-[56px] ${
                      appForm.notifications_enabled
                        ? "bg-green-900/30 border-green-700 text-green-400"
                        : "bg-gray-800 border-gray-700 text-gray-400"
                    }`}
                  >
                    {appForm.notifications_enabled ? (
                      <>
                        <Bell className="w-5 h-5" />
                        <span>Notifications enabled</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-5 h-5" />
                        <span>Notifications disabled</span>
                      </>
                    )}
                    <div
                      className={`ml-auto w-12 h-7 rounded-full p-1 transition ${
                        appForm.notifications_enabled ? "bg-green-600" : "bg-gray-600"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          appForm.notifications_enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>

                {/* Team Assignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    <span className="flex items-center gap-1">
                      <UsersRound className="w-4 h-4" />
                      Assign to Team
                    </span>
                  </label>
                  <select
                    value={appForm.team_id}
                    onChange={(e) => setAppForm({ ...appForm, team_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none transition text-base"
                  >
                    <option value="">No team assigned</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                        {team.teams_webhook_url && " (webhook)"}
                      </option>
                    ))}
                  </select>
                  {teams.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      <Link href="/settings" className="text-blue-400 hover:underline">
                        Create teams
                      </Link>
                      {" "}to assign apps for notifications
                    </p>
                  )}
                </div>

                {/* Team Notification Options */}
                {appForm.team_id && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-700">
                    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={appForm.notify_on_down}
                        onChange={(e) => setAppForm({ ...appForm, notify_on_down: e.target.checked })}
                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                      />
                      <span className="text-sm text-gray-300">Notify on app down</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={appForm.notify_on_restart}
                        onChange={(e) => setAppForm({ ...appForm, notify_on_restart: e.target.checked })}
                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                      />
                      <span className="text-sm text-gray-300">Notify on restart</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-4 border-t border-gray-700 flex gap-3 sticky bottom-0 bg-gray-900">
                <button
                  onClick={closeAppSettings}
                  className="flex-1 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition min-h-[48px] text-base font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAppSettings}
                  disabled={savingApp}
                  className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] text-base font-medium"
                >
                  {savingApp && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {viewingLogs && (
          <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50">
            <div className="bg-gray-900 rounded-t-xl md:rounded-xl w-full max-w-4xl max-h-[85vh] md:max-h-[80vh] border-t md:border border-gray-700 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <h2 className="font-bold truncate flex-1 mr-2">Logs: {viewingLogs.appName}</h2>
                <button
                  onClick={() => setViewingLogs(null)}
                  className="p-2 min-w-[44px] min-h-[44px] rounded hover:bg-gray-700 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <pre className="text-xs md:text-sm font-mono text-gray-300 whitespace-pre-wrap break-all">
                    {logs || "No logs available"}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Server Modal */}
        {showAddServer && (
          <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50">
            <div className="bg-gray-900 rounded-t-xl md:rounded-xl p-6 w-full max-w-md border-t md:border border-gray-700">
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
                    className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 min-h-[48px] text-base font-medium"
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
                    className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 mb-4 text-base"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddServer(false)}
                      className="flex-1 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 min-h-[48px] text-base font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addServer}
                      className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 min-h-[48px] text-base font-medium"
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
          <div className="text-center py-16 md:py-20">
            <Server className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-lg md:text-xl font-bold mb-2">No servers yet</h2>
            <p className="text-gray-400 mb-4 text-sm md:text-base">Add a server to start monitoring</p>
            <button
              onClick={() => setShowAddServer(true)}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 min-h-[48px] text-base font-medium"
            >
              Add Server
            </button>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {servers.map((server) => (
              <div
                key={server.id}
                className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden"
              >
                {/* Server Header */}
                <div className="px-4 py-3 bg-gray-800/50 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between">
                  <div className="flex items-center gap-3">
                    {isOnline(server.last_heartbeat) ? (
                      <Wifi className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h2 className="font-bold truncate">{server.name}</h2>
                      <p className="text-xs text-gray-400 truncate">
                        {server.hostname || server.ip_address || "Waiting for heartbeat..."}
                        {server.os && ` • ${server.os}`}
                      </p>
                    </div>
                  </div>
                  <HeartbeatCountdown lastHeartbeat={server.last_heartbeat} intervalSec={30} />
                </div>

                {/* Apps */}
                {server.apps.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No apps yet - waiting for agent heartbeat
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {server.apps.map((app) => (
                      <AppRow
                        key={app.id}
                        app={app}
                        server={server}
                        onOpenSheet={openBottomSheet}
                        onOpenSettings={openAppSettings}
                        onViewLogs={viewLogs}
                        onRestart={restartApp}
                        onStartStop={sendCommand}
                        restartingApp={restartingApp}
                        actionInProgress={actionInProgress}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Health Checks Section */}
        {healthChecks.length > 0 && (
          <div className="mt-6 md:mt-8">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold">Health Checks</h2>
              <span className="text-sm text-gray-400">({healthChecks.length})</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Group: Down first, then Up */}
              {healthChecks.map((check) => {
                const isDown = check.latest_status === "down";
                const isUp = check.latest_status === "up";
                const statusColor = isDown 
                  ? "bg-red-500" 
                  : isUp 
                    ? "bg-green-500" 
                    : "bg-gray-500";
                const statusEmoji = isDown ? "🔴" : isUp ? "🟢" : "⚪";
                const statusText = isDown ? "Down" : isUp ? "Up" : "Unknown";
                
                return (
                  <div
                    key={check.id}
                    className={`rounded-xl bg-gray-900 border overflow-hidden ${
                      isDown ? "border-red-700" : "border-gray-800"
                    }`}
                  >
                    {/* Header */}
                    <div className={`px-4 py-3 ${isDown ? "bg-red-900/30" : "bg-gray-800/50"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${statusColor} ${isDown ? "animate-pulse" : ""}`} />
                          <span className="font-medium truncate">{check.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          isDown 
                            ? "bg-red-900/50 text-red-400" 
                            : isUp 
                              ? "bg-green-900/50 text-green-400"
                              : "bg-gray-700 text-gray-400"
                        }`}>
                          {statusEmoji} {statusText}
                        </span>
                      </div>
                    </div>
                    
                    {/* Body */}
                    <div className="px-4 py-3 space-y-2">
                      {/* URL */}
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Globe className="w-4 h-4 flex-shrink-0" />
                        <a
                          href={check.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-blue-400 transition"
                        >
                          {check.url.replace(/https?:\/\//, "")}
                        </a>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                      </div>
                      
                      {/* Stats row */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-3">
                          {/* Response time */}
                          {check.latest_response_time_ms !== null && (
                            <span className={`flex items-center gap-1 ${
                              check.latest_response_time_ms > 1000 
                                ? "text-yellow-400" 
                                : check.latest_response_time_ms > 500 
                                  ? "text-orange-400" 
                                  : "text-green-400"
                            }`}>
                              ⚡ {check.latest_response_time_ms}ms
                            </span>
                          )}
                          
                          {/* Method */}
                          <span className="text-gray-500">{check.method}</span>
                        </div>
                        
                        {/* Last checked */}
                        {check.latest_checked_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(check.latest_checked_at).toLocaleTimeString([], { 
                              hour: "2-digit", 
                              minute: "2-digit" 
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      
      {/* Watchtower beacon animation - bottom right */}
      <div className="fixed bottom-6 right-6 opacity-30 hover:opacity-60 transition-opacity pointer-events-none hidden md:block">
        <WatchtowerBeacon />
      </div>
    </div>
  );
}
