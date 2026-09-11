import React, { useState, useEffect } from "react";
import {
  Bot,
  Activity,
  User,
  Package,
  ShoppingBag,
  Sliders,
  RefreshCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  AIAgentDashboardStats,
  AIAgentSettings,
  AIKnowledgeBase,
  AIAgentSession,
  AIOrder,
  AIAgentActivityLog,
} from "../../types.ts";
import { AIAgentOverview } from "./AIAgentOverview.tsx";
import { AIAgentSessions } from "./AIAgentSessions.tsx";
import { AIAgentKnowledge } from "./AIAgentKnowledge.tsx";
import { AIAgentOrders } from "./AIAgentOrders.tsx";
import { AIAgentSettingsView } from "./AIAgentSettingsView.tsx";

interface AIAgentTabProps {
  language: "ar" | "en";
  onOpenCustomerChat?: (phone: string) => void;
}

export const AIAgentTab: React.FC<AIAgentTabProps> = ({
  language,
  onOpenCustomerChat,
}) => {
  const isAr = language === "ar";
  const [activeSubView, setActiveSubView] = useState<
    "overview" | "sessions" | "knowledge" | "orders" | "settings"
  >("overview");

  // State
  const [stats, setStats] = useState<AIAgentDashboardStats | null>(null);
  const [settings, setSettings] = useState<AIAgentSettings | null>(null);
  const [knowledge, setKnowledge] = useState<AIKnowledgeBase | null>(null);
  const [sessions, setSessions] = useState<AIAgentSession[]>([]);
  const [orders, setOrders] = useState<AIOrder[]>([]);
  const [logs, setLogs] = useState<AIAgentActivityLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all initial data
  const fetchData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [
        statsRes,
        settingsRes,
        knowledgeRes,
        sessionsRes,
        ordersRes,
        logsRes,
      ] = await Promise.all([
        fetch("/api/ai-agent/status").then((r) => r.json()),
        fetch("/api/ai-agent/settings").then((r) => r.json()),
        fetch("/api/ai-agent/knowledge").then((r) => r.json()),
        fetch("/api/ai-agent/sessions").then((r) => r.json()),
        fetch("/api/ai-agent/orders").then((r) => r.json()),
        fetch("/api/ai-agent/logs").then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (settingsRes.success) setSettings(settingsRes.settings);
      if (knowledgeRes.success) setKnowledge(knowledgeRes.knowledge);
      if (sessionsRes.success) setSessions(sessionsRes.sessions || []);
      if (ordersRes.success) setOrders(ordersRes.orders || []);
      if (logsRes.success) setLogs(logsRes.logs || []);
    } catch (e) {
      console.error("Error fetching AI agent data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch real-time monitoring data (status, sessions, orders, logs) without wiping settings or knowledge
  const fetchLiveData = async () => {
    try {
      const [statsRes, sessionsRes, ordersRes, logsRes] = await Promise.all([
        fetch("/api/ai-agent/status").then((r) => r.json()),
        fetch("/api/ai-agent/sessions").then((r) => r.json()),
        fetch("/api/ai-agent/orders").then((r) => r.json()),
        fetch("/api/ai-agent/logs").then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (sessionsRes.success) setSessions(sessionsRes.sessions || []);
      if (ordersRes.success) setOrders(ordersRes.orders || []);
      if (logsRes.success) setLogs(logsRes.logs || []);
    } catch (e) {
      console.error("Error polling live telemetry:", e);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh ONLY live stats and logs every 10 seconds for real-time monitoring
    // Settings and knowledge remain stable and are not overwritten while user edits
    const interval = setInterval(() => {
      fetchLiveData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleToggleEnabled = async (enabled: boolean) => {
    if (!settings) return;
    try {
      const res = await fetch("/api/ai-agent/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        fetchLiveData();
      }
    } catch (e) {
      console.error("Error toggling AI agent enabled state:", e);
    }
  };

  const handleSaveSettings = async (updated: Partial<AIAgentSettings>) => {
    try {
      const res = await fetch("/api/ai-agent/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        if (data.settings.companyName) {
          setKnowledge((prev) =>
            prev ? { ...prev, companyName: data.settings.companyName } : prev
          );
        }
        fetchLiveData();
        return data.settings;
      } else {
        throw new Error(data.error || "Failed to update settings");
      }
    } catch (e) {
      console.error("Error updating settings:", e);
      throw e;
    }
  };

  const handleSaveKnowledge = async (updated: Partial<AIKnowledgeBase>) => {
    try {
      const res = await fetch("/api/ai-agent/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (data.success) {
        setKnowledge(data.knowledge);
        if (data.knowledge.companyName) {
          setSettings((prev) =>
            prev ? { ...prev, companyName: data.knowledge.companyName } : prev
          );
        }
        fetchLiveData();
        return data.knowledge;
      } else {
        throw new Error(data.error || "Failed to update knowledge base");
      }
    } catch (e) {
      console.error("Error updating knowledge base:", e);
      throw e;
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: AIOrder["status"]
  ) => {
    try {
      const res = await fetch(`/api/ai-agent/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData(true);
      }
    } catch (e) {
      console.error("Error updating order status:", e);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/ai-agent/orders/${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchData(true);
      }
    } catch (e) {
      console.error("Error deleting order:", e);
    }
  };

  const handleClearCancelledOrders = async () => {
    try {
      const res = await fetch("/api/ai-agent/orders/clear-cancelled", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        fetchData(true);
      }
    } catch (e) {
      console.error("Error clearing cancelled orders:", e);
    }
  };

  if (loading || !settings || !knowledge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
        <span className="text-xs">
          {isAr
            ? "جاري تحميل بيانات وكيل المبيعات الذكي..."
            : "Loading AI Sales Agent system..."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Sub-bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            {
              id: "overview",
              label: isAr ? "نظرة عامة والمحاكي" : "Overview & Simulator",
              icon: Activity,
            },
            {
              id: "sessions",
              label: isAr
                ? `ذاكرة العملاء والمحادثات (${sessions.length})`
                : `Memory & Sessions (${sessions.length})`,
              icon: User,
            },
            {
              id: "knowledge",
              label: isAr ? "كتالوج المنتجات والمعرفة" : "Catalog & Knowledge",
              icon: Package,
            },
            {
              id: "orders",
              label: isAr
                ? `الطلبات المستخرجة (${orders.length})`
                : `Orders (${orders.length})`,
              icon: ShoppingBag,
            },
            {
              id: "settings",
              label: isAr ? "قواعد وإعدادات الوكيل" : "Rules & Settings",
              icon: Sliders,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubView === tab.id;
            return (
              <button
                key={tab.id}
                id={`ai-subtab-${tab.id}`}
                onClick={() => setActiveSubView(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/20"
                    : "bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Refresh button */}
        <button
          onClick={() => fetchData()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition self-start sm:self-auto shrink-0"
          title={isAr ? "تحديث البيانات الآن" : "Refresh data"}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-teal-400 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          <span>{isAr ? "تحديث فوري" : "Refresh"}</span>
        </button>
      </div>

      {/* Sub-view Content */}
      {activeSubView === "overview" && (
        <AIAgentOverview
          stats={stats}
          settings={settings}
          knowledge={knowledge}
          logs={logs}
          language={language}
          onToggleEnabled={handleToggleEnabled}
          onNavigateToTab={(tab) => setActiveSubView(tab)}
          onRefresh={() => fetchData(true)}
        />
      )}

      {activeSubView === "sessions" && (
        <AIAgentSessions
          sessions={sessions}
          language={language}
          onRefresh={() => fetchData(true)}
        />
      )}

      {activeSubView === "knowledge" && (
        <AIAgentKnowledge
          knowledge={knowledge}
          language={language}
          onSaveKnowledge={handleSaveKnowledge}
        />
      )}

      {activeSubView === "orders" && (
        <AIAgentOrders
          orders={orders}
          language={language}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onDeleteOrder={handleDeleteOrder}
          onClearCancelledOrders={handleClearCancelledOrders}
          onOpenCustomerChat={(phone) => {
            if (onOpenCustomerChat) {
              onOpenCustomerChat(phone);
            } else {
              setActiveSubView("sessions");
            }
          }}
        />
      )}

      {activeSubView === "settings" && (
        <AIAgentSettingsView
          settings={settings}
          language={language}
          onSaveSettings={handleSaveSettings}
        />
      )}
    </div>
  );
};
