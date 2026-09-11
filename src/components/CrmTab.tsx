import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  PhoneCall,
  MessageSquare,
  Calendar,
  Clock,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Trash2,
  DollarSign,
  Tag,
  ArrowRight,
  ChevronRight,
  Copy,
  ExternalLink,
  Kanban,
  ListFilter,
  Check,
  Building2,
  CalendarDays,
  Plus,
  X,
  Radio,
  FileSpreadsheet,
  CheckSquare,
  Columns,
  LayoutGrid,
  Maximize2,
  ChevronLeft,
  Smartphone,
  Bot,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type {
  CRMLead,
  LeadStage,
  LeadPriority,
  ExtractedChatSummary,
  ExtractedMessage,
  ActivityType,
  WhatsAppStatus,
  WhatsAppAccountInfo,
  Contact,
} from "../types.ts";
import { WhatsAppChatPanel } from "./WhatsAppChatPanel.tsx";
import { safeFetchJson } from "../utils/api.ts";
import { isSamePhoneNumber, normalizePhoneNumber } from "../utils/phoneUtils.ts";

interface CrmTabProps {
  language: "ar" | "en";
  waStatus: WhatsAppStatus | null;
  accounts?: WhatsAppAccountInfo[];
  onRefreshAccounts?: () => void | Promise<void>;
  onOpenAccountManager?: () => void;
  onNavigateToCampaign?: () => void;
  onPushToContactsList?: (contacts: Contact[], groupName?: string) => void | Promise<void>;
  onOpenSingleSend?: (phone: string, name?: string) => void;
}

