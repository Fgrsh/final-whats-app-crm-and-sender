import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Send,
  Trash2,
  Calendar,
  FastForward,
  Paperclip,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  Sparkles,
  Plus,
  Layers,
  Smartphone,
  Check,
  X,
  CheckCheck,
  RefreshCw,
  Activity,
  Search,
  Info,
  HelpCircle,
  Eye,
  Wifi,
  AlertCircle,
} from "lucide-react";
import type {
  Contact,
  QueueProgress,
  LogEntry,
  WhatsAppStatus,
  CampaignConfig,
  CampaignItem,
  WhatsAppAccountInfo,
  DeliveryVerificationResult,
  ContactDeliveryDiagnostic,
  MessageTemplate,
} from "../types.ts";
import { Tooltip } from "./Tooltip.tsx";
import { MessageHistorySummary } from "./MessageHistorySummary.tsx";
import { DeliveryVerificationModal } from "./DeliveryVerificationModal.tsx";

interface CampaignTabProps {
  progress: QueueProgress;
  contacts: Contact[];
  logs: LogEntry[];
  config: CampaignConfig;
  waStatus: WhatsAppStatus | null;
  accounts?: WhatsAppAccountInfo[];
  campaigns?: CampaignItem[];
  templates?: MessageTemplate[];
  activeCampaignId?: string;
  onSelectCampaign?: (id: string) => void;
  onCreateCampaign?: (name: string, whatsappAccountId?: string) => Promise<void>;
  onDeleteCampaign?: (id: string) => Promise<void>;
  onAssignCampaignAccount?: (campaignId: string, whatsappAccountId: string) => Promise<void>;
  onAssignCampaignTemplate?: (campaignId: string, template: MessageTemplate) => Promise<void>;
  onRestoreCampaignBackup?: (backup: any) => Promise<void>;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClear: () => void;
  onReset: () => void;
  onOverrideDailyLimit: () => void;
  onOpenConnectModal: () => void;
  language: "ar" | "en";
}

