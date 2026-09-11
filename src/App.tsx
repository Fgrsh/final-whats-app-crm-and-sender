/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  FileEdit,
  Sliders,
  PlayCircle,
  Shield,
  Sparkles,
  Calendar,
  UserCheck,
  Layers,
  Bot,
} from "lucide-react";
import { Header } from "./components/Header.tsx";
import { DashboardTab } from "./components/DashboardTab.tsx";
import { CrmTab } from "./components/CrmTab.tsx";
import { ContactsTab } from "./components/ContactsTab.tsx";
import { ComposerTab } from "./components/ComposerTab.tsx";
import { SettingsTab } from "./components/SettingsTab.tsx";
import { CampaignTab } from "./components/CampaignTab.tsx";
import { AIAgentTab } from "./components/ai-agent/AIAgentTab.tsx";
import { ConnectionModal } from "./components/ConnectionModal.tsx";
import { SingleSendModal } from "./components/SingleSendModal.tsx";
import { SystemBackupModal } from "./components/SystemBackupModal.tsx";
import type {
  Contact,
  CampaignConfig,
  QueueProgress,
  LogEntry,
  WhatsAppStatus,
  WhatsAppAccountInfo,
  CampaignItem,
  MessageTemplate,
} from "./types.ts";
import { safeFetchJson } from "./utils/api.ts";