const STAGES: { id: LeadStage; nameAr: string; nameEn: string; color: string; bg: string }[] = [
  { id: "new", nameAr: "عميل جديد", nameEn: "New Lead", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  { id: "follow_up", nameAr: "جاري المتابعة", nameEn: "In Follow-up", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  { id: "interested", nameAr: "مهتم / مؤهل", nameEn: "Interested", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  { id: "negotiation", nameAr: "تفاوض / عرض سعر", nameEn: "Negotiation", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30" },
  { id: "won", nameAr: "تم الشراء / إغلاق", nameEn: "Won / Closed", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  { id: "lost", nameAr: "غير مهتم / ملغي", nameEn: "Lost", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/30" },
];

export function CrmTab({
  language,
  waStatus,
  accounts = [],
  onRefreshAccounts,
  onOpenAccountManager,
  onNavigateToCampaign,
  onPushToContactsList,
  onOpenSingleSend,
}: CrmTabProps) {
  const isAr = language === "ar";

  // Multi-Account Selection State
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [accountsList, setAccountsList] = useState<WhatsAppAccountInfo[]>(accounts);

  useEffect(() => {
    if (accounts.length > 0) {
      setAccountsList(accounts);
    }
  }, [accounts]);

  // Fetch accounts if list is empty
  useEffect(() => {
    if (accountsList.length === 0) {
      safeFetchJson<{ success: boolean; accounts: WhatsAppAccountInfo[] }>("/api/whatsapp/accounts")
        .then((res) => {
          if (res?.accounts && res.accounts.length > 0) {
            setAccountsList(res.accounts);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Layout mode: 'split' (WhatsApp on left, CRM on right), 'whatsapp' (full), or 'crm' (full)
  const [layoutMode, setLayoutMode] = useState<"split" | "whatsapp" | "crm">("split");
  
  // CRM subtabs
  const [activeSubTab, setActiveSubTab] = useState<"pipeline" | "table" | "followups">("pipeline");
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [extractedChats, setExtractedChats] = useState<ExtractedChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Selected Lead Drawer & Modal
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<{ id: string; name: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // CRM Deduplication State
  const [deduplicateModalState, setDeduplicateModalState] = useState<{
    duplicates: { phone: string; names: string[]; stages: string[]; count: number }[];
    totalDuplicateRows: number;
  } | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  // Drawer State
  const [drawerActiveTab, setDrawerActiveTab] = useState<"overview" | "activities" | "ai" | "messages">("overview");
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [leadMessages, setLeadMessages] = useState<ExtractedMessage[]>([]);
  const [isLoadingLeadMessages, setIsLoadingLeadMessages] = useState(false);
  const [isSyncingLeadMessages, setIsSyncingLeadMessages] = useState(false);
  const [leadRequestSummary, setLeadRequestSummary] = useState<string | null>(null);
  const [isAnalyzingLeadRequest, setIsAnalyzingLeadRequest] = useState(false);

  // Load WhatsApp messages whenever selected lead or selected account changes
  useEffect(() => {
    if (selectedLead?.phone) {
      setLeadMessages([]);
      setLeadRequestSummary(null);
      setIsLoadingLeadMessages(true);
      const url = selectedAccountId !== "all"
        ? `/api/crm/chats/${selectedLead.phone}/messages?accountId=${encodeURIComponent(selectedAccountId)}`
        : `/api/crm/chats/${selectedLead.phone}/messages`;
      safeFetchJson<{ success: boolean; messages: ExtractedMessage[] }>(url)
        .then((data) => {
          if (data?.messages) setLeadMessages(data.messages);
        })
        .finally(() => setIsLoadingLeadMessages(false));
    }
  }, [selectedLead?.id, selectedLead?.phone, selectedAccountId]);

  // Sync messages directly from WhatsApp for selected lead
  const handleSyncLeadMessages = async () => {
    if (!selectedLead?.phone) return;
    try {
      setIsSyncingLeadMessages(true);
      const res = await fetch(`/api/crm/chats/${selectedLead.phone}/sync-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId !== "all" ? selectedAccountId : undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setLeadMessages(data.messages);
          showToast(isAr ? `تم سحب ${data.messages.length} رسالة لهذا العميل بنجاح` : `Synced ${data.messages.length} messages`);
        } else {
          showToast(isAr ? "تم إرسال طلب سحب المحادثة من واتساب..." : "Sync requested from WhatsApp...");
        }
      }
    } catch (err) {
      console.error("Error syncing messages:", err);
      showToast(isAr ? "تعذر سحب الرسائل حالياً" : "Failed to sync messages");
    } finally {
      setIsSyncingLeadMessages(false);
    }
  };

  // Analyze what the customer requested from their message history using AI
  const handleAnalyzeLeadCustomerRequest = async () => {
    if (!selectedLead?.phone || leadMessages.length === 0) {
      showToast(isAr ? "لا توجد رسائل مسجلة لتحليلها" : "No messages to analyze");
      return;
    }
    try {
      setIsAnalyzingLeadRequest(true);
      const customerMsgs = leadMessages
        .filter((m) => !m.fromMe)
        .map((m) => `[${m.timestamp}] ${m.text}`)
        .join("\n");

      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: `تحليل رسائل هذا العميل وتوضيح ماذا كان يطلب العميل بدقة:
العميل: ${selectedLead.name} (${selectedLead.phone})
رسائل العميل هي:
${customerMsgs || selectedLead.notes || "لا توجد تفاصيل"}
قم بتلخيص الآتي باختصار ونقاط واضحة:
1. ما الذي كان يطلبه العميل بالضبط (السلعة / الخدمة / الاستفسار)؟
2. هل ذكر تفاصيل هامة (سعر محدد، موعد تسليم، مواصفات)؟
3. التوصية بما يجب الرد به أو الإجراء التالي لإتمام البيع.`,
          tone: "professional",
          language: isAr ? "ar" : "en",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLeadRequestSummary(data.template || null);
      }
    } catch (err) {
      console.error("Error analyzing lead request:", err);
    } finally {
      setIsAnalyzingLeadRequest(false);
    }
  };

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    phone: "",
    company: "",
    stage: "new" as LeadStage,
    priority: "medium" as LeadPriority,
    dealValue: 0,
    tags: "",
    notes: "",
    nextFollowUpDate: new Date().toISOString().slice(0, 10),
    nextFollowUpTime: "12:00",
    nextFollowUpNote: "",
  });

  // Activity Form State in Drawer
  const [activityForm, setActivityForm] = useState({
    type: "call" as ActivityType,
    title: "",
    note: "",
    outcome: "",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // File input ref for leads JSON restore
  const leadsFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Fetch Leads with LocalStorage auto-restore persistence
  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/crm/leads");
      if (res.ok) {
        const data = await res.json();
        if (data.leads && data.leads.length > 0) {
          setLeads(data.leads);
          try {
            localStorage.setItem("wa_crm_leads_cache", JSON.stringify(data.leads));
          } catch {
            // ignore
          }
          if (selectedLead) {
            const updated = data.leads.find((l: CRMLead) => l.id === selectedLead.id);
            if (updated) setSelectedLead(updated);
          }
        } else if ((!data.leads || data.leads.length === 0)) {
          // Check if we have leads in localStorage to auto-restore after container restart
          try {
            const cached = localStorage.getItem("wa_crm_leads_cache");
            if (cached) {
              const parsedLeads = JSON.parse(cached);
              if (Array.isArray(parsedLeads) && parsedLeads.length > 0) {
                console.log("Auto-restoring leads from local persistent cache...");
                const restoreRes = await fetch("/api/crm/leads/restore-backup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ leads: parsedLeads }),
                });
                if (restoreRes.ok) {
                  const restoredData = await restoreRes.json();
                  if (restoredData.leads) {
                    setLeads(restoredData.leads);
                    showToast(isAr ? `تم استرجاع ${restoredData.leads.length} عميل تلقائياً من النسخة المحفوظة!` : "Auto-restored leads from cache!");
                  }
                }
              }
            }
          } catch (restoreErr) {
            console.error("Error auto-restoring leads:", restoreErr);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Full WhatsApp & Contacts Sync
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const handleFullSync = async () => {
    try {
      setIsSyncingAll(true);
      const res = await fetch("/api/crm/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId !== "all" ? selectedAccountId : undefined }),
      });
      if (res.ok) {
        await fetchExtractedChats(selectedAccountId);
        await fetchLeads();
        if (onRefreshAccounts) await onRefreshAccounts();
        showToast(
          isAr
            ? "تمت المزامنة الدقيقة والشاملة لحسابات ومحادثات واتساب بنجاح!"
            : "Synced all WhatsApp chats & accounts accurately!"
        );
      }
    } catch (err) {
      console.error("Error syncing all:", err);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Export full leads JSON backup
  const handleExportLeadsJson = () => {
    if (leads.length === 0) {
      showToast(isAr ? "لا يوجد عملاء للتصدير" : "No leads to export");
      return;
    }
    const blob = new Blob([JSON.stringify({ version: "2.0", leads, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm_leads_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(isAr ? "تم تصدير ملف النسخة الاحتياطية للعملاء (JSON) بنجاح" : "Exported leads JSON backup");
  };

  // Import full leads JSON backup
  const handleImportLeadsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const leadsList = Array.isArray(parsed) ? parsed : parsed.leads;
        if (Array.isArray(leadsList) && leadsList.length > 0) {
          const res = await fetch("/api/crm/leads/restore-backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leads: leadsList }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.leads) setLeads(data.leads);
            showToast(isAr ? `تمت استعادة ${leadsList.length} عميل بنجاح!` : `Restored ${leadsList.length} leads!`);
          }
        } else {
          showToast(isAr ? "الملف لا يحتوي على بيانات عملاء صالحة" : "No valid leads in file");
        }
      } catch (err) {
        showToast(isAr ? "فشل قراءة ملف النسخة الاحتياطية" : "Failed to read backup file");
      }
    };
    reader.readAsText(file);
    if (leadsFileInputRef.current) leadsFileInputRef.current.value = "";
  };

  // Fetch Extracted Chats
  const fetchExtractedChats = async (accountIdToFetch?: string) => {
    try {
      const acc = accountIdToFetch !== undefined ? accountIdToFetch : selectedAccountId;
      const url = acc && acc !== "all"
        ? `/api/crm/extracted-chats?accountId=${encodeURIComponent(acc)}`
        : "/api/crm/extracted-chats";
      const data = await safeFetchJson<{ success: boolean; chats: ExtractedChatSummary[] }>(url);
      if (data?.chats) {
        setExtractedChats((prev) => {
          if (
            prev.length === data.chats.length &&
            prev.every(
              (c, i) =>
                c.phone === data.chats[i]?.phone &&
                c.lastMessage === data.chats[i]?.lastMessage &&
                c.unreadCount === data.chats[i]?.unreadCount &&
                c.isAlreadyLead === data.chats[i]?.isAlreadyLead &&
                c.accountId === data.chats[i]?.accountId
            )
          ) {
            return prev;
          }
          return data.chats;
        });
      }
    } catch {
      // Handled safely
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchExtractedChats(selectedAccountId);
    const interval = setInterval(() => fetchExtractedChats(selectedAccountId), 4000);
    return () => clearInterval(interval);
  }, [selectedAccountId]);

  // Update Lead Stage
  const handleUpdateStage = async (leadId: string, newStage: LeadStage) => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, stage: newStage, updatedAt: new Date().toISOString() } : l))
        );
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead((prev) => (prev ? { ...prev, stage: newStage } : null));
        }
        showToast(isAr ? "تم تحديث مرحلة العميل بنجاح" : "Lead stage updated");
      }
    } catch (err) {
      console.error("Error updating stage:", err);
    }
  };

  // Mark Follow-up Done
  const handleToggleFollowUpDone = async (lead: CRMLead) => {
    try {
      const newStatus = !lead.isFollowUpDone;
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFollowUpDone: newStatus }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, isFollowUpDone: newStatus } : l))
        );
        showToast(
          newStatus
            ? isAr
              ? "تم إتمام المتابعة بنجاح"
              : "Follow-up completed"
            : isAr
            ? "تم إعادة فتح المتابعة"
            : "Follow-up reopened"
        );
      }
    } catch (err) {
      console.error("Error toggling follow-up:", err);
    }
  };

  // Delete Lead
  const handleExecuteDeleteLead = async () => {
    if (!leadToDelete) return;
    const leadId = leadToDelete.id;
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        setSelectedLeadIds((prev) => prev.filter((id) => id !== leadId));
        if (selectedLead?.id === leadId) setSelectedLead(null);
        showToast(isAr ? "تم حذف العميل" : "Lead deleted");
      }
    } catch (err) {
      console.error("Error deleting lead:", err);
    } finally {
      setLeadToDelete(null);
    }
  };

  // Convert Chat to Lead
  const handleConvertChat = async (phone: string, name?: string, notes?: string) => {
    try {
      const res = await fetch("/api/crm/extracted-chats/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(isAr ? "تم تسجيل الرقم كعميل جديد في الـ CRM!" : "Chat converted to lead!");
        await fetchLeads();
        await fetchExtractedChats();
        if (data.lead) {
          setSelectedLead(data.lead);
        }
      }
    } catch (err) {
      console.error("Error converting chat to lead:", err);
    }
  };

  // Bulk Convert Unregistered
  const handleBulkConvertUnregistered = async () => {
    const unregistered = extractedChats.filter((c) => !c.isAlreadyLead);
    if (unregistered.length === 0) {
      showToast(isAr ? "لا توجد أرقام جديدة غير مسجلة حالياً" : "No unregistered numbers");
      return;
    }
    let converted = 0;
    for (const chat of unregistered) {
      try {
        await fetch("/api/crm/extracted-chats/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: chat.phone, name: chat.name }),
        });
        converted++;
      } catch (e) {}
    }
    showToast(isAr ? `تم تحويل ${converted} رقم إلى عملاء بنجاح!` : `Converted ${converted} numbers to leads!`);
    fetchLeads();
    fetchExtractedChats();
  };

  // Scan CRM Leads for Duplicates
  const handleScanCrmDuplicates = () => {
    const map = new Map<string, CRMLead[]>();
    for (const lead of leads) {
      const norm = normalizePhoneNumber(lead.phone);
      if (!map.has(norm)) map.set(norm, []);
      map.get(norm)!.push(lead);
    }
    const dups: { phone: string; names: string[]; stages: string[]; count: number }[] = [];
    let totalDuplicates = 0;
    map.forEach((leadList, phone) => {
      if (leadList.length > 1) {
        totalDuplicates += leadList.length - 1;
        dups.push({
          phone,
          names: Array.from(new Set(leadList.map((l) => l.name).filter(Boolean))),
          stages: Array.from(
            new Set(
              leadList.map(
                (l) => STAGES.find((s) => s.id === l.stage)?.[isAr ? "nameAr" : "nameEn"] || l.stage
              )
            )
          ),
          count: leadList.length,
        });
      }
    });

    if (dups.length === 0) {
      showToast(
        isAr
          ? "قاعدة بيانات الـ CRM نظيفة 100% ولا توجد أي أرقام مكررة!"
          : "CRM database is 100% clean, no duplicate leads found!"
      );
      return;
    }

    setDeduplicateModalState({
      duplicates: dups,
      totalDuplicateRows: totalDuplicates,
    });
  };

  // Confirm and Execute CRM Deduplication
  const handleConfirmDeduplicateCrm = async () => {
    setIsDeduplicating(true);
    try {
      const res = await fetch("/api/crm/leads/deduplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          isAr
            ? `تم بنجاح دمج وتنظيف ${data.removedDuplicatesCount || 0} عميل مكرر في الـ CRM!`
            : `Merged and removed ${data.removedDuplicatesCount || 0} duplicate CRM leads!`
        );
        setDeduplicateModalState(null);
        await fetchLeads();
      } else {
        showToast(data.error || "Failed to deduplicate CRM leads");
      }
    } catch (err) {
      console.error(err);
      showToast(isAr ? "فشل تنظيف المكررات" : "Failed to clean duplicates");
    } finally {
      setIsDeduplicating(false);
    }
  };

  // Create Lead Manually
  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.phone) {
      alert(isAr ? "يرجى إدخال رقم الهاتف" : "Please enter phone number");
      return;
    }

    const cleaned = normalizePhoneNumber(newLeadForm.phone);
    const existingLead = leads.find((l) => isSamePhoneNumber(l.phone, cleaned));
    if (existingLead) {
      const stageName =
        STAGES.find((s) => s.id === existingLead.stage)?.[isAr ? "nameAr" : "nameEn"] ||
        existingLead.stage;
      alert(
        isAr
          ? `رقم الهاتف مسجل بالفعل في الـ CRM للعميل "${existingLead.name || existingLead.phone}" في مرحلة "${stageName}"!`
          : `Phone number is already registered in CRM for "${existingLead.name || existingLead.phone}" (${stageName})!`
      );
      return;
    }
    try {
      const tagsArray = newLeadForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newLeadForm,
          dealValue: Number(newLeadForm.dealValue) || 0,
          tags: tagsArray.length ? tagsArray : ["جديد"],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(isAr ? "تمت إضافة العميل بنجاح!" : "Lead created successfully!");
        setIsNewLeadModalOpen(false);
        setNewLeadForm({
          name: "",
          phone: "",
          company: "",
          stage: "new",
          priority: "medium",
          dealValue: 0,
          tags: "",
          notes: "",
          nextFollowUpDate: new Date().toISOString().slice(0, 10),
          nextFollowUpTime: "12:00",
          nextFollowUpNote: "",
        });
        fetchLeads();
        if (data.lead) setSelectedLead(data.lead);
      }
    } catch (err) {
      console.error("Error creating lead:", err);
    }
  };

  // Add Activity to selected Lead
  const handleAddActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !activityForm.title) return;

    try {
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityForm),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedActivities = [data.activity, ...(selectedLead.activities || [])];
        const updated = { ...selectedLead, activities: updatedActivities };
        setSelectedLead(updated);
        setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? updated : l)));
        setActivityForm({ type: "call", title: "", note: "", outcome: "" });
        showToast(isAr ? "تم تسجيل النشاط والمتابعة بنجاح" : "Activity logged successfully");
      }
    } catch (err) {
      console.error("Error adding activity:", err);
    }
  };

  // Analyze Lead with AI (Gemini)
  const handleAnalyzeWithAI = async () => {
    if (!selectedLead) return;
    try {
      setIsAnalyzingAI(true);
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/ai-analyze`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          const updated = { ...selectedLead, aiAnalysis: data.analysis };
          setSelectedLead(updated);
          setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? updated : l)));
          showToast(isAr ? "تم تحليل المحادثة واقتراح الرد المناسب بالذكاء الاصطناعي!" : "AI analysis completed!");
        }
      }
    } catch (err) {
      console.error("Error analyzing with AI:", err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Push Selected Leads to Campaign Queue
  const handlePushSelectedToCampaign = async () => {
    if (selectedLeadIds.length === 0) {
      showToast(isAr ? "يرجى تحديد عملاء أولاً" : "Please select leads first");
      return;
    }

    try {
      const res = await fetch("/api/crm/push-to-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(isAr ? `تم نقل ${data.addedCount} عميل إلى قائمة الحملة التسويقية!` : `Pushed ${data.addedCount} leads to campaign!`);
        if (onNavigateToCampaign) {
          onNavigateToCampaign();
        }
      }
    } catch (err) {
      console.error("Error pushing leads to campaign:", err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (leads.length === 0) {
      showToast(isAr ? "لا توجد بيانات عملاء لتصديرها" : "No leads to export");
      return;
    }
    const headers = ["ID", "Name", "Phone", "Company", "Stage", "Priority", "DealValue", "NextFollowUp", "Notes"];
    const rows = leads.map((l) => [
      l.id,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${(l.company || "").replace(/"/g, '""')}"`,
      l.stage,
      l.priority,
      l.dealValue || 0,
      l.nextFollowUpDate || "",
      `"${(l.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `crm_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(isAr ? "تم تصدير ملف العملاء بنجاح" : "Exported leads CSV");
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (priorityFilter !== "all" && lead.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          lead.name.toLowerCase().includes(q) ||
          lead.phone.includes(q) ||
          (lead.company && lead.company.toLowerCase().includes(q)) ||
          lead.tags.some((t) => t.toLowerCase().includes(q)) ||
          (lead.notes && lead.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [leads, stageFilter, priorityFilter, searchQuery]);

  // Due Follow-ups
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueFollowUpLeads = useMemo(() => {
    return leads.filter((l) => l.nextFollowUpDate && l.nextFollowUpDate <= todayStr && !l.isFollowUpDone);
  }, [leads, todayStr]);

  const totalDealValue = useMemo(() => {
    return leads.reduce((sum, l) => sum + (Number(l.dealValue) || 0), 0);
  }, [leads]);

  const wonLeadsCount = useMemo(() => {
    return leads.filter((l) => l.stage === "won").length;
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Organization Header: Quick Metrics & Layout Controls */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Left: Title & Quick Stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{isAr ? "نظام إدارة العملاء الذكي (CRM & WhatsApp)" : "CRM & WhatsApp System"}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "محادثات الواتساب المحدثة باليسار، وخط سير المبيعات والمتابعات باليمين"
                  : "Live WhatsApp on left, Sales pipeline and follow-ups on right"}
              </p>
            </div>
          </div>

          {/* Compact metric pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="text-slate-400">{isAr ? "العملاء:" : "Leads:"}</span>
              <span className="font-bold text-white">{leads.length}</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="text-slate-400">{isAr ? "متابعات اليوم:" : "Due Today:"}</span>
              <span className={`font-bold ${dueFollowUpLeads.length > 0 ? "text-amber-400" : "text-white"}`}>
                {dueFollowUpLeads.length}
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="text-slate-400">{isAr ? "قيمة الصفقات:" : "Value:"}</span>
              <span className="font-bold text-emerald-400">
                {totalDealValue.toLocaleString()} <span className="text-[10px] text-slate-400">{isAr ? "ر.س/ج.م" : "SAR"}</span>
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="text-slate-400">{isAr ? "صفقات رابحة:" : "Won:"}</span>
              <span className="font-bold text-emerald-300">{wonLeadsCount}</span>
            </div>
          </div>
        </div>

        {/* Right: Account Selector, Layout Switcher & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Account Selector in CRM Header */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-xs">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400 text-[11px] hidden sm:inline">{isAr ? "الحساب:" : "Acc:"}</span>
            <select
              id="crm-header-account-select"
              value={selectedAccountId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAccountId(val);
                fetchExtractedChats(val);
              }}
              className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer max-w-[170px] truncate"
            >
              <option value="all" className="bg-slate-900 text-white">
                {isAr ? "🌐 كل الحسابات (مدمج)" : "🌐 All Accounts"}
              </option>
              {accountsList.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                  {acc.status === "CONNECTED" ? "🟢" : "⚪"} {acc.name} {acc.phone ? `(${acc.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          {onOpenAccountManager && (
            <button
              onClick={onOpenAccountManager}
              title={isAr ? "إدارة حسابات واتساب وربط رقم جديد" : "Manage WhatsApp accounts"}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xl:inline text-[11px]">{isAr ? "ربط رقم" : "Link"}</span>
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="bg-slate-800/90 border border-slate-700/80 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              id="layout-split-btn"
              onClick={() => setLayoutMode("split")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                layoutMode === "split" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
              title={isAr ? "عرض مزدوج (الواتساب باليسار + CRM باليمين)" : "Dual View (WhatsApp left + CRM right)"}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{isAr ? "عرض مزدوج" : "Split View"}</span>
            </button>

            <button
              id="layout-whatsapp-btn"
              onClick={() => setLayoutMode("whatsapp")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                layoutMode === "whatsapp" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
              title={isAr ? "الواتساب فقط" : "WhatsApp Only"}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isAr ? "واتساب فقط" : "WhatsApp"}</span>
            </button>

            <button
              id="layout-crm-btn"
              onClick={() => setLayoutMode("crm")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                layoutMode === "crm" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
              title={isAr ? "لوحة CRM فقط" : "CRM Only"}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>{isAr ? "لوحة CRM" : "CRM Only"}</span>
            </button>
          </div>

          {/* Sync & Backup Actions */}
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={leadsFileInputRef}
              onChange={handleImportLeadsJson}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={handleFullSync}
              disabled={isSyncingAll}
              title={isAr ? "مزامنة دقيقة وشاملة لكل أرقام ومحادثات الواتساب" : "Deep sync all WhatsApp chats & numbers"}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingAll ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isAr ? "مزامنة دقيقة" : "Accurate Sync"}</span>
            </button>

            <button
              onClick={handleExportLeadsJson}
              title={isAr ? "تصدير نسخة احتياطية للعملاء بصيغة JSON" : "Export leads JSON"}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            <button
              onClick={() => leadsFileInputRef.current?.click()}
              title={isAr ? "استرجاع نسخة احتياطية للعملاء من ملف JSON" : "Restore leads JSON"}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400 rotate-180" />
            </button>

            <button
              onClick={handleScanCrmDuplicates}
              title={isAr ? "فحص وتنظيف الأرقام المكررة في الـ CRM" : "Scan & Clean Duplicate Leads"}
              className="flex items-center gap-1 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-amber-300 hover:text-amber-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{isAr ? "تنظيف المكررات" : "Clean Dups"}</span>
            </button>

            <button
              id="open-new-lead-modal-btn"
              onClick={() => setIsNewLeadModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isAr ? "+ عميل جديد" : "+ New Lead"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Layout: WhatsApp Web on Physical Left, CRM on Right */}
      <div
        className={`flex flex-col ${
          layoutMode === "split" ? "lg:flex-row-reverse gap-4" : ""
        }`}
      >
        {/* Left Side (in RTL with flex-row-reverse, this sits on the physical LEFT): WhatsApp Panel */}
        {(layoutMode === "split" || layoutMode === "whatsapp") && (
          <div
            className={`${
              layoutMode === "split"
                ? "w-full lg:w-[420px] shrink-0"
                : "w-full"
            }`}
          >
            <WhatsAppChatPanel
              language={language}
              waStatus={waStatus}
              accounts={accountsList}
              selectedAccountId={selectedAccountId}
              onSelectAccountId={(id) => {
                setSelectedAccountId(id);
                fetchExtractedChats(id);
              }}
              onOpenAccountManager={onOpenAccountManager}
              extractedChats={extractedChats}
              leads={leads}
              onConvertChatToLead={handleConvertChat}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onRefreshChats={fetchExtractedChats}
              onUpdateLeadStage={handleUpdateStage}
            />
          </div>
        )}

        {/* Right Side: Clean CRM Workspace (Pipeline, Table, Follow-ups) */}
        {(layoutMode === "split" || layoutMode === "crm") && (
          <div className="flex-1 min-w-0 space-y-4">
            {/* Sub-Tabs & Action Bar */}
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              {/* Sub-tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  id="tab-sub-pipeline"
                  onClick={() => setActiveSubTab("pipeline")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeSubTab === "pipeline"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>{isAr ? "مراحل المبيعات (Pipeline)" : "Pipeline"}</span>
                </button>

                <button
                  id="tab-sub-table"
                  onClick={() => setActiveSubTab("table")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeSubTab === "table"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>{isAr ? "جدول العملاء الكامل" : "Leads Table"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                    {filteredLeads.length}
                  </span>
                </button>

                <button
                  id="tab-sub-followups"
                  onClick={() => setActiveSubTab("followups")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeSubTab === "followups"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isAr ? "المتابعات والتذكيرات" : "Follow-ups"}</span>
                  {dueFollowUpLeads.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      {dueFollowUpLeads.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedLeadIds.length > 0 && (
                  <button
                    id="push-campaign-btn"
                    onClick={handlePushSelectedToCampaign}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-xl font-medium transition cursor-pointer shadow-sm"
                  >
                    <Send className="w-3 h-3" />
                    <span>
                      {isAr
                        ? `نقل للحملة (${selectedLeadIds.length})`
                        : `Push (${selectedLeadIds.length})`}
                    </span>
                  </button>
                )}

                <button
                  id="bulk-convert-btn"
                  onClick={handleBulkConvertUnregistered}
                  title={isAr ? "سحب جميع أرقام الواتساب غير المسجلة وتحويلها لعملاء" : "Convert all unregistered chats to leads"}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer border border-slate-700"
                >
                  <UserPlus className="w-3 h-3 text-amber-400" />
                  <span>{isAr ? "سحب كل الأرقام" : "Bulk Convert"}</span>
                </button>

                <button
                  id="export-csv-btn"
                  onClick={handleExportCSV}
                  title={isAr ? "تصدير إلى ملف CSV" : "Export to CSV"}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer border border-slate-700"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: Pipeline Kanban View */}
            {activeSubTab === "pipeline" && (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-3 min-w-[960px]">
                  {STAGES.map((stage) => {
                    const stageLeads = filteredLeads.filter((l) => l.stage === stage.id);
                    const stageTotalVal = stageLeads.reduce((s, l) => s + (Number(l.dealValue) || 0), 0);

                    return (
                      <div
                        key={stage.id}
                        className="flex-1 min-w-[210px] bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col max-h-[660px]"
                      >
                        {/* Column Header */}
                        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800">
                          <div>
                            <span className={`text-xs font-bold block ${stage.color}`}>
                              {isAr ? stage.nameAr : stage.nameEn}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {stageTotalVal > 0 ? `${stageTotalVal.toLocaleString()} ر.س` : ""}
                            </span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                            {stageLeads.length}
                          </span>
                        </div>

                        {/* Cards List */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pe-1">
                          {stageLeads.length === 0 ? (
                            <div className="py-8 text-center text-slate-600 text-xs border border-dashed border-slate-800 rounded-xl">
                              {isAr ? "لا يوجد عملاء هنا" : "No leads"}
                            </div>
                          ) : (
                            stageLeads.map((lead) => (
                              <div
                                key={lead.id}
                                id={`lead-card-${lead.id}`}
                                onClick={() => setSelectedLead(lead)}
                                className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/70 hover:border-emerald-500/50 rounded-xl p-3 cursor-pointer transition shadow-sm group select-none"
                              >
                                <div className="flex items-start justify-between gap-1 mb-1.5">
                                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition truncate">
                                    {lead.name}
                                  </h4>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                                      lead.priority === "high"
                                        ? "bg-rose-500/20 text-rose-300"
                                        : lead.priority === "medium"
                                        ? "bg-amber-500/20 text-amber-300"
                                        : "bg-blue-500/20 text-blue-300"
                                    }`}
                                  >
                                    {lead.priority === "high"
                                      ? isAr
                                        ? "عالية"
                                        : "High"
                                      : lead.priority === "medium"
                                      ? isAr
                                        ? "متوسطة"
                                        : "Med"
                                      : isAr
                                      ? "عادية"
                                      : "Low"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono dir-ltr justify-end mb-1">
                                  <span>+{lead.phone}</span>
                                </div>

                                {lead.company && (
                                  <p className="text-[11px] text-slate-400 truncate mb-1 flex items-center gap-1">
                                    <Building2 className="w-3 h-3 shrink-0 text-slate-500" />
                                    <span>{lead.company}</span>
                                  </p>
                                )}

                                {lead.dealValue ? (
                                  <div className="text-[11px] text-emerald-400 font-bold mb-1.5">
                                    {Number(lead.dealValue).toLocaleString()}{" "}
                                    <span className="text-[9px] text-slate-500 font-normal">
                                      {isAr ? "ر.س" : "SAR"}
                                    </span>
                                  </div>
                                ) : null}

                                {/* Next Follow-up alert if exists */}
                                {lead.nextFollowUpDate && (
                                  <div
                                    className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                      lead.isFollowUpDone
                                        ? "bg-slate-700/40 text-slate-400"
                                        : lead.nextFollowUpDate <= todayStr
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        : "bg-slate-800 text-slate-400"
                                    }`}
                                  >
                                    <Clock className="w-3 h-3" />
                                    <span>{lead.nextFollowUpDate}</span>
                                  </div>
                                )}

                                {/* Quick Stage Mover */}
                                <div
                                  className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <select
                                    id={`stage-change-${lead.id}`}
                                    value={lead.stage}
                                    onChange={(e) => handleUpdateStage(lead.id, e.target.value as LeadStage)}
                                    className="bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                                  >
                                    {STAGES.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {isAr ? s.nameAr : s.nameEn}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    onClick={() => setSelectedLead(lead)}
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                                  >
                                    <span>{isAr ? "التفاصيل" : "Details"}</span>
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Full Table View */}
            {activeSubTab === "table" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Search & Filters Inside Table */}
                <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="leads-search-input"
                      type="text"
                      placeholder={isAr ? "بحث بالاسم، الرقم، الشركة، التاج..." : "Search leads..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      id="leads-stage-filter"
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="all">{isAr ? "جميع المراحل" : "All Stages"}</option>
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {isAr ? s.nameAr : s.nameEn}
                        </option>
                      ))}
                    </select>

                    <select
                      id="leads-priority-filter"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="all">{isAr ? "كل الأولويات" : "All Priorities"}</option>
                      <option value="high">{isAr ? "عالية" : "High"}</option>
                      <option value="medium">{isAr ? "متوسطة" : "Medium"}</option>
                      <option value="low">{isAr ? "منخفضة" : "Low"}</option>
                    </select>
                  </div>
                </div>

                {/* Table Body */}
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredLeads.length > 0 &&
                              selectedLeadIds.length === filteredLeads.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeadIds(filteredLeads.map((l) => l.id));
                              } else {
                                setSelectedLeadIds([]);
                              }
                            }}
                            className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 text-start">{isAr ? "العميل" : "Lead"}</th>
                        <th className="p-3 text-start">{isAr ? "رقم الهاتف" : "Phone"}</th>
                        <th className="p-3 text-start">{isAr ? "الشركة" : "Company"}</th>
                        <th className="p-3 text-start">{isAr ? "المرحلة" : "Stage"}</th>
                        <th className="p-3 text-start">{isAr ? "قيمة الصفقة" : "Deal Value"}</th>
                        <th className="p-3 text-start">{isAr ? "المتابعة القادمة" : "Next Follow-up"}</th>
                        <th className="p-3 text-center">{isAr ? "إجراءات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500">
                            {isAr ? "لا يوجد عملاء مطابقين للبحث" : "No leads matching criteria"}
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((lead) => {
                          const isChecked = selectedLeadIds.includes(lead.id);
                          const stageObj = STAGES.find((s) => s.id === lead.stage);

                          return (
                            <tr
                              key={lead.id}
                              className={`hover:bg-slate-800/40 transition cursor-pointer ${
                                isChecked ? "bg-emerald-950/20" : ""
                              }`}
                              onClick={() => setSelectedLead(lead)}
                            >
                              <td
                                className="p-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedLeadIds((prev) => [...prev, lead.id]);
                                    } else {
                                      setSelectedLeadIds((prev) => prev.filter((id) => id !== lead.id));
                                    }
                                  }}
                                  className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-semibold text-white">
                                <div>{lead.name}</div>
                                {lead.tags.length > 0 && (
                                  <div className="flex gap-1 mt-0.5">
                                    {lead.tags.slice(0, 2).map((t, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-300 dir-ltr text-start">
                                +{lead.phone}
                              </td>
                              <td className="p-3 text-slate-400">{lead.company || "-"}</td>
                              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={lead.stage}
                                  onChange={(e) => handleUpdateStage(lead.id, e.target.value as LeadStage)}
                                  className={`text-xs px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                    stageObj?.bg || "bg-slate-800 border-slate-700 text-slate-300"
                                  }`}
                                >
                                  {STAGES.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {isAr ? s.nameAr : s.nameEn}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3 text-emerald-400 font-bold">
                                {lead.dealValue ? `${Number(lead.dealValue).toLocaleString()} ر.س` : "-"}
                              </td>
                              <td className="p-3">
                                {lead.nextFollowUpDate ? (
                                  <span
                                    className={`text-[11px] px-2 py-0.5 rounded-md ${
                                      lead.isFollowUpDone
                                        ? "line-through text-slate-500"
                                        : lead.nextFollowUpDate <= todayStr
                                        ? "bg-amber-500/20 text-amber-300 font-semibold"
                                        : "text-slate-300"
                                    }`}
                                  >
                                    {lead.nextFollowUpDate}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedLead(lead)}
                                    className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                                    title={isAr ? "عرض الملف" : "View"}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setLeadToDelete({ id: lead.id, name: lead.name || lead.phone })}
                                    className="p-1 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                                    title={isAr ? "حذف" : "Delete"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Follow-ups Agenda */}
            {activeSubTab === "followups" && (
              <div className="space-y-4">
                {/* Due Today & Overdue Card */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-bold text-white">
                        {isAr ? "متابعات مستحقة اليوم ومتأخرة" : "Due Today & Overdue"}
                      </h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                      {dueFollowUpLeads.length}
                    </span>
                  </div>

                  {dueFollowUpLeads.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-60" />
                      <p>{isAr ? "رائع! لا توجد متابعات متأخرة أو مستحقة اليوم" : "All clear! No pending follow-ups"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dueFollowUpLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="bg-slate-800/80 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={lead.isFollowUpDone}
                              onChange={() => handleToggleFollowUpDone(lead)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4
                                  onClick={() => setSelectedLead(lead)}
                                  className="text-xs font-bold text-white hover:text-emerald-400 cursor-pointer"
                                >
                                  {lead.name}
                                </h4>
                                <span className="text-[10px] font-mono text-slate-400">
                                  +{lead.phone}
                                </span>
                              </div>
                              <p className="text-xs text-amber-200 mt-0.5">
                                {lead.nextFollowUpNote || (isAr ? "متابعة تواصل" : "General follow-up")}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-400 font-medium">
                              {lead.nextFollowUpTime || "12:00"}
                            </span>
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-medium transition cursor-pointer"
                            >
                              {isAr ? "متابعة الآن" : "Action"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Follow-ups */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs font-bold text-white">
                        {isAr ? "المتابعات القادمة مجدولة" : "Upcoming Scheduled Follow-ups"}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {leads
                      .filter((l) => l.nextFollowUpDate && l.nextFollowUpDate > todayStr)
                      .map((lead) => (
                        <div
                          key={lead.id}
                          className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <h4
                              onClick={() => setSelectedLead(lead)}
                              className="text-xs font-bold text-white hover:text-emerald-400 cursor-pointer"
                            >
                              {lead.name}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {lead.nextFollowUpNote || (isAr ? "متابعة مجدولة" : "Scheduled")}
                            </p>
                          </div>
                          <div className="text-end">
                            <span className="text-xs text-slate-300 block font-medium">
                              {lead.nextFollowUpDate}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {lead.nextFollowUpTime || "12:00"}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Lead Profile Drawer (Slide-Over) */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border-s border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                  {selectedLead.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedLead.name}</h3>
                  <span className="text-xs text-slate-400 font-mono dir-ltr block text-start">
                    +{selectedLead.phone}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Sub-Tabs */}
            <div className="bg-slate-900 border-b border-slate-800 p-2 flex items-center gap-2 text-xs">
              <button
                onClick={() => setDrawerActiveTab("overview")}
                className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition cursor-pointer ${
                  drawerActiveTab === "overview"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {isAr ? "البيانات والمتابعة" : "Overview & Tasks"}
              </button>
              <button
                onClick={() => setDrawerActiveTab("activities")}
                className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition cursor-pointer ${
                  drawerActiveTab === "activities"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {isAr ? "سجل الأنشطة" : "Activities"} ({selectedLead.activities?.length || 0})
              </button>
              <button
                onClick={() => setDrawerActiveTab("messages")}
                className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                  drawerActiveTab === "messages"
                    ? "bg-cyan-600 text-white"
                    : "text-cyan-400 hover:bg-cyan-500/10"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isAr ? "رسائل وطلب العميل" : "Messages & Request"}</span>
                {leadMessages.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950 text-cyan-300 rounded-full border border-cyan-500/30">
                    {leadMessages.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setDrawerActiveTab("ai")}
                className={`flex-1 py-1.5 rounded-lg text-center font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                  drawerActiveTab === "ai"
                    ? "bg-purple-600 text-white"
                    : "text-purple-400 hover:bg-purple-500/10"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAr ? "تحليل الذكاء (AI)" : "AI Analysis"}</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Tab 1: Overview */}
              {drawerActiveTab === "overview" && (
                <div className="space-y-4 text-xs">
                  {/* Stage & Priority Controls */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div>
                      <label className="text-slate-400 block mb-1">{isAr ? "مرحلة العميل" : "Stage"}</label>
                      <select
                        value={selectedLead.stage}
                        onChange={(e) => handleUpdateStage(selectedLead.id, e.target.value as LeadStage)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {isAr ? s.nameAr : s.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">{isAr ? "الأولوية" : "Priority"}</label>
                      <select
                        value={selectedLead.priority}
                        onChange={async (e) => {
                          const p = e.target.value as LeadPriority;
                          await fetch(`/api/crm/leads/${selectedLead.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ priority: p }),
                          });
                          setSelectedLead({ ...selectedLead, priority: p });
                          setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? { ...l, priority: p } : l)));
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="high">{isAr ? "عالية (High)" : "High"}</option>
                        <option value="medium">{isAr ? "متوسطة (Medium)" : "Medium"}</option>
                        <option value="low">{isAr ? "منخفضة (Low)" : "Low"}</option>
                      </select>
                    </div>
                  </div>

                  {/* Company & Deal Value */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-400 block mb-1">{isAr ? "الشركة" : "Company"}</span>
                      <span className="text-white font-semibold">{selectedLead.company || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">{isAr ? "قيمة الصفقة" : "Deal Value"}</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedLead.dealValue ? `${Number(selectedLead.dealValue).toLocaleString()} ر.س` : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Next Follow-up Scheduler Box */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isAr ? "المتابعة القادمة والتذكير" : "Next Follow-up"}</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">{isAr ? "التاريخ" : "Date"}</label>
                        <input
                          type="date"
                          value={selectedLead.nextFollowUpDate || ""}
                          onChange={async (e) => {
                            const val = e.target.value;
                            await fetch(`/api/crm/leads/${selectedLead.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ nextFollowUpDate: val, isFollowUpDone: false }),
                            });
                            setSelectedLead({ ...selectedLead, nextFollowUpDate: val, isFollowUpDone: false });
                            setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? { ...l, nextFollowUpDate: val, isFollowUpDone: false } : l)));
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">{isAr ? "الوقت" : "Time"}</label>
                        <input
                          type="time"
                          value={selectedLead.nextFollowUpTime || "12:00"}
                          onChange={async (e) => {
                            const val = e.target.value;
                            await fetch(`/api/crm/leads/${selectedLead.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ nextFollowUpTime: val }),
                            });
                            setSelectedLead({ ...selectedLead, nextFollowUpTime: val });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">{isAr ? "ملاحظة المتابعة" : "Follow-up Task Note"}</label>
                      <input
                        type="text"
                        placeholder={isAr ? "مثال: اتصال للتأكيد على إرسال العرض" : "e.g. Call to confirm proposal"}
                        value={selectedLead.nextFollowUpNote || ""}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setSelectedLead({ ...selectedLead, nextFollowUpNote: val });
                        }}
                        onBlur={async () => {
                          await fetch(`/api/crm/leads/${selectedLead.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ nextFollowUpNote: selectedLead.nextFollowUpNote }),
                          });
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>

                  {/* Notes Box */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <label className="text-slate-400 block mb-1">{isAr ? "ملاحظات وتفاصيل العميل" : "Notes"}</label>
                    <textarea
                      rows={3}
                      value={selectedLead.notes || ""}
                      onChange={(e) => setSelectedLead({ ...selectedLead, notes: e.target.value })}
                      onBlur={async () => {
                        await fetch(`/api/crm/leads/${selectedLead.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ notes: selectedLead.notes }),
                        });
                        showToast(isAr ? "تم حفظ الملاحظات" : "Notes saved");
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Activities */}
              {drawerActiveTab === "activities" && (
                <div className="space-y-4">
                  {/* Add Activity Form */}
                  <form onSubmit={handleAddActivitySubmit} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                    <h4 className="font-bold text-white flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isAr ? "تسجيل نشاط أو تواصل جديد" : "Log New Activity"}</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">{isAr ? "نوع النشاط" : "Type"}</label>
                        <select
                          value={activityForm.type}
                          onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white"
                        >
                          <option value="call">{isAr ? "📞 مكالمة هاتفية" : "Call"}</option>
                          <option value="whatsapp">{isAr ? "💬 محادثة واتساب" : "WhatsApp"}</option>
                          <option value="meeting">{isAr ? "🤝 اجتماع أو مقابلة" : "Meeting"}</option>
                          <option value="note">{isAr ? "📝 ملاحظة داخلية" : "Note"}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 block mb-1">{isAr ? "عنوان النشاط" : "Title"}</label>
                        <input
                          type="text"
                          required
                          placeholder={isAr ? "مثال: مكالمة استفسار" : "e.g. Follow-up call"}
                          value={activityForm.title}
                          onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">{isAr ? "تفاصيل ما حدث" : "Details"}</label>
                      <input
                        type="text"
                        placeholder={isAr ? "ملخص المحادثة والنتائج..." : "Outcome and summary..."}
                        value={activityForm.note}
                        onChange={(e) => setActivityForm({ ...activityForm, note: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg font-semibold transition"
                    >
                      {isAr ? "تسجيل النشاط" : "Save Activity"}
                    </button>
                  </form>

                  {/* Activity Timeline */}
                  <div className="space-y-2">
                    {selectedLead.activities?.map((act) => (
                      <div key={act.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            {act.type === "call" && "📞"}
                            {act.type === "whatsapp" && "💬"}
                            {act.type === "meeting" && "🤝"}
                            {act.type === "note" && "📝"}
                            {act.title}
                          </span>
                          <span className="text-[10px] text-slate-500">{act.timestamp}</span>
                        </div>
                        {act.note && <p className="text-slate-400 mt-1">{act.note}</p>}
                        {act.outcome && (
                          <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {act.outcome}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: AI Analysis */}
              {drawerActiveTab === "ai" && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between bg-purple-950/40 border border-purple-800/50 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-purple-200">
                        {isAr ? "تحليل Gemini AI للمحادثة والعميل" : "Gemini AI Lead Analysis"}
                      </span>
                    </div>
                    <button
                      onClick={handleAnalyzeWithAI}
                      disabled={isAnalyzingAI}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg font-semibold transition cursor-pointer"
                    >
                      {isAnalyzingAI
                        ? isAr
                          ? "جاري التحليل..."
                          : "Analyzing..."
                        : isAr
                        ? "تحليل الآن"
                        : "Analyze"}
                    </button>
                  </div>

                  {selectedLead.aiAnalysis ? (
                    <div className="space-y-3">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <h4 className="text-slate-400 block mb-1 font-semibold">{isAr ? "ملخص حالة العميل" : "Summary"}</h4>
                        <p className="text-slate-200 leading-relaxed">{selectedLead.aiAnalysis.summary}</p>
                      </div>

                      {selectedLead.aiAnalysis.recommendedAction && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <h4 className="text-amber-400 block mb-1 font-semibold">{isAr ? "الخطوة التالية الموصى بها" : "Recommended Next Action"}</h4>
                          <p className="text-slate-200">{selectedLead.aiAnalysis.recommendedAction}</p>
                        </div>
                      )}

                      {selectedLead.aiAnalysis.suggestedMessage && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-purple-900/40">
                          <h4 className="text-purple-400 block mb-1 font-semibold">{isAr ? "الرد التسويقي المقترح" : "Suggested Response"}</h4>
                          <p className="text-slate-200 italic mb-2">"{selectedLead.aiAnalysis.suggestedMessage}"</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedLead.aiAnalysis?.suggestedMessage || "");
                              showToast(isAr ? "تم نسخ الرد المقترح" : "Copied suggested response");
                            }}
                            className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{isAr ? "نسخ الرد" : "Copy Response"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 text-purple-400 opacity-40" />
                      <p>{isAr ? "اضغط على زر (تحليل الآن) لاستخراج توصيات ذكية عن العميل ومحادثاته" : "Click analyze to get AI insights"}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Messages & Customer Request */}
              {drawerActiveTab === "messages" && (
                <div className="space-y-3.5 text-xs">
                  {/* Top Bar for Messages: Sync & Request Analysis */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-cyan-400" />
                        <span>{isAr ? "سجل محادثة ورسائل العميل على الواتساب" : "WhatsApp Chat & Customer Request"}</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {leadMessages.length > 0
                          ? isAr
                            ? `تم استخراج ${leadMessages.length} رسالة مسجلة لهذا العميل`
                            : `${leadMessages.length} messages found for this client`
                          : isAr
                          ? "لم يتم سحب الرسائل بعد لهذا العميل"
                          : "No messages pulled yet"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSyncLeadMessages}
                        disabled={isSyncingLeadMessages}
                        className="flex items-center gap-1.5 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                        title={isAr ? "سحب سجل الرسائل والمحادثة لهذا العميل من واتساب" : "Sync WhatsApp chat history"}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLeadMessages ? "animate-spin text-cyan-400" : ""}`} />
                        <span>{isSyncingLeadMessages ? (isAr ? "جاري السحب..." : "Syncing...") : (isAr ? "سحب رسائل العميل" : "Sync Messages")}</span>
                      </button>

                      {leadMessages.length > 0 && (
                        <button
                          onClick={handleAnalyzeLeadCustomerRequest}
                          disabled={isAnalyzingLeadRequest}
                          className="flex items-center gap-1.5 bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                          title={isAr ? "تحليل وتوضيح ماذا كان يطلب العميل بدقة بالذكاء الاصطناعي" : "Analyze what the client requested using AI"}
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${isAnalyzingLeadRequest ? "animate-spin" : ""}`} />
                          <span>{isAnalyzingLeadRequest ? (isAr ? "جاري التحليل..." : "Analyzing...") : (isAr ? "ماذا كان يطلب العميل؟" : "What did client request?")}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* AI Customer Request Breakdown Card */}
                  {leadRequestSummary && (
                    <div className="bg-purple-950/50 border border-purple-500/30 p-3.5 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-purple-300 flex items-center gap-1.5">
                          <Bot className="w-4 h-4 text-purple-400" />
                          <span>{isAr ? "ملخص ما كان يطلبه العميل (تحليل الذكاء الاصطناعي)" : "Customer Request Summary (AI)"}</span>
                        </h4>
                        <button
                          onClick={() => setLeadRequestSummary(null)}
                          className="text-purple-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed text-purple-100 bg-slate-950/70 p-3 rounded-lg border border-purple-500/20">
                        {leadRequestSummary}
                      </div>
                    </div>
                  )}

                  {/* Messages Stream Container */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 min-h-[260px] max-h-[420px] overflow-y-auto space-y-2.5">
                    {isLoadingLeadMessages ? (
                      <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                        <span>{isAr ? "جاري تحميل رسائل العميل..." : "Loading messages..."}</span>
                      </div>
                    ) : leadMessages.length === 0 ? (
                      <div className="text-center py-10 space-y-3">
                        <MessageSquare className="w-10 h-10 mx-auto text-cyan-400/40" />
                        <p className="font-semibold text-slate-300">
                          {isAr ? "لم يتم سحب رسائل هذا العميل من واتساب بعد" : "No WhatsApp messages pulled yet"}
                        </p>
                        <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
                          {isAr
                            ? "اضغط على زر 'سحب رسائل العميل' لجلب الرسائل والمحادثة المتبادلة لمعرفة ماذا كان يطلب بدقة."
                            : "Click 'Sync Messages' to pull the client's conversation from WhatsApp."}
                        </p>
                        <button
                          onClick={handleSyncLeadMessages}
                          disabled={isSyncingLeadMessages}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow transition cursor-pointer"
                        >
                          {isSyncingLeadMessages
                            ? isAr
                              ? "جاري السحب..."
                              : "Pulling..."
                            : isAr
                            ? "سحب رسائل العميل الآن من واتساب"
                            : "Pull Client Messages Now"}
                        </button>
                      </div>
                    ) : (
                      leadMessages.map((msg) => {
                        const isMe = msg.fromMe;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-sm leading-relaxed ${
                                isMe
                                  ? "bg-emerald-600 text-white rounded-tr-xs"
                                  : "bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-xs"
                              }`}
                            >
                              {!isMe && (
                                <span className="block text-[10px] font-bold text-cyan-400 mb-0.5">
                                  {msg.senderName || selectedLead.name || selectedLead.phone}
                                </span>
                              )}
                              <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                              <div
                                className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                                  isMe ? "text-emerald-200" : "text-slate-400"
                                }`}
                              >
                                <span>{msg.timestamp}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {isNewLeadModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "إضافة عميل جديد للـ CRM" : "Add New CRM Lead"}
                </h3>
              </div>
              <button
                onClick={() => setIsNewLeadModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">{isAr ? "اسم العميل" : "Name"}</label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? "مثال: م. محمود حسن" : "e.g. John Doe"}
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">{isAr ? "رقم الهاتف" : "Phone"}</label>
                  <input
                    type="text"
                    required
                    placeholder="201012345678"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">{isAr ? "الشركة أو المؤسسة" : "Company"}</label>
                  <input
                    type="text"
                    placeholder={isAr ? "اسم الشركة (اختياري)" : "Company name"}
                    value={newLeadForm.company}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">{isAr ? "قيمة الصفقة المتوقعة" : "Deal Value"}</label>
                  <input
                    type="number"
                    placeholder="5000"
                    value={newLeadForm.dealValue || ""}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, dealValue: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">{isAr ? "المرحلة الأولى" : "Stage"}</label>
                  <select
                    value={newLeadForm.stage}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, stage: e.target.value as LeadStage })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white cursor-pointer"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {isAr ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">{isAr ? "الأولوية" : "Priority"}</label>
                  <select
                    value={newLeadForm.priority}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, priority: e.target.value as LeadPriority })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white cursor-pointer"
                  >
                    <option value="high">{isAr ? "عالية (High)" : "High"}</option>
                    <option value="medium">{isAr ? "متوسطة (Medium)" : "Medium"}</option>
                    <option value="low">{isAr ? "منخفضة (Low)" : "Low"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">{isAr ? "ملاحظات أولية" : "Initial Notes"}</label>
                <textarea
                  rows={2}
                  placeholder={isAr ? "اكتب أي تفاصيل هامة عن العميل..." : "Any relevant info..."}
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewLeadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  id="submit-create-lead-btn"
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl font-semibold transition cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  {isAr ? "حفظ العميل" : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Lead Confirmation Modal */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {isAr ? "حذف العميل من الـ CRM؟" : "Delete Lead from CRM?"}
              </h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {isAr
                  ? `هل أنت متأكد من حذف العميل "${leadToDelete.name}" وجميع سجلات المتابعة الخاصة به؟`
                  : `Are you sure you want to delete "${leadToDelete.name}" and all associated follow-ups?`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteDeleteLead}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? "نعم، حذف العميل" : "Yes, Delete Lead"}</span>
              </button>
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRM Deduplication Modal */}
      {deduplicateModalState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr ? "تنظيف الأرقام المكررة في الـ CRM" : "Clean Duplicate Leads in CRM"}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? `تم العثور على ${deduplicateModalState.totalDuplicateRows} تكرار عبر ${deduplicateModalState.duplicates.length} رقم مختلف`
                      : `Found ${deduplicateModalState.totalDuplicateRows} duplicates across ${deduplicateModalState.duplicates.length} numbers`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeduplicateModalState(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200">
              {isAr
                ? "سيتم دمج بيانات العملاء المكررة في عميل واحد موحد، مع الاحتفاظ بجميع الملاحظات وسجلات المتابعة والصفقات وإزالة السجلات المكررة."
                : "Duplicate records will be merged into a single lead, retaining all activities, notes, deals, and removing duplicates."}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {deduplicateModalState.duplicates.map((dup, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-white dir-ltr">
                        +{dup.phone}
                      </span>
                      {dup.names.length > 0 && (
                        <span className="text-slate-300">({dup.names.join(", ")})</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isAr ? "المراحل:" : "Stages:"} {dup.stages.join("، ")}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                    {isAr ? `مكرر ${dup.count} مرات` : `${dup.count} records`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                {isAr
                  ? `سيتم إزالة ${deduplicateModalState.totalDuplicateRows} سجل زائد`
                  : `Will remove ${deduplicateModalState.totalDuplicateRows} redundant rows`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeduplicateModalState(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeduplicateCrm}
                  disabled={isDeduplicating}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {isDeduplicating
                      ? isAr
                        ? "جاري الدمج والتنظيف..."
                        : "Cleaning..."
                      : isAr
                      ? `دمج وتنظيف ${deduplicateModalState.totalDuplicateRows} تكرار الآن`
                      : `Merge & Clean Duplicates Now`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