export const CampaignTab: React.FC<CampaignTabProps> = ({
  progress,
  contacts,
  logs,
  config,
  waStatus,
  accounts = [],
  campaigns = [],
  templates = [],
  activeCampaignId = "default",
  onSelectCampaign,
  onCreateCampaign,
  onDeleteCampaign,
  onAssignCampaignAccount,
  onAssignCampaignTemplate,
  onRestoreCampaignBackup,
  onStart,
  onPause,
  onResume,
  onStop,
  onClear,
  onReset,
  onOverrideDailyLimit,
  onOpenConnectModal,
  language,
}) => {
  const isAr = language === "ar";
  const [filter, setFilter] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // New campaign modal state
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [newCampName, setNewCampName] = useState("");
  const [newCampAccountId, setNewCampAccountId] = useState(accounts[0]?.id || "default");
  const [newCampTemplateId, setNewCampTemplateId] = useState<string>("");
  const [confirmDeleteCampId, setConfirmDeleteCampId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Delivery verification diagnostic state
  const [isVerifyingDelivery, setIsVerifyingDelivery] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<DeliveryVerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const activeCampaign: { id: string; name: string; whatsappAccountId?: string; status?: string; config?: CampaignConfig } =
    campaigns.find((c) => c.id === activeCampaignId) || {
      id: activeCampaignId,
      name: isAr ? "الحملة الحالية" : "Current Campaign",
      whatsappAccountId: "default",
      status: progress.isRunning ? "running" : progress.isPaused ? "paused" : "idle",
      config,
    };

  const handleVerifyDelivery = async () => {
    setIsVerifyingDelivery(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/campaign/verify-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: activeCampaignId,
          accountId: activeCampaign.whatsappAccountId,
          contacts,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        setDeliveryResult(data);
        setIsVerifyModalOpen(true);
      } else {
        setVerifyError(data?.error || (isAr ? "فشل التحقق من الوصول عبر خوادم واتساب" : "Failed to verify delivery"));
        setIsVerifyModalOpen(true);
      }
    } catch (err: any) {
      console.error("Error verifying message delivery:", err);
      setVerifyError(err?.message || (isAr ? "حدث خطأ في الاتصال بالخادم" : "Connection error"));
      setIsVerifyModalOpen(true);
    } finally {
      setIsVerifyingDelivery(false);
    }
  };

  const assignedAccount = accounts.find((a) => a.id === activeCampaign.whatsappAccountId) || {
    id: "default",
    name: accounts[0]?.name || (isAr ? "الحساب الافتراضي" : "Default Account"),
    status: waStatus?.status || "DISCONNECTED",
  };

  const isConnected = assignedAccount.status === "CONNECTED" || waStatus?.status === "CONNECTED";
  const percent = progress.total > 0 ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0;
  const dailyPercent =
    config.enableDailyLimit && config.dailyLimit > 0
      ? Math.min(100, Math.round((progress.sentToday / config.dailyLimit) * 100))
      : 0;

  const handleExportFullCampaign = () => {
    const backupData = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      campaignId: activeCampaignId,
      campaignName: activeCampaign.name,
      whatsappAccountId: activeCampaign.whatsappAccountId,
      config,
      contacts,
      logs,
      progress,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign_${activeCampaign.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (onRestoreCampaignBackup) {
          await onRestoreCampaignBackup(parsed);
        }
      } catch (err) {
        alert(isAr ? "ملف النسخة الاحتياطية غير صالح" : "Invalid backup file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateNewCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampName.trim() || !onCreateCampaign) return;
    await onCreateCampaign(newCampName.trim(), newCampAccountId);
    if (newCampTemplateId && onAssignCampaignTemplate && templates.length > 0) {
      const chosenTpl = templates.find((t) => t.id === newCampTemplateId);
      if (chosenTpl) {
        // Find the newly created campaign (or apply to active)
        await onAssignCampaignTemplate(activeCampaignId, chosenTpl);
      }
    }
    setNewCampName("");
    setNewCampTemplateId("");
    setIsNewCampaignOpen(false);
  };

  const handleExportReport = () => {
    if (contacts.length === 0) return;
    let csv = "phone,name,company,status,message,error,sent_at\n";
    contacts.forEach((c) => {
      const cleanMsg = (c.personalizedMessage || "").replace(/"/g, '""');
      const cleanErr = (c.errorMessage || "").replace(/"/g, '""');
      csv += `"${c.phone}","${c.name || ""}","${c.company || ""}","${c.status}","${cleanMsg}","${cleanErr}","${
        c.sentAt || ""
      }"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `whatsapp_campaign_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [deliveryPage, setDeliveryPage] = useState<number>(1);
  const deliveryPageSize = 30;

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (filter === "all") return true;
      if (filter === "sent") return c.status === "sent";
      if (filter === "failed") return c.status === "failed";
      if (filter === "pending") return c.status === "pending" || c.status === "generating" || c.status === "sending";
      return true;
    });
  }, [contacts, filter]);

  useEffect(() => {
    setDeliveryPage(1);
  }, [filter]);

  const totalDeliveryPages = Math.max(1, Math.ceil(filteredContacts.length / deliveryPageSize));
  const paginatedDeliveryContacts = useMemo(() => {
    const start = (deliveryPage - 1) * deliveryPageSize;
    return filteredContacts.slice(start, start + deliveryPageSize);
  }, [filteredContacts, deliveryPage, deliveryPageSize]);

  return (
    <div className="space-y-6">
      {/* Hidden file input for Campaign JSON Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json"
        className="hidden"
      />

      {/* MULTI-CAMPAIGN HUB TOOLBAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{isAr ? "إدارة الحملات المتعددة" : "Multi-Campaign Hub"}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {campaigns.length || 1} {isAr ? "حملات" : "Campaigns"}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? "يمكنك تشغيل أكثر من حملة في وقت واحد وتخصيص كل حملة لرقم واتساب مختلف أو نفس الرقم"
                  : "Run multiple campaigns concurrently with dedicated WhatsApp accounts"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Backup & Restore Buttons */}
            <button
              onClick={handleExportFullCampaign}
              title={isAr ? "حفظ وتصدير نسخة احتياطية كاملة للحملة الحالية" : "Export campaign backup"}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isAr ? "حفظ نسخة احتياطية" : "Backup JSON"}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title={isAr ? "استرجاع حملة محفوظة من ملف JSON" : "Restore campaign from JSON"}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>{isAr ? "استرجاع حملة" : "Restore"}</span>
            </button>

            {/* Create New Campaign Button */}
            <button
              onClick={() => setIsNewCampaignOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? "+ حملة جديدة" : "+ New Campaign"}</span>
            </button>
          </div>
        </div>

        {/* Campaign Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          {(campaigns.length > 0
            ? campaigns
            : [
                {
                  id: "default",
                  name: isAr ? "الحملة الافتراضية 1" : "Default Campaign 1",
                  whatsappAccountId: "default",
                  status: progress.isRunning ? "running" : progress.isPaused ? "paused" : "idle",
                  contacts,
                  progress,
                } as any,
              ]
          ).map((c: CampaignItem) => {
            const isCurrent = c.id === activeCampaignId;
            const cStatus = c.progress?.isRunning
              ? c.progress.isPaused
                ? "paused"
                : "running"
              : c.status || "idle";
            const accName = accounts.find((a) => a.id === c.whatsappAccountId)?.name || (isAr ? "رقم 1" : "Acc #1");

            return (
              <div
                key={c.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition shrink-0 ${
                  isCurrent
                    ? "bg-emerald-950/60 border-emerald-500/60 text-white shadow-sm"
                    : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                <button
                  onClick={() => onSelectCampaign && onSelectCampaign(c.id)}
                  className="flex items-center gap-2 font-medium"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cStatus === "running"
                        ? "bg-emerald-400 animate-ping"
                        : cStatus === "paused"
                        ? "bg-amber-400"
                        : "bg-slate-500"
                    }`}
                  />
                  <span className="font-bold">{c.name}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                    {accName}
                  </span>
                </button>

                {campaigns.length > 1 && c.id !== "default" && onDeleteCampaign && (
                  confirmDeleteCampId === c.id ? (
                    <div className="flex items-center gap-1 bg-red-950/90 px-1.5 py-0.5 rounded border border-red-500/40 text-[10px]">
                      <button
                        onClick={() => {
                          onDeleteCampaign(c.id);
                          setConfirmDeleteCampId(null);
                        }}
                        className="text-red-300 hover:text-white font-bold px-1"
                      >
                        {isAr ? "تأكيد" : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteCampId(null)}
                        className="text-slate-400 hover:text-slate-200 px-1"
                      >
                        {isAr ? "إلغاء" : "No"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteCampId(c.id)}
                      className="text-slate-500 hover:text-red-400 p-0.5 rounded transition cursor-pointer"
                      title={isAr ? "حذف الحملة" : "Delete"}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Sender WhatsApp Account Selector for Active Campaign */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">{isAr ? "إرسال هذه الحملة عبر رقم:" : "Send this campaign via:"}</span>
            <select
              value={activeCampaign.whatsappAccountId || "default"}
              onChange={(e) => {
                if (onAssignCampaignAccount) {
                  onAssignCampaignAccount(activeCampaignId, e.target.value);
                }
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
            >
              {(accounts.length > 0
                ? accounts
                : [{ id: "default", name: isAr ? "الحساب الرئيسي" : "Default Account", status: "DISCONNECTED" }]
              ).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.status === "CONNECTED" ? (isAr ? "متصل" : "Connected") : (isAr ? "غير متصل" : "Offline")})
                </option>
              ))}
            </select>
          </div>

          {/* Template and Attachment Selector for Active Campaign */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">{isAr ? "قالب ومرفق الحملة:" : "Template & Media:"}</span>
            <select
              value={activeCampaign.config?.templateId || config.templateId || ""}
              onChange={(e) => {
                const chosen = templates.find((t) => t.id === e.target.value);
                if (chosen && onAssignCampaignTemplate) {
                  onAssignCampaignTemplate(activeCampaignId, chosen);
                }
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 max-w-[190px] truncate"
            >
              <option value="">{isAr ? "-- اختر قالب ومرفق --" : "-- Select template --"}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} {tpl.attachment ? `📎 [${tpl.attachment.fileName}]` : ""}
                </option>
              ))}
            </select>
            {config.attachment && (
              <span className="text-purple-300 text-[11px] bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Paperclip className="w-3 h-3 text-purple-400" />
                <span className="max-w-[110px] truncate">{config.attachment.fileName}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>{isAr ? "حالة الرقم المحدد:" : "Account Status:"}</span>
            {isConnected ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {isAr ? "جاهز للإرسال" : "Ready to Send"}
              </span>
            ) : (
              <button
                onClick={onOpenConnectModal}
                className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                {isAr ? "الرقم غير متصل (اضغط للربط)" : "Offline (Click to link)"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: CREATE NEW CAMPAIGN */}
      {isNewCampaignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? "إنشاء حملة تسويقية جديدة" : "Create New Campaign"}</span>
              </h4>
              <button onClick={() => setIsNewCampaignOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCampaign} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "اسم الحملة:" : "Campaign Name:"}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? "مثال: حملة عملاء معرض القاهرة" : "e.g. VIP Customers Campaign"}
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "إرسال الحملة من خلال حساب واتساب:" : "Send via WhatsApp Account:"}
                </label>
                <select
                  value={newCampAccountId}
                  onChange={(e) => setNewCampAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {(accounts.length > 0
                    ? accounts
                    : [{ id: "default", name: isAr ? "الحساب الرئيسي" : "Default Account", status: "DISCONNECTED" }]
                  ).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.status === "CONNECTED" ? (isAr ? "متصل" : "Connected") : (isAr ? "غير متصل" : "Offline")})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isAr
                    ? "يمكنك تشغيل هذه الحملة وتعيينها لأي رقم بشكل منفصل تماماً."
                    : "You can run this campaign independently on this WhatsApp number."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "اختيار قالب ومرفق محفوظ للحملة (اختياري):" : "Choose Message Template & Media (Optional):"}
                </label>
                <select
                  value={newCampTemplateId}
                  onChange={(e) => setNewCampTemplateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">
                    {isAr ? "استخدام قالب الحملة الافتراضي الحالي" : "Use current active template"}
                  </option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.attachment ? `📎 [${tpl.attachment.fileName}]` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isAr
                    ? "يمكنك اختيار قالب ومرفق مخصص لكل حملة ورقم على حدة."
                    : "Assign a dedicated template and attachment to this campaign."}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCampaignOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={!newCampName.trim()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition"
                >
                  {isAr ? "إنشاء الحملة" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily limit waiting banner */}
      {progress.isWaitingForNextDay && (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                {isAr ? "تم إكمال الحصة اليومية المحددة بنجاح" : "Daily Limit Reached"}
              </h4>
              <p className="text-amber-300/80 mt-0.5">
                {isAr
                  ? `أرسلت اليوم ${progress.sentToday} من أصل ${config.dailyLimit} رسالة. الحملة متوقفة مؤقتاً وستكمل أوتوماتيكياً في اليوم التالي، أو يمكنك الاستمرار الآن فوراً.`
                  : `Reached daily limit of ${config.dailyLimit}. Auto-continuation scheduled for tomorrow, or override below.`}
              </p>
            </div>
          </div>
          <button
            onClick={onOverrideDailyLimit}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow text-xs cursor-pointer"
          >
            <FastForward className="w-4 h-4" />
            <span>{isAr ? "تجاوز الحد اليومي والاستمرار الآن" : "Override & Continue Now"}</span>
          </button>
        </div>
      )}

      {/* Control Strip (Start, Pause, Resume, Clear, Reset) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* Status Indicator */}
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${
              progress.isRunning && !progress.isPaused
                ? "bg-emerald-500/20 text-emerald-400 animate-pulse"
                : progress.isPaused
                ? "bg-amber-500/20 text-amber-400"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {progress.isRunning && !progress.isPaused ? (
              <Send className="w-6 h-6" />
            ) : progress.isPaused ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Square className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{isAr ? "مركز تشغيل الحملة" : "Campaign Control Center"}</span>
              <Tooltip
                title={
                  progress.isRunning && !progress.isPaused
                    ? isAr
                      ? "الحملة قيد الإرسال النشط"
                      : "Campaign Actively Sending"
                    : progress.isPaused
                    ? isAr
                      ? "الحملة متوقفة مؤقتاً"
                      : "Campaign Paused"
                    : progress.isWaitingForNextDay
                    ? isAr
                      ? "بانتظار اليوم التالي"
                      : "Daily Quota Reached"
                    : isAr
                    ? "الحملة في وضع الاستعداد"
                    : "Campaign Idle"
                }
                badgeText={
                  progress.isRunning && !progress.isPaused
                    ? isAr
                      ? "نشط"
                      : "Active"
                    : progress.isPaused
                    ? isAr
                      ? "مؤقت"
                      : "Paused"
                    : isAr
                    ? "جاهز"
                    : "Ready"
                }
                content={
                  isAr ? (
                    <div className="space-y-1.5">
                      <p>
                        {progress.isRunning && !progress.isPaused ? (
                          <>
                            <strong className="text-emerald-300">طريقة الإرسال الآمنة:</strong> يتم فحص وإرسال الأرقام تدريجياً مع تطبيق <strong>فاصل زمني عشوائي ({config.minDelay} إلى {config.maxDelay} ثانية)</strong> بين كل رسالة والأخرى، و<strong>استراحة أمان دورية ({config.batchPauseDuration} ثانية)</strong> كل {config.batchSize} رسائل لمنع الرصد الآلي.
                          </>
                        ) : progress.isPaused ? (
                          <>
                            <strong className="text-amber-300">حالة التوقف:</strong> تم إيقاف الإرسال مؤقتاً دون فقدان أي بيانات. يمكنك الضغط على <span className="text-white font-semibold">"استكمال (Resume)"</span> للمتابعة فوراً من نفس الرقم.
                          </>
                        ) : progress.isWaitingForNextDay ? (
                          <>
                            <strong className="text-amber-300">حماية الحد اليومي:</strong> بلغت الحملة السقف المحدد لليوم ({config.dailyLimit} رسالة). ستستأنف أوتوماتيكياً غداً، أو يمكنك الضغط على "تجاوز الحد" للاستمرار الآن.
                          </>
                        ) : (
                          <>
                            <strong className="text-slate-200">وضع الاستعداد:</strong> قائمة الأرقام جاهزة ({contacts.length} رقم). تأكد من ربط جهاز واتساب واضغط "بدء الحملة".
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p>
                        {progress.isRunning && !progress.isPaused
                          ? `Actively dispatching messages with randomized delays (${config.minDelay}-${config.maxDelay}s) and cooldown pauses every ${config.batchSize} messages.`
                          : progress.isPaused
                          ? "Campaign paused safely without progress loss. Click Resume to continue."
                          : "Campaign is ready. Ensure WhatsApp is connected and click Start."}
                      </p>
                    </div>
                  )
                }
              >
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold cursor-help transition ${
                    progress.isRunning && !progress.isPaused
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : progress.isPaused
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {progress.isRunning && !progress.isPaused
                    ? isAr
                      ? "قيد الإرسال"
                      : "Sending..."
                    : progress.isPaused
                    ? isAr
                      ? "متوقفة مؤقتاً"
                      : "Paused"
                    : isAr
                    ? "متوقفة"
                    : "Idle"}
                </span>
              </Tooltip>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {config.sendMethod === "baileys"
                ? isConnected
                  ? isAr
                    ? "متصل بالواتساب عبر Baileys وجاهز"
                    : "Linked via Baileys & Ready"
                  : isAr
                  ? "تنبيه: واتساب غير متصل، يرجى مسح الباركود"
                  : "WhatsApp disconnected, pair device"
                : isAr
                ? "وضع الروابط المباشرة wa.me"
                : "Manual Direct Links Mode"}
            </p>
          </div>
        </div>

        {/* The Action Buttons Requested by User: Start, Pause, Resume, Clear, Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {!progress.isRunning ? (
            <button
              onClick={onStart}
              disabled={contacts.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isAr ? "بدء الحملة" : "Start"}</span>
            </button>
          ) : progress.isPaused ? (
            <button
              onClick={onResume}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isAr ? "استكمال (Resume)" : "Resume"}</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>{isAr ? "توقف (Pause)" : "Pause"}</span>
            </button>
          )}

          {/* زرار مسح (Clear) */}
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-950/70 hover:bg-red-900/80 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl transition cursor-pointer"
            title={isAr ? "مسح وإلغاء الحملة والقائمة بالكامل" : "Clear campaign and contacts"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isAr ? "مسح (Clear)" : "Clear"}</span>
          </button>

          {/* Stop Button */}
          {progress.isRunning && (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              title={isAr ? "إيقاف نهائي" : "Stop"}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isAr ? "إيقاف" : "Stop"}</span>
            </button>
          )}

          {/* Reset Button */}
          <button
            onClick={onReset}
            disabled={progress.isRunning}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
            title={isAr ? "إعادة تعيين الحالة لجميع الأرقام" : "Reset statuses"}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? "إعادة تعيين" : "Reset"}</span>
          </button>

          {/* Export CSV Report */}
          <button
            onClick={handleExportReport}
            disabled={contacts.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
            title={isAr ? "تصدير تقرير الإرسال كاملاً إلى ملف CSV" : "Export report"}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? "تصدير التقرير" : "Report"}</span>
          </button>

          {/* Verify Message Delivery Diagnostic Button */}
          <button
            id="verify-delivery-btn"
            onClick={handleVerifyDelivery}
            disabled={isVerifyingDelivery}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-950/70 hover:bg-blue-900/80 disabled:opacity-50 text-blue-300 text-xs font-bold rounded-xl border border-blue-500/40 transition cursor-pointer shadow-sm shadow-blue-950/40"
            title={isAr ? "فحص وتشخيص وصول الرسائل الفعلي مباشرة من خوادم واتساب وBaileys" : "Verify actual message delivery directly via Baileys"}
          >
            {isVerifyingDelivery ? (
              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{isAr ? "فحص وصول الرسائل" : "Verify Delivery"}</span>
          </button>
        </div>
      </div>

      {/* Progress & Quota Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Progress */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <span>{isAr ? "التقدم الإجمالي للحملة:" : "Overall Campaign Progress:"}</span>
              <Tooltip
                title={isAr ? "طابور الإرسال والتقارير" : "Queue & Dispatch Tracking"}
                content={
                  isAr ? (
                    <div className="space-y-1">
                      <p>
                        يتم معالجة جهات الاتصال بالتسلسل التتابعي وتطبيق إعادة الصياغة بالذكاء الاصطناعي مع إضافة فواصل الأمان.
                      </p>
                      <p className="text-emerald-300">
                        يمكنك تصدير تقرير تفصيلي (CSV) في أي لحظة يحتوي على وقت التسليم الدقيق وحالة كل رقم.
                      </p>
                    </div>
                  ) : (
                    <p>
                      Contacts are dispatched sequentially with personalized templates and anti-ban delays. Export CSV reports anytime.
                    </p>
                  )
                }
              />
            </span>
            <span className="font-mono font-bold text-emerald-400">{percent}%</span>
          </div>
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              {isAr ? "إجمالي الأرقام:" : "Total:"} <strong className="text-white">{progress.total}</strong>
            </span>
            <span>
              {isAr ? "تم الإرسال:" : "Sent:"} <strong className="text-emerald-400">{progress.sent}</strong>
            </span>
            <span>
              {isAr ? "متبقي:" : "Pending:"} <strong className="text-amber-400">{progress.pending}</strong>
            </span>
            <span>
              {isAr ? "فشل:" : "Failed:"} <strong className="text-red-400">{progress.failed}</strong>
            </span>
          </div>
        </div>

        {/* Daily Quota Progress */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{isAr ? "حصة اليوم الحالية:" : "Daily Sending Quota:"}</span>
              <Tooltip
                title={isAr ? "سقف الإرسال اليومي والأمان" : "Daily Quota Limits"}
                content={
                  isAr ? (
                    <div className="space-y-1">
                      <p>
                        تنظيم وتيرة الإرسال اليومية (100-150 رسالة/يومياً) هو أقوى عامل حماية للأرقام من الحظر المؤقت أو الدائم.
                      </p>
                      <p className="text-amber-300">
                        عند اكتمال الحصة، تتوقف الحملة أوتوماتيكياً وتستكمل غداً بدون أي تدخل منك.
                      </p>
                    </div>
                  ) : (
                    <p>
                      Capping daily messages (100-150/day) is essential for new accounts. Queue pauses automatically and resumes tomorrow.
                    </p>
                  )
                }
              />
            </span>
            <span className="font-mono font-bold text-amber-400">
              {config.enableDailyLimit ? `${progress.sentToday} / ${config.dailyLimit}` : isAr ? "غير محدود" : "Unlimited"}
            </span>
          </div>
          {config.enableDailyLimit ? (
            <>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress.sentToday >= config.dailyLimit ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${dailyPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>
                  {isAr ? "متبقي لليوم:" : "Left today:"}{" "}
                  <strong className="text-white">{Math.max(0, config.dailyLimit - progress.sentToday)}</strong>
                </span>
                <span>
                  {isAr ? "تاريخ اليوم:" : "Current date:"}{" "}
                  <strong className="text-slate-300 font-mono">{progress.currentDayDate}</strong>
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 pt-2">
              {isAr
                ? "الحد اليومي معطل حالياً (سيرسل القائمة كاملة متواصلة). يمكنك تفعيله من الإعدادات."
                : "Daily limit is disabled. You can enable it from the Settings tab."}
            </p>
          )}
        </div>
      </div>

      {/* Message History Summary Section with Success/Failure Rate Chart */}
      <MessageHistorySummary
        contacts={contacts}
        progress={progress}
        logs={logs}
        language={language}
      />

      {/* Active Anti-Ban Protection Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{isAr ? "إعدادات الأمان النشطة بالحملة:" : "Active Anti-Ban Protection:"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rate Limiting Chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 font-mono">
            <Clock className="w-3 h-3 text-emerald-400" />
            <span>
              {isAr ? "فاصل الرسائل:" : "Delay:"} {config.minDelay}-{config.maxDelay}s
            </span>
            <Tooltip
              title={isAr ? "تنظيم وتيرة الإرسال العشوائي" : "Randomized Rate Limiting"}
              badgeText={isAr ? "نشط" : "Active"}
              content={
                isAr
                  ? `يتم توليد انتظار عشوائي بين ${config.minDelay} و ${config.maxDelay} ثانية قبل كل رسالة لمحاكاة سرعة الكتابة البشرية وتفادي كشف البوتات.`
                  : `Generates a random ${config.minDelay}-${config.maxDelay}s pause between each message to emulate authentic human typing.`
              }
            />
          </div>

          {/* Batch Cooldown Chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-purple-500/30 rounded-xl text-[11px] text-purple-300 font-mono">
            <Pause className="w-3 h-3 text-purple-400" />
            <span>
              {isAr ? "استراحة الدفعات:" : "Batch Pause:"}{" "}
              {config.enableBatchPause
                ? `كل ${config.batchSize || 10} رسائل (~${config.batchPauseDuration || 200}s)`
                : isAr
                ? "معطل"
                : "Disabled"}
            </span>
            <Tooltip
              title={isAr ? "تبريد الحساب بعد كل دفعة (Batch Pause)" : "Batch Cooldown Pause"}
              badgeText={isAr ? "موصى به" : "Recommended"}
              content={
                isAr
                  ? `بعد كل ${config.batchSize || 10} رسائل، تتوقف الحملة أوتوماتيكياً لمدة ~${config.batchPauseDuration || 200} ثانية مع تنويع عشوائي (±15 ثانية) لتبريد الحساب ومنع رصد الدفقات المتواصلة، ثم تستأنف تلقائياً.`
                  : `Automatically pauses the campaign for ~${config.batchPauseDuration || 200}s after every ${config.batchSize || 10} messages to cool down the connection and break continuous burst scores.`
              }
            />
          </div>

          {/* Daily Quota Chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 font-mono">
            <Calendar className="w-3 h-3 text-amber-400" />
            <span>
              {isAr ? "سقف اليوم:" : "Daily Cap:"}{" "}
              {config.enableDailyLimit ? `${progress.sentToday}/${config.dailyLimit}` : isAr ? "غير محدود" : "Unlimited"}
            </span>
            <Tooltip
              title={isAr ? "سقف اليوم والاستئناف التلقائي" : "Daily Quota Protection"}
              content={
                isAr
                  ? "يضمن عدم تجاوز الحد اليومي الآمن. عند الوصول للحد تتوقف الحملة وتستأنف في اليوم التالي أوتوماتيكياً."
                  : "Prevents account fatigue by capping daily outbound volume. Auto-continues tomorrow."
              }
            />
          </div>

          {/* Anti-Duplicate Timestamp Chip */}
          {config.appendTimestampAndCode && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-teal-500/30 rounded-xl text-[11px] text-teal-300 font-mono">
              <Sparkles className="w-3 h-3 text-teal-400" />
              <span>{isAr ? "كود وتوقيت فريد" : "Unique Hash"}</span>
              <Tooltip
                title={isAr ? "منع تكرار المحتوى المتطابق" : "Anti-Duplicate Footers"}
                content={
                  isAr
                    ? "إضافة ختم زمني وكود مرجعي فريد في نهاية كل رسالة لتغيير بصمة النص ومنع واتساب من تصنيفه كرسالة مكررة (Spam Hash)."
                    : "Appends a unique timestamp and reference code to make every outgoing payload unique, preventing spam hash detection."
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Bottom Section: Live Log & Contacts Status Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Contacts Status (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <span>{isAr ? "حالات الإرسال للأرقام" : "Contact Delivery List"}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                {filteredContacts.length}
              </span>
            </h4>

            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {(["all", "sent", "pending", "failed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    filter === f
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {f === "all"
                    ? isAr
                      ? "الكل"
                      : "All"
                    : f === "sent"
                    ? isAr
                      ? "تم"
                      : "Sent"
                    : f === "pending"
                    ? isAr
                      ? "انتظار"
                      : "Pending"
                    : isAr
                    ? "فشل"
                    : "Failed"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[360px] divide-y divide-slate-800/60 text-xs">
            {paginatedDeliveryContacts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                {isAr ? "لا توجد جهات اتصال تطابق هذا الفلتر." : "No contacts match this filter."}
              </div>
            ) : (
              paginatedDeliveryContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-3 hover:bg-slate-800/40 transition flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {contact.status === "sent" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : contact.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : contact.status === "sending" || contact.status === "generating" ? (
                      <Clock className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate text-xs">
                          {contact.name || contact.phone}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 select-all">+{contact.phone}</span>
                      </div>
                      {contact.errorMessage && (
                        <p className="text-[10px] text-red-400 truncate">{contact.errorMessage}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {contact.personalizedMessage && (
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                        title={isAr ? "عرض نص الرسالة المخصصة" : "View personalized text"}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <a
                      href={`https://wa.me/${contact.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                      title={isAr ? "فتح محادثة واتساب" : "Open WhatsApp"}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mini Pagination Footer for Delivery List */}
          {totalDeliveryPages > 1 && (
            <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {isAr
                  ? `صفحة ${deliveryPage} من ${totalDeliveryPages} (${filteredContacts.length} رقم)`
                  : `Page ${deliveryPage} of ${totalDeliveryPages} (${filteredContacts.length} contacts)`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDeliveryPage((p) => Math.max(1, p - 1))}
                  disabled={deliveryPage === 1}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
                  title={isAr ? "السابق" : "Prev"}
                >
                  {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setDeliveryPage((p) => Math.min(totalDeliveryPages, p + 1))}
                  disabled={deliveryPage === totalDeliveryPages}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
                  title={isAr ? "التالي" : "Next"}
                >
                  {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Terminal Logs (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col h-[420px] font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5">
            <span className="font-bold text-slate-300 flex items-center gap-2 text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isAr ? "السجل الحي للعمليات (Live Logs)" : "Real-time Activity Log"}</span>
            </span>
            <span className="text-[10px] text-slate-500">{logs.length} entries</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {logs.length === 0 ? (
              <div className="text-slate-600 text-center pt-8 text-[11px]">
                {isAr ? "لا توجد سجلات بعد..." : "Logs will stream here..."}
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="leading-tight text-[11px] flex items-start gap-1.5">
                  <span className="text-slate-600 shrink-0 text-[10px]">{log.timestamp}</span>
                  <span
                    className={
                      log.type === "success"
                        ? "text-emerald-400"
                        : log.type === "error"
                        ? "text-red-400 font-semibold"
                        : log.type === "warning"
                        ? "text-amber-400"
                        : "text-slate-300"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Message Inspection Modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>
                  {isAr ? "الرسالة المرسلة إلى:" : "Dispatched message to:"} {selectedContact.name || selectedContact.phone}
                </span>
              </h4>
              <button onClick={() => setSelectedContact(null)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            {/* Media if attached */}
            {config.attachment && (
              <div className="p-3 bg-slate-950 border border-purple-500/30 rounded-xl flex items-center gap-2 text-xs text-purple-300">
                <Paperclip className="w-4 h-4" />
                <span>
                  {isAr ? "تم إرسال مرفق مع الرسالة:" : "Attached with message:"} {config.attachment.fileName}
                </span>
              </div>
            )}

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-50 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-sans">
              {selectedContact.personalizedMessage}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedContact(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct WhatsApp Delivery Diagnostic Modal */}
      <DeliveryVerificationModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onRefresh={handleVerifyDelivery}
        isLoading={isVerifyingDelivery}
        result={deliveryResult}
        error={verifyError}
        language={language}
      />
    </div>
  );
};
