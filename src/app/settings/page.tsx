"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Settings,
  Users,
  UsersRound,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  X,
  Activity,
  Pencil,
} from "lucide-react";

type Tab = "general" | "teams" | "users" | "healthchecks";

interface Team {
  id: string;
  name: string;
  description: string | null;
  teams_webhook_url: string | null;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "system_admin" | "team_lead" | "user";
  is_active: boolean;
  created_at: string;
}

interface HealthCheck {
  id: string;
  name: string;
  url: string;
  method: "GET" | "HEAD";
  expected_status: number;
  timeout_ms: number;
  is_enabled: boolean;
  notify_on_down: boolean;
  team_id: string | null;
  status: "up" | "down" | "unknown";
  last_checked_at: string | null;
  last_response_time_ms: number | null;
  created_at: string;
}

function GeneralSettings({ teams, users }: { teams: Team[]; users: User[] }) {
  const [defaultWebhook, setDefaultWebhook] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.data?.default_teams_webhook) {
          setDefaultWebhook(json.data.default_teams_webhook);
        }
      })
      .catch(() => {});
  }, []);

  const saveWebhook = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_teams_webhook: defaultWebhook }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
        <h2 className="text-lg font-bold mb-4">Default Teams Webhook</h2>
        <p className="text-gray-400 text-sm mb-4">
          This webhook receives alerts for apps not assigned to a specific team,
          or when a team doesn&apos;t have its own webhook configured.
        </p>
        <div className="space-y-3">
          <input
            type="url"
            value={defaultWebhook}
            onChange={(e) => setDefaultWebhook(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-base"
          />
          <button
            onClick={saveWebhook}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Webhook"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
        <h2 className="text-lg font-bold mb-4">Statistics</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-400">{teams.length}</p>
            <p className="text-sm text-gray-400">Teams</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold text-green-400">{users.length}</p>
            <p className="text-sm text-gray-400">Users</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
        <h2 className="text-lg font-bold mb-4">How Notifications Work</h2>
        <div className="text-sm text-gray-400 space-y-2">
          <p>📱 When an app goes down or recovers:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Check if app is assigned to a team</li>
            <li>If team has a webhook → send to team webhook</li>
            <li>Otherwise → send to default webhook (above)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function HealthChecksTab({ teams }: { teams: Team[] }) {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCheck, setEditingCheck] = useState<HealthCheck | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formMethod, setFormMethod] = useState<"GET" | "HEAD">("GET");
  const [formExpectedStatus, setFormExpectedStatus] = useState(200);
  const [formTimeout, setFormTimeout] = useState(5000);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formNotifyOnDown, setFormNotifyOnDown] = useState(true);
  const [formTeamId, setFormTeamId] = useState<string>("");

  const fetchHealthChecks = useCallback(async () => {
    try {
      const res = await fetch("/api/health-checks");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setHealthChecks(json.data || []);
      }
    } catch {
      setError("Failed to fetch health checks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthChecks();
  }, [fetchHealthChecks]);

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormMethod("GET");
    setFormExpectedStatus(200);
    setFormTimeout(5000);
    setFormEnabled(true);
    setFormNotifyOnDown(true);
    setFormTeamId("");
    setEditingCheck(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (check: HealthCheck) => {
    setEditingCheck(check);
    setFormName(check.name);
    setFormUrl(check.url);
    setFormMethod(check.method);
    setFormExpectedStatus(check.expected_status);
    setFormTimeout(check.timeout_ms);
    setFormEnabled(check.is_enabled);
    setFormNotifyOnDown(check.notify_on_down);
    setFormTeamId(check.team_id || "");
    setShowModal(true);
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith("http://") || url.startsWith("https://");
    } catch {
      return false;
    }
  };

  const saveHealthCheck = async () => {
    if (!formName.trim() || !formUrl.trim()) return;
    if (!validateUrl(formUrl)) {
      setError("Invalid URL format. Must start with http:// or https://");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: formName,
      url: formUrl,
      method: formMethod,
      expected_status: formExpectedStatus,
      timeout_ms: formTimeout,
      is_enabled: formEnabled,
      notify_on_down: formNotifyOnDown,
      team_id: formTeamId || null,
    };

    try {
      const res = editingCheck
        ? await fetch(`/api/health-checks/${editingCheck.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/health-checks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setShowModal(false);
        resetForm();
        fetchHealthChecks();
      }
    } catch {
      setError("Failed to save health check");
    } finally {
      setSaving(false);
    }
  };

  const deleteHealthCheck = async (id: string) => {
    try {
      const res = await fetch(`/api/health-checks/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        fetchHealthChecks();
      }
    } catch {
      setError("Failed to delete health check");
    }
    setDeleteConfirm(null);
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "up":
        return <span className="text-green-400">🟢</span>;
      case "down":
        return <span className="text-red-400">🔴</span>;
      default:
        return <span className="text-gray-400">⚪</span>;
    }
  };

  const formatLastChecked = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-900/50 border border-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-800 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Health Check Button */}
      <button
        onClick={openCreateModal}
        className="w-full py-4 sm:py-3 rounded-xl border-2 border-dashed border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white flex items-center justify-center gap-2 transition min-h-[56px]"
      >
        <Plus className="w-5 h-5" />
        Add Health Check
      </button>

      {/* Health Checks List */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-bold">Health Checks ({healthChecks.length})</h2>
          <button
            onClick={fetchHealthChecks}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {healthChecks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No health checks configured</p>
            <p className="text-sm">Add a health check to monitor external endpoints</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {healthChecks.map((check) => (
              <div
                key={check.id}
                className="px-4 py-4 sm:py-3 hover:bg-gray-800/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="text-xl">{getStatusIndicator(check.status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{check.name}</span>
                        {!check.is_enabled && (
                          <span className="text-xs px-2 py-0.5 bg-gray-700 rounded">Disabled</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{check.url}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                        <span>{check.method}</span>
                        <span>•</span>
                        <span>Last: {formatLastChecked(check.last_checked_at)}</span>
                        {check.last_response_time_ms !== null && (
                          <>
                            <span>•</span>
                            <span>{check.last_response_time_ms}ms</span>
                          </>
                        )}
                        {check.team_id && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400">
                              {teams.find(t => t.id === check.team_id)?.name || "Team"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(check)}
                      className="p-3 sm:p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Pencil className="w-5 h-5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ id: check.id, name: check.name })}
                      className="p-3 sm:p-2 rounded-lg hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Legend */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
        <h3 className="text-sm font-medium mb-3">Status Indicators</h3>
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          <span>🟢 Up - responding correctly</span>
          <span>🔴 Down - not responding or wrong status</span>
          <span>⚪ Unknown - not checked yet</span>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
          <div className="bg-gray-900 rounded-t-xl sm:rounded-xl p-6 w-full sm:max-w-lg border-t sm:border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingCheck ? "Edit Health Check" : "Add Health Check"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Production API"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  URL *
                </label>
                <input
                  type="url"
                  placeholder="https://api.example.com/health"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Method
                  </label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as "GET" | "HEAD")}
                    className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                  >
                    <option value="GET">GET</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Expected Status
                  </label>
                  <input
                    type="number"
                    value={formExpectedStatus}
                    onChange={(e) => setFormExpectedStatus(parseInt(e.target.value) || 200)}
                    className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  value={formTimeout}
                  onChange={(e) => setFormTimeout(parseInt(e.target.value) || 5000)}
                  className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Team (optional)
                </label>
                <select
                  value={formTeamId}
                  onChange={(e) => setFormTeamId(e.target.value)}
                  className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                >
                  <option value="">No team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Alerts will be sent to team&apos;s webhook if configured
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Enabled</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formNotifyOnDown}
                    onChange={(e) => setFormNotifyOnDown(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Notify when down</span>
                </label>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 py-3 sm:py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveHealthCheck}
                  disabled={!formName.trim() || !formUrl.trim() || saving}
                  className="flex-1 py-3 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                >
                  {saving ? "Saving..." : editingCheck ? "Save Changes" : "Add Health Check"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
          <div className="bg-gray-900 rounded-t-xl sm:rounded-xl p-6 w-full sm:max-w-md border-t sm:border border-gray-700">
            <h2 className="text-xl font-bold mb-2">Delete Health Check?</h2>
            <p className="text-gray-400 mb-4">
              Are you sure you want to delete &quot;{deleteConfirm.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 sm:py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteHealthCheck(deleteConfirm.id)}
                className="flex-1 py-3 sm:py-2 rounded-lg bg-red-600 hover:bg-red-700 transition min-h-[48px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Team form state
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamWebhook, setTeamWebhook] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<"system_admin" | "team_lead" | "user">("user");
  const [savingUser, setSavingUser] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "team" | "user"; id: string; name: string } | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setTeams(json.data);
      }
    } catch {
      setError("Failed to fetch teams");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setUsers(json.data);
      }
    } catch {
      setError("Failed to fetch users");
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTeams(), fetchUsers()]);
      setLoading(false);
    };
    loadData();
  }, [fetchTeams, fetchUsers]);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    setSavingTeam(true);
    setError(null);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          teams_webhook_url: teamWebhook || null,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setTeamName("");
        setTeamWebhook("");
        setShowTeamForm(false);
        fetchTeams();
      }
    } catch {
      setError("Failed to create team");
    } finally {
      setSavingTeam(false);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        fetchTeams();
      }
    } catch {
      setError("Failed to delete team");
    }
    setDeleteConfirm(null);
  };

  const createUser = async () => {
    if (!userEmail.trim()) return;
    setSavingUser(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          name: userName || null,
          role: userRole,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setNewUserPassword(json.tempPassword);
        setUserEmail("");
        setUserName("");
        setUserRole("user");
        fetchUsers();
      }
    } catch {
      setError("Failed to create user");
    } finally {
      setSavingUser(false);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        fetchUsers();
      }
    } catch {
      setError("Failed to delete user");
    }
    setDeleteConfirm(null);
  };

  const copyPassword = () => {
    if (newUserPassword) {
      navigator.clipboard.writeText(newUserPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    { id: "general" as Tab, label: "General", icon: Settings },
    { id: "teams" as Tab, label: "Teams", icon: UsersRound },
    { id: "users" as Tab, label: "Users", icon: Users },
    { id: "healthchecks" as Tab, label: "Health Checks", icon: Activity },
  ];

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
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-xs text-gray-400">Manage teams, users, and preferences</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-900/50 border border-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-800 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs - horizontally scrollable on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
          <div className="flex gap-1 border-b border-gray-800 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap min-h-[48px] ${
                  activeTab === tab.id
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* General Tab */}
        {activeTab === "general" && (
          <GeneralSettings teams={teams} users={users} />
        )}

        {/* Teams Tab */}
        {activeTab === "teams" && (
          <div className="space-y-6">
            {/* Create Team Form */}
            {showTeamForm ? (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-6">
                <h2 className="text-lg font-bold mb-4">Create Team</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., DevOps, Frontend Team"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      MS Teams Webhook URL (optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://outlook.office.com/webhook/..."
                      value={teamWebhook}
                      onChange={(e) => setTeamWebhook(e.target.value)}
                      className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Used for sending alerts to Microsoft Teams channel
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowTeamForm(false);
                        setTeamName("");
                        setTeamWebhook("");
                      }}
                      className="flex-1 py-3 sm:py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition min-h-[48px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createTeam}
                      disabled={!teamName.trim() || savingTeam}
                      className="flex-1 py-3 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                    >
                      {savingTeam ? "Creating..." : "Create Team"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTeamForm(true)}
                className="w-full py-4 sm:py-3 rounded-xl border-2 border-dashed border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white flex items-center justify-center gap-2 transition min-h-[56px]"
              >
                <Plus className="w-5 h-5" />
                Create Team
              </button>
            )}

            {/* Teams List */}
            <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                <h2 className="font-bold">Teams ({teams.length})</h2>
              </div>
              {teams.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <UsersRound className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No teams yet</p>
                  <p className="text-sm">Create a team to organize app assignments</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="px-4 py-4 sm:py-3 flex items-center justify-between hover:bg-gray-800/30 gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{team.name}</div>
                        {team.teams_webhook_url && (
                          <div className="text-xs text-green-400 flex items-center gap-1">
                            ✓ MS Teams webhook configured
                          </div>
                        )}
                        {team.description && (
                          <div className="text-xs text-gray-500 truncate">{team.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => setDeleteConfirm({ type: "team", id: team.id, name: team.name })}
                        className="p-3 sm:p-2 rounded-lg hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Password Modal - full screen on mobile */}
            {newUserPassword && (
              <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
                <div className="bg-gray-900 rounded-t-xl sm:rounded-xl p-6 w-full sm:max-w-md border-t sm:border border-gray-700 max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">User Created</h2>
                  <p className="text-gray-400 mb-2">
                    Temporary password (share with user):
                  </p>
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 bg-gray-800 p-3 rounded-lg font-mono text-sm break-all">
                      {newUserPassword}
                    </div>
                    <button
                      onClick={copyPassword}
                      className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition min-w-[48px] min-h-[48px] flex items-center justify-center"
                    >
                      {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-yellow-400 text-sm mb-4">
                    ⚠️ This password won&apos;t be shown again!
                  </p>
                  <button
                    onClick={() => {
                      setNewUserPassword(null);
                      setShowUserForm(false);
                    }}
                    className="w-full py-3 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition min-h-[48px]"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Create User Form */}
            {showUserForm && !newUserPassword ? (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-6">
                <h2 className="text-lg font-bold mb-4">Invite User</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Role
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as "system_admin" | "team_lead" | "user")}
                      className="w-full px-4 py-3 sm:py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-base"
                    >
                      <option value="system_admin">System Admin - Full access</option>
                      <option value="team_lead">Team Lead - Manage team apps</option>
                      <option value="user">User - View team apps</option>
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowUserForm(false);
                        setUserEmail("");
                        setUserName("");
                        setUserRole("user");
                      }}
                      className="flex-1 py-3 sm:py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition min-h-[48px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createUser}
                      disabled={!userEmail.trim() || savingUser}
                      className="flex-1 py-3 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                    >
                      {savingUser ? "Creating..." : "Invite User"}
                    </button>
                  </div>
                </div>
              </div>
            ) : !newUserPassword && (
              <button
                onClick={() => setShowUserForm(true)}
                className="w-full py-4 sm:py-3 rounded-xl border-2 border-dashed border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white flex items-center justify-center gap-2 transition min-h-[56px]"
              >
                <Plus className="w-5 h-5" />
                Invite User
              </button>
            )}

            {/* Users List */}
            <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                <h2 className="font-bold">Users ({users.length})</h2>
              </div>
              {users.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No users yet</p>
                  <p className="text-sm">Invite users to manage the dashboard</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="px-4 py-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-800/30 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold shrink-0">
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {user.name || user.email}
                            {!user.is_active && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-gray-700 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 truncate">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 ml-[52px] sm:ml-0">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            user.role === "system_admin"
                              ? "bg-purple-900/50 text-purple-400"
                              : user.role === "team_lead"
                              ? "bg-blue-900/50 text-blue-400"
                              : "bg-gray-700 text-gray-400"
                          }`}
                        >
                          {user.role}
                        </span>
                        <button
                          onClick={() => setDeleteConfirm({ type: "user", id: user.id, name: user.name || user.email })}
                          className="p-3 sm:p-2 rounded-lg hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Health Checks Tab */}
        {activeTab === "healthchecks" && (
          <HealthChecksTab teams={teams} />
        )}

        {/* Delete Confirmation Modal - full screen on mobile */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
            <div className="bg-gray-900 rounded-t-xl sm:rounded-xl p-6 w-full sm:max-w-md border-t sm:border border-gray-700">
              <h2 className="text-xl font-bold mb-2">Delete {deleteConfirm.type}?</h2>
              <p className="text-gray-400 mb-4">
                Are you sure you want to delete &quot;{deleteConfirm.name}&quot;? This action cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 sm:py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    deleteConfirm.type === "team"
                      ? deleteTeam(deleteConfirm.id)
                      : deleteUser(deleteConfirm.id)
                  }
                  className="flex-1 py-3 sm:py-2 rounded-lg bg-red-600 hover:bg-red-700 transition min-h-[48px]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