export default function App() {
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "contacts" | "crm" | "ai_agent" | "composer" | "settings" | "campaign"
  >("dashboard");
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSingleSendOpen, setIsSingleSendOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // States for Multi-Account WhatsApp
  const [accounts, setAccounts] = useState<WhatsAppAccountInfo[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>("default");

  // States for Multi-Campaigns
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>("default");

  // Saved Templates & Attachments State
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  // States from Backend for Active Campaign
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [config, setConfig] = useState<CampaignConfig>({
    template:
      "مرحباً {name}، نأمل أن تكون بأفضل حال. بخصوص {notes}، يسعدنا تواصلك معنا من شركة {company}.",
    useAI: true,
    aiInstruction: "صياغة ودودة واحترافية بدون مبالغة مع تنويع الكلمات",
    aiTone: "friendly",
    language: "ar",
    minDelay: 6,
    maxDelay: 14,
    sendMethod: "baileys",
    appendTimestampAndCode: true,
    enableDailyLimit: true,
    dailyLimit: 150,
    enableBatchPause: true,
    batchSize: 10,
    batchPauseDuration: 200,
    attachment: null,
  });
  const [progress, setProgress] = useState<QueueProgress>({
    isRunning: false,
    isPaused: false,
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    currentIndex: 0,
    sentToday: 0,
    dailyLimit: 150,
    isWaitingForNextDay: false,
    currentDayDate: new Date().toISOString().slice(0, 10),
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Refs for tracking active configuration edits and preventing stale polling overwrites
  const configRef = useRef<CampaignConfig>(config);
  const lastConfigEditTimeRef = useRef<number>(0);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Ref to track if initial auto-restore has been attempted
  const hasCheckedAutoRestoreRef = useRef(false);

  // Fetch WhatsApp Accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const data = await safeFetchJson<{ success: boolean; accounts: WhatsAppAccountInfo[] }>("/api/whatsapp/accounts");
      if (data && data.accounts) {
        setAccounts(data.accounts);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch WhatsApp status
  const fetchWhatsAppStatus = useCallback(async () => {
    const data = await safeFetchJson<WhatsAppStatus>("/api/whatsapp/status");
    if (data) {
      setWaStatus(data);
    }
  }, []);

  // Ref to track cached campaigns signature to avoid blocking localStorage calls
  const lastCampaignsSignatureRef = useRef<string>("");
  const isRunningRef = useRef(false);
  useEffect(() => {
    isRunningRef.current = progress.isRunning && !progress.isPaused;
  }, [progress.isRunning, progress.isPaused]);

  // Fetch Campaigns List
  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await safeFetchJson<{
        success: boolean;
        activeCampaignId: string;
        campaigns: CampaignItem[];
      }>("/api/campaigns");

      if (data && data.campaigns && data.campaigns.length > 0) {
        setCampaigns((prev) => {
          if (prev.length !== data.campaigns.length) return data.campaigns;
          const prevSig = prev.map((c) => `${c.id}:${c.status}:${c.contacts?.length || 0}`).join("|");
          const nextSig = data.campaigns.map((c) => `${c.id}:${c.status}:${c.contacts?.length || 0}`).join("|");
          return prevSig !== nextSig ? data.campaigns : prev;
        });

        if (data.activeCampaignId) {
          setActiveCampaignId((prev) => (prev !== data.activeCampaignId ? data.activeCampaignId : prev));
        }

        // Only save snapshot when campaign count or status actually changed, asynchronously
        const currentSig = data.campaigns.map((c) => `${c.id}:${c.status}:${c.contacts?.length || 0}`).join("|");
        if (currentSig !== lastCampaignsSignatureRef.current) {
          lastCampaignsSignatureRef.current = currentSig;
          setTimeout(() => {
            try {
              localStorage.setItem("wa_campaigns_cache", JSON.stringify(data.campaigns));
            } catch {
              // ignore
            }
          }, 50);
        }
      } else if (!hasCheckedAutoRestoreRef.current) {
        // Container restart recovery: check if we have cached campaigns in localStorage
        hasCheckedAutoRestoreRef.current = true;
        try {
          const cached = localStorage.getItem("wa_campaigns_cache");
          if (cached) {
            const parsedCamps = JSON.parse(cached);
            if (Array.isArray(parsedCamps) && parsedCamps.length > 0) {
              console.log("Restoring cached campaigns to server after container reload...");
              for (const camp of parsedCamps) {
                await fetch("/api/campaigns", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: camp.name,
                    whatsappAccountId: camp.whatsappAccountId,
                    contacts: camp.contacts,
                    config: camp.config,
                  }),
                });
              }
            }
          }
        } catch (e) {
          console.error("Auto restore campaigns error:", e);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Campaign Status with smart reference preservation to avoid unnecessary re-renders
  const fetchCampaignStatus = useCallback(async () => {
    const data = await safeFetchJson<any>("/api/campaign/status");
    if (data) {
      if (data.contacts && Array.isArray(data.contacts)) {
        setContacts((prev) => {
          if (prev.length !== data.contacts.length) return data.contacts;
          // Check if any contact status or phone changed
          let changed = false;
          for (let i = 0; i < prev.length; i++) {
            if (prev[i].id !== data.contacts[i].id || prev[i].status !== data.contacts[i].status) {
              changed = true;
              break;
            }
          }
          return changed ? data.contacts : prev;
        });
      }
      if (data.config) {
        // Protect user's active configuration edits from being overwritten by stale polling responses
        if (Date.now() - lastConfigEditTimeRef.current > 4000) {
          setConfig((prev) => {
            const prevKey = `${prev.minDelay}-${prev.maxDelay}-${prev.dailyLimit}-${prev.useAI}-${prev.template}`;
            const nextKey = `${data.config.minDelay}-${data.config.maxDelay}-${data.config.dailyLimit}-${data.config.useAI}-${data.config.template}`;
            if (prevKey !== nextKey) {
              configRef.current = data.config;
              return data.config;
            }
            return prev;
          });
        }
      }
      if (data.progress) {
        setProgress((prev) => {
          if (
            prev.isRunning !== data.progress.isRunning ||
            prev.isPaused !== data.progress.isPaused ||
            prev.sent !== data.progress.sent ||
            prev.failed !== data.progress.failed ||
            prev.pending !== data.progress.pending ||
            prev.currentIndex !== data.progress.currentIndex ||
            prev.sentToday !== data.progress.sentToday
          ) {
            return data.progress;
          }
          return prev;
        });
      }
      if (data.logs && Array.isArray(data.logs)) {
        setLogs((prev) => {
          if (prev.length !== data.logs.length) return data.logs;
          if (prev[0]?.id !== data.logs[0]?.id) return data.logs;
          return prev;
        });
      }
      if (data.campaignId) {
        setActiveCampaignId((prev) => (prev !== data.campaignId ? data.campaignId : prev));
      }
    }
  }, []);

  // Fetch Saved Message Templates & Media Library
  const fetchTemplates = useCallback(async () => {
    try {
      const data = await safeFetchJson<{ success: boolean; templates: MessageTemplate[] }>("/api/templates");
      if (data && data.templates) {
        setTemplates(data.templates);
      }
    } catch {
      // ignore
    }
  }, []);

  // Adaptive background polling: Fast (2.5s) ONLY when campaign is running, calm (8s) when idle
  useEffect(() => {
    fetchAccounts();
    fetchWhatsAppStatus();
    fetchCampaigns();
    fetchCampaignStatus();
    fetchTemplates();

    // Fast timer for active campaigns
    const fastStatusInterval = setInterval(() => {
      if (isRunningRef.current) {
        fetchCampaignStatus();
      }
    }, 2500);

    // Calm timer for idle status & WhatsApp status
    const calmStatusInterval = setInterval(() => {
      if (!isRunningRef.current) {
        fetchCampaignStatus();
      }
      fetchWhatsAppStatus();
    }, 7000);

    // Infrequent timer for accounts, campaigns, and templates
    const slowMetaInterval = setInterval(() => {
      fetchAccounts();
      fetchCampaigns();
      fetchTemplates();
    }, 12000);

    return () => {
      clearInterval(fastStatusInterval);
      clearInterval(calmStatusInterval);
      clearInterval(slowMetaInterval);
    };
  }, [fetchAccounts, fetchWhatsAppStatus, fetchCampaigns, fetchCampaignStatus, fetchTemplates]);

  // Actions for Accounts
  const handleConnectWhatsApp = async (phoneNumber?: string) => {
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (data.state) {
        setWaStatus(data.state);
      }
      fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      await fetch("/api/whatsapp/disconnect", { method: "POST" });
      await fetchWhatsAppStatus();
      await fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnectAccount = async (accId: string, phone?: string) => {
    try {
      await fetch(`/api/whatsapp/accounts/${accId}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      await fetchAccounts();
      await fetchWhatsAppStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnectAccount = async (accId: string) => {
    try {
      await fetch(`/api/whatsapp/accounts/${accId}/disconnect`, { method: "POST" });
      await fetchAccounts();
      await fetchWhatsAppStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAccount = async (
    name: string,
    phoneNumber?: string,
    autoConnect: boolean = true
  ) => {
    try {
      const res = await fetch("/api/whatsapp/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phoneNumber, autoConnect }),
      });
      const data = await res.json();
      if (data.success && data.account) {
        setActiveAccountId(data.account.id);
        await fetchAccounts();
        await fetchWhatsAppStatus();
        return data.account;
      }
      await fetchAccounts();
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleDeleteAccount = async (accId: string) => {
    try {
      const res = await fetch(`/api/whatsapp/accounts/${accId}`, { method: "DELETE" });
      const data = await res.json();
      if (data && data.accounts) {
        setAccounts(data.accounts);
      }
      if (activeAccountId === accId) {
        setActiveAccountId("default");
      }
      await fetchAccounts();
      await fetchWhatsAppStatus();
    } catch (e) {
      console.error("Failed to delete account:", e);
    }
  };

  // Actions for Campaigns
  const handleSelectCampaign = async (campId: string) => {
    try {
      setActiveCampaignId(campId);
      await fetch(`/api/campaigns/${campId}/select`, { method: "POST" });
      await fetchCampaignStatus();
      await fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCampaign = async (name: string, whatsappAccountId?: string) => {
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          whatsappAccountId: whatsappAccountId || "default",
          config,
        }),
      });
      const data = await res.json();
      if (data.success && data.campaign) {
        setActiveCampaignId(data.campaign.id);
      }
      await fetchCampaigns();
      await fetchCampaignStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCampaign = async (campId: string) => {
    try {
      await fetch(`/api/campaigns/${campId}`, { method: "DELETE" });
      await fetchCampaigns();
      await fetchCampaignStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignCampaignAccount = async (campId: string, whatsappAccountId: string) => {
    try {
      await fetch(`/api/campaigns/${campId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappAccountId }),
      });
      await fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreCampaignBackup = async (backup: any) => {
    try {
      const res = await fetch(`/api/campaigns/${activeCampaignId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup),
      });
      if (res.ok) {
        await fetchCampaignStatus();
        await fetchCampaigns();
        alert(isAr ? "تم استرجاع بيانات الحملة بنجاح!" : "Campaign restored successfully!");
      }
    } catch (e) {
      console.error("Error restoring campaign:", e);
    }
  };

  // Manage Message Templates & Attachments
  const handleSaveTemplate = async (name: string, isNew: boolean = true, templateId?: string) => {
    try {
      const payload = {
        name,
        template: config.template,
        attachment: config.attachment || null,
        aiInstruction: config.aiInstruction,
        aiTone: config.aiTone,
        appendTimestampAndCode: config.appendTimestampAndCode,
      };
      let res;
      if (isNew || !templateId) {
        res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/templates/${templateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (data && data.success) {
        await fetchTemplates();
        if (data.template) {
          handleChangeConfig({
            templateId: data.template.id,
            templateName: data.template.name,
          });
        }
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data && data.success) {
        await fetchTemplates();
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const handleSelectTemplate = (selectedTpl: MessageTemplate) => {
    handleChangeConfig({
      template: selectedTpl.template,
      attachment: selectedTpl.attachment || null,
      aiInstruction: selectedTpl.aiInstruction ?? config.aiInstruction,
      aiTone: selectedTpl.aiTone ?? config.aiTone,
      templateId: selectedTpl.id,
      templateName: selectedTpl.name,
    });
  };

  const handleAssignCampaignTemplate = async (campaignId: string, selectedTpl: MessageTemplate) => {
    handleChangeConfig({
      template: selectedTpl.template,
      attachment: selectedTpl.attachment || null,
      aiInstruction: selectedTpl.aiInstruction ?? config.aiInstruction,
      aiTone: selectedTpl.aiTone ?? config.aiTone,
      templateId: selectedTpl.id,
      templateName: selectedTpl.name,
    });
    try {
      await fetch(`/api/campaigns/${campaignId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTpl.template,
          attachment: selectedTpl.attachment || null,
          useAI: config.useAI,
          aiInstruction: selectedTpl.aiInstruction ?? "",
          aiTone: selectedTpl.aiTone ?? "friendly",
          templateId: selectedTpl.id,
          templateName: selectedTpl.name,
        }),
      });
    } catch (err) {
      console.error("Failed to assign template to campaign:", err);
    }
  };

  // Contacts Management Actions
  const handleSetContacts = async (newContacts: Contact[]) => {
    setContacts(newContacts);
    try {
      await fetch("/api/campaign/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: newContacts }),
      });
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddBatchContacts = async (batch: Contact[], groupName: string) => {
    try {
      const res = await fetch("/api/campaign/contacts/group/add-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: batch, groupName }),
      });
      const data = await res.json();
      if (data.success && data.contacts) {
        setContacts(data.contacts);
      } else {
        const merged = [...contacts];
        for (const c of batch) {
          const idx = merged.findIndex((m) => m.phone === c.phone);
          const item = { ...c, groupName: groupName || c.groupName || "افتراضي" };
          if (idx >= 0) merged[idx] = item;
          else merged.push(item);
        }
        setContacts(merged);
        handleSetContacts(merged);
      }
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error("Error adding batch contacts:", e);
    }
  };

  const handleDeleteGroup = async (groupName: string) => {
    try {
      const res = await fetch("/api/campaign/contacts/group/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName }),
      });
      const data = await res.json();
      if (data.success && data.contacts) {
        setContacts(data.contacts);
      }
      fetchCampaignStatus();
    } catch (e) {
      console.error("Error deleting group:", e);
    }
  };

  const handleResetGroup = async (groupName: string) => {
    try {
      const res = await fetch("/api/campaign/contacts/group/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName }),
      });
      const data = await res.json();
      if (data.success && data.contacts) {
        setContacts(data.contacts);
      }
      fetchCampaignStatus();
    } catch (e) {
      console.error("Error resetting group:", e);
    }
  };

  const handleRenameGroup = async (oldName: string, newName: string) => {
    try {
      const res = await fetch("/api/campaign/contacts/group/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json();
      if (data.success && data.contacts) {
        setContacts(data.contacts);
      }
      fetchCampaignStatus();
    } catch (e) {
      console.error("Error renaming group:", e);
    }
  };

  const handleChangeConfig = async (newConfig: Partial<CampaignConfig>) => {
    lastConfigEditTimeRef.current = Date.now();
    const updated = { ...configRef.current, ...newConfig };
    configRef.current = updated;
    setConfig(updated);

    // Keep active campaign updated across lists
    setCampaigns((prev) =>
      prev.map((c) => (c.id === activeCampaignId ? { ...c, config: updated } : c))
    );

    try {
      await fetch("/api/campaign/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("Failed to update config:", e);
    }
  };

  const handleStartCampaign = async () => {
    try {
      await fetch("/api/campaign/start", { method: "POST" });
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePauseCampaign = async () => {
    try {
      await fetch("/api/campaign/pause", { method: "POST" });
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeCampaign = async () => {
    try {
      await fetch("/api/campaign/resume", { method: "POST" });
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopCampaign = async () => {
    try {
      await fetch("/api/campaign/stop", { method: "POST" });
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearCampaign = async () => {
    try {
      await fetch("/api/campaign/clear", { method: "POST" });
      setContacts([]);
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetCampaign = async () => {
    try {
      await fetch("/api/campaign/reset", { method: "POST" });
      fetchCampaignStatus();
      fetchCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOverrideDailyLimit = async () => {
    try {
      await fetch("/api/campaign/override-daily-limit", { method: "POST" });
      fetchCampaignStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePreviewAI = async () => {
    try {
      const res = await fetch("/api/campaign/preview-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleContact: contacts[0] }),
      });
      const data = await res.json();
      return data.preview || "";
    } catch (e) {
      console.error(e);
      return "";
    }
  };

  const handleGenerateAITemplate = async (purpose: string) => {
    try {
      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          tone: config.aiTone,
          language: config.language,
        }),
      });
      const data = await res.json();
      return data.template || "";
    } catch (e) {
      console.error(e);
      return "";
    }
  };

  const handleSendSingle = async (phone: string, message: string, accountId?: string) => {
    const res = await fetch("/api/campaign/send-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, attachment: config.attachment, accountId }),
    });
    return await res.json();
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white"
    >
      {/* Header with Multi-Account status */}
      <Header
        waStatus={waStatus}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenSingleSendModal={() => setIsSingleSendOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onDisconnect={handleDisconnectWhatsApp}
        language={language}
        onToggleLanguage={() => {
          const next = language === "ar" ? "en" : "ar";
          setLanguage(next);
          handleChangeConfig({ language: next });
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold overflow-x-auto max-w-full">
            {/* Dashboard Tab */}
            <button
              id="tab-dashboard-btn"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "dashboard"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{isAr ? "لوحة المؤشرات" : "Dashboard"}</span>
            </button>

            {/* CRM & Leads Tab */}
            <button
              id="tab-crm-btn"
              onClick={() => setActiveTab("crm")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "crm"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>{isAr ? "نظام إدارة العملاء CRM" : "CRM & Leads"}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                {isAr ? "سحب ومتابعة" : "Leads"}
              </span>
            </button>

            {/* AI Sales Agent Tab */}
            <button
              id="tab-ai-agent-btn"
              onClick={() => setActiveTab("ai_agent")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "ai_agent"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Bot className="w-4 h-4 text-teal-300" />
              <span>{isAr ? "وكيل المبيعات الذكي (AI)" : "AI Sales Agent"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isAr ? "رد تلقائي" : "Auto Agent"}
              </span>
            </button>

            {/* Contacts Tab */}
            <button
              id="tab-contacts-btn"
              onClick={() => setActiveTab("contacts")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "contacts"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isAr ? "جهات الاتصال" : "Contacts"}</span>
              {contacts.length > 0 && (
                <span className="bg-black/25 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {contacts.length}
                </span>
              )}
            </button>

            {/* Composer Tab */}
            <button
              id="tab-composer-btn"
              onClick={() => setActiveTab("composer")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "composer"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <FileEdit className="w-4 h-4" />
              <span>{isAr ? "القالب والمرفقات والـ AI" : "Template & Media"}</span>
              {config.attachment && (
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              )}
            </button>

            {/* Settings Tab */}
            <button
              id="tab-settings-btn"
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "settings"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>{isAr ? "إعدادات الأمان والحد اليومي" : "Limits & Safety"}</span>
            </button>

            {/* Campaign Launch & Logs Tab */}
            <button
              id="tab-campaign-btn"
              onClick={() => setActiveTab("campaign")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                activeTab === "campaign"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              <span>{isAr ? "غرفة الإرسال والتقارير" : "Launch Room"}</span>
              {progress.isRunning && !progress.isPaused && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
              )}
            </button>
          </div>

          {/* Quick Status Chips */}
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
            {campaigns.length > 1 && (
              <div className="flex items-center gap-1.5 text-blue-300">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {isAr ? `${campaigns.length} حملات مسجلة` : `${campaigns.length} Campaigns`}
                </span>
              </div>
            )}
            {config.enableDailyLimit && (
              <div className="flex items-center gap-1.5 text-amber-300">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isAr ? `اليوم: ${progress.sentToday}/${config.dailyLimit}` : `Today: ${progress.sentToday}/${config.dailyLimit}`}
                </span>
              </div>
            )}
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {config.minDelay}-{config.maxDelay}s
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>{config.useAI ? (isAr ? "Gemini نشط" : "Gemini active") : (isAr ? "بدون AI" : "No AI")}</span>
            </div>
          </div>
        </div>

        {/* Tab Content Panels */}
        {activeTab === "dashboard" && (
          <DashboardTab
            progress={progress}
            waStatus={waStatus}
            config={config}
            contacts={contacts}
            logs={logs}
            onStart={handleStartCampaign}
            onPause={handlePauseCampaign}
            onResume={handleResumeCampaign}
            onClear={handleClearCampaign}
            onReset={handleResetCampaign}
            onOverrideDailyLimit={handleOverrideDailyLimit}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onNavigateTab={(tab) => setActiveTab(tab)}
            language={language}
          />
        )}

        {activeTab === "crm" && (
          <CrmTab
            language={language}
            waStatus={waStatus}
            accounts={accounts}
            onRefreshAccounts={fetchAccounts}
            onOpenAccountManager={() => setIsConnectModalOpen(true)}
            onNavigateToCampaign={() => setActiveTab("campaign")}
            onPushToContactsList={(newContacts, groupName) => {
              void handleAddBatchContacts(newContacts, groupName || "عملاء CRM");
            }}
            onOpenSingleSend={(phone, name) => {
              setIsSingleSendOpen(true);
            }}
          />
        )}

        {activeTab === "ai_agent" && (
          <AIAgentTab
            language={language}
            onOpenCustomerChat={(phone) => {
              setActiveTab("crm");
            }}
          />
        )}

        {activeTab === "contacts" && (
          <ContactsTab
            contacts={contacts}
            campaigns={campaigns}
            onSetContacts={handleSetContacts}
            onAddBatchContacts={handleAddBatchContacts}
            onDeleteGroup={handleDeleteGroup}
            onResetGroup={handleResetGroup}
            onRenameGroup={handleRenameGroup}
            language={language}
          />
        )}

        {activeTab === "composer" && (
          <ComposerTab
            config={config}
            onChangeConfig={handleChangeConfig}
            sampleContact={contacts[0]}
            onPreviewAI={handlePreviewAI}
            onGenerateAITemplate={handleGenerateAITemplate}
            templates={templates}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onSelectTemplate={handleSelectTemplate}
            language={language}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            config={config}
            onChangeConfig={handleChangeConfig}
            language={language}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
          />
        )}

        {activeTab === "campaign" && (
          <CampaignTab
            progress={progress}
            contacts={contacts}
            logs={logs}
            config={config}
            waStatus={waStatus}
            accounts={accounts}
            campaigns={campaigns}
            templates={templates}
            activeCampaignId={activeCampaignId}
            onSelectCampaign={handleSelectCampaign}
            onCreateCampaign={handleCreateCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            onAssignCampaignAccount={handleAssignCampaignAccount}
            onAssignCampaignTemplate={handleAssignCampaignTemplate}
            onRestoreCampaignBackup={handleRestoreCampaignBackup}
            onStart={handleStartCampaign}
            onPause={handlePauseCampaign}
            onResume={handleResumeCampaign}
            onStop={handleStopCampaign}
            onClear={handleClearCampaign}
            onReset={handleResetCampaign}
            onOverrideDailyLimit={handleOverrideDailyLimit}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            language={language}
          />
        )}
      </main>

      {/* Connection Modal (Multi-Account WhatsApp Hub) */}
      {isConnectModalOpen && (
        <ConnectionModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          waStatus={waStatus}
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSelectAccount={(accId) => setActiveAccountId(accId)}
          onConnectAccount={handleConnectAccount}
          onDisconnectAccount={handleDisconnectAccount}
          onCreateAccount={handleCreateAccount}
          onDeleteAccount={handleDeleteAccount}
          onConnect={handleConnectWhatsApp}
          onDisconnect={handleDisconnectWhatsApp}
          language={language}
        />
      )}

      {/* Single Send Modal */}
      {isSingleSendOpen && (
        <SingleSendModal
          isOpen={isSingleSendOpen}
          onClose={() => setIsSingleSendOpen(false)}
          waStatus={waStatus}
          onSendSingle={handleSendSingle}
          language={language}
        />
      )}

      {/* Full System Backup & Restore Modal */}
      {isBackupModalOpen && (
        <SystemBackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          language={language}
          onRestoreSuccess={() => {
            void fetchCampaignStatus();
            void fetchCampaigns();
            void fetchAccounts();
            void fetchTemplates();
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          {isAr
            ? "مرسل واتساب الذكي • متوافق مع WhatsApp Multi-Device ومدعوم بنموذج Google Gemini 3.8 Flash • نظام مكافحة الحظر المتطور"
            : "WhatsApp AI Bulk Sender • Multi-Device Compatible • Powered by Google Gemini 3.8 Flash • Anti-Ban Engine"}
        </p>
      </footer>
    </div>
  );
}
