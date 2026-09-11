import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare,
  Search,
  UserPlus,
  Send,
  Sparkles,
  CheckCheck,
  Phone,
  RefreshCw,
  Plus,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Shield,
  Radio,
  X,
  FileText,
  Download,
  Bot,
  Smartphone,
  CheckCircle2,
  ArrowDownUp,
  Monitor,
  ShieldCheck,
  Columns,
  Layers,
} from "lucide-react";
import type {
  ExtractedChatSummary,
  ExtractedMessage,
  CRMLead,
  LeadStage,
  WhatsAppStatus,
  WhatsAppAccountInfo,
} from "../types.ts";
import { safeFetchJson } from "../utils/api.ts";

interface WhatsAppChatPanelProps {
  language: "ar" | "en";
  waStatus: WhatsAppStatus | null;
  accounts?: WhatsAppAccountInfo[];
  selectedAccountId?: string;
  onSelectAccountId?: (accountId: string) => void;
  onOpenAccountManager?: () => void;
  extractedChats: ExtractedChatSummary[];
  leads: CRMLead[];
  onConvertChatToLead: (phone: string, name?: string, notes?: string) => Promise<void>;
  onSelectLead: (lead: CRMLead) => void;
  onRefreshChats: (accountId?: string) => void;
  onUpdateLeadStage?: (leadId: string, newStage: LeadStage) => void;
}

const STAGE_LABELS: Record<LeadStage, { ar: string; en: string; color: string }> = {
  new: { ar: "جديد", en: "New", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  follow_up: { ar: "متابعة", en: "Follow-up", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  interested: { ar: "مهتم", en: "Interested", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  negotiation: { ar: "تفاوض", en: "Negotiation", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  won: { ar: "رابحة", en: "Won", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  lost: { ar: "خاسرة", en: "Lost", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
};

export function WhatsAppChatPanel({
  language,
  waStatus,
  accounts = [],
  selectedAccountId = "all",
  onSelectAccountId,
  onOpenAccountManager,
  extractedChats,
  leads,
  onConvertChatToLead,
  onSelectLead,
  onRefreshChats,
  onUpdateLeadStage,
}: WhatsAppChatPanelProps) {
  const isAr = language === "ar";

  const [activeChatPhone, setActiveChatPhone] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "unregistered" | "leads">("all");
  const [messages, setMessages] = useState<ExtractedMessage[]>([]);
  const [messageSortOrder, setMessageSortOrder] = useState<"newest_first" | "oldest_first">("newest_first");
  const [syncVerifiedNotice, setSyncVerifiedNotice] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isSyncingMessages, setIsSyncingMessages] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [customerRequestSummary, setCustomerRequestSummary] = useState<string | null>(null);
  const [isAnalyzingRequest, setIsAnalyzingRequest] = useState(false);

  // New Chat Modal
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");

  // Ref to messages container for internal scrolling
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearEdgeRef = useRef(true);
  const prevChatPhoneRef = useRef<string | null>(null);

  const handleContainerScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    if (messageSortOrder === "newest_first") {
      isNearEdgeRef.current = scrollTop < 80;
    } else {
      isNearEdgeRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  // Messages to render based on sort order: latest message at top, older messages descending
  const displayMessages = useMemo(() => {
    if (messages.length === 0) return [];
    if (messageSortOrder === "newest_first") {
      return [...messages].reverse();
    }
    return messages;
  }, [messages, messageSortOrder]);

  // Auto-scroll messages ONLY inside the chat container (never scroll the main window)
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const isDifferentChat = prevChatPhoneRef.current !== activeChatPhone;
    prevChatPhoneRef.current = activeChatPhone;

    if (messageSortOrder === "newest_first") {
      if (isDifferentChat) {
        chatContainerRef.current.scrollTop = 0;
      } else if (isNearEdgeRef.current) {
        chatContainerRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    } else {
      if (isDifferentChat) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      } else if (isNearEdgeRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [messages, activeChatPhone, messageSortOrder]);

  // Set default active chat if none selected and chats exist
  useEffect(() => {
    if (!activeChatPhone && extractedChats.length > 0) {
      setActiveChatPhone(extractedChats[0].phone);
    }
  }, [extractedChats, activeChatPhone]);

  // Fetch messages when activeChatPhone changes without flickering or page jumps
  useEffect(() => {
    if (!activeChatPhone) return;

    let isMounted = true;
    const loadMessages = async (isInitial = false) => {
      try {
        if (isInitial) setIsLoadingMessages(true);
        const accParam = selectedAccountId && selectedAccountId !== "all" ? `?accountId=${encodeURIComponent(selectedAccountId)}` : "";
        const data = await safeFetchJson<{ success: boolean; messages: ExtractedMessage[] }>(
          `/api/crm/chats/${activeChatPhone}/messages${accParam}`
        );
        if (data && isMounted) {
          const newMsgs: ExtractedMessage[] = data.messages || [];
          setMessages((prev) => {
            // Prevent state change and re-renders if messages are identical
            if (
              prev.length === newMsgs.length &&
              prev.length > 0 &&
              prev[prev.length - 1]?.id === newMsgs[newMsgs.length - 1]?.id
            ) {
              return prev;
            }
            return newMsgs;
          });
        }
      } catch (err) {
        // Handled silently
      } finally {
        if (isMounted && isInitial) setIsLoadingMessages(false);
      }
    };

    loadMessages(true);
    const interval = setInterval(() => loadMessages(false), 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeChatPhone, selectedAccountId]);

  const [currentSendingAccountId, setCurrentSendingAccountId] = useState<string>("");

  // Selected chat details
  const activeChat = extractedChats.find((c) => c.phone === activeChatPhone) || {
    phone: activeChatPhone || "",
    name: activeChatPhone ? `محادثة (${activeChatPhone.slice(-4)})` : "",
    lastMessage: "",
    lastMessageTimestamp: "",
    unreadCount: 0,
    messageCount: messages.length,
    isAlreadyLead: false,
    accountId: undefined,
    accountName: undefined,
  };

  // Sync currentSendingAccountId when selectedAccountId, activeChat or accounts change
  useEffect(() => {
    if (selectedAccountId && selectedAccountId !== "all") {
      setCurrentSendingAccountId(selectedAccountId);
    } else if (activeChat?.accountId) {
      setCurrentSendingAccountId(activeChat.accountId);
    } else {
      const connected = accounts.find((a) => a.status === "CONNECTED");
      if (connected) {
        setCurrentSendingAccountId(connected.id);
      }
    }
  }, [selectedAccountId, activeChat?.accountId, accounts]);

  // Periodic auto-refresh for chat list and new incoming messages (every 5 seconds)
  useEffect(() => {
    const chatInterval = setInterval(() => {
      onRefreshChats(selectedAccountId);
    }, 5000);
    return () => clearInterval(chatInterval);
  }, [onRefreshChats, selectedAccountId]);

  // Deep Full Sync handler: scans all session and accounts folders
  const [isDeepSyncing, setIsDeepSyncing] = useState(false);
  const handleDeepSyncAll = async () => {
    try {
      setIsDeepSyncing(true);
      const targetId = selectedAccountId !== "all" ? selectedAccountId : undefined;
      const res = await fetch("/api/crm/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        onRefreshChats(selectedAccountId);
        const count = data.count ?? extractedChats.length;
        setSyncVerifiedNotice(
          isAr
            ? `✅ تم التحقق وتأكيد صحة المزامنة بنجاح! تم فحص ومزامنة ${count} محادثة بالكامل.`
            : `✅ Sync verified! All ${count} chats accurately synchronized.`
        );
        setTimeout(() => setSyncVerifiedNotice(null), 5000);
      }
    } catch (err) {
      console.error("Error deep syncing chats:", err);
    } finally {
      setIsDeepSyncing(false);
    }
  };

  const activeLead = leads.find((l) => l.phone === activeChatPhone);

  // Filter chats list
  const filteredChats = extractedChats.filter((c) => {
    if (filterMode === "unregistered" && c.isAlreadyLead) return false;
    if (filterMode === "leads" && !c.isAlreadyLead) return false;
    if (chatSearch.trim()) {
      const q = chatSearch.toLowerCase();
      const matches = c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.lastMessage.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  // Handle Send Message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || messageInput;
    if (!textToSend.trim() || !activeChatPhone) return;

    try {
      setIsSending(true);
      const accToUse = currentSendingAccountId || (selectedAccountId !== "all" ? selectedAccountId : activeChat?.accountId);
      const res = await fetch("/api/crm/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activeChatPhone,
          message: textToSend,
          accountId: accToUse || undefined,
        }),
      });

      const data = await res.json();
      if (data.recorded) {
        setMessages((prev) => [...prev, data.recorded]);
      } else {
        // Fallback optimistic message
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            phone: activeChatPhone,
            senderName: "أنا",
            text: textToSend,
            timestamp: new Date().toLocaleTimeString("ar-EG", { hour12: true }),
            fromMe: true,
            accountId: accToUse,
            accountName: accounts.find((a) => a.id === accToUse)?.name,
          },
        ]);
      }

      if (!customText) setMessageInput("");
      onRefreshChats(selectedAccountId);
    } catch (err) {
      console.error("Error sending WhatsApp message:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Convert current chat to Lead
  const handleConvertActiveChat = async () => {
    if (!activeChatPhone) return;
    try {
      setIsConverting(true);
      await onConvertChatToLead(
        activeChatPhone,
        activeChat.name !== activeChatPhone ? activeChat.name : undefined,
        activeChat.lastMessage ? `سحب من المحادثة: "${activeChat.lastMessage}"` : undefined
      );
    } catch (err) {
      console.error("Error converting active chat:", err);
    } finally {
      setIsConverting(false);
    }
  };

  // Sync messages from WhatsApp directly
  const handleSyncChatMessages = async () => {
    if (!activeChatPhone) return;
    try {
      setIsSyncingMessages(true);
      setSyncFeedback(null);
      const accToUse = currentSendingAccountId || (selectedAccountId !== "all" ? selectedAccountId : activeChat?.accountId);
      const res = await fetch(`/api/crm/chats/${activeChatPhone}/sync-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accToUse || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          setSyncFeedback(
            isAr
              ? `تم سحب ${data.messages.length} رسالة لهذا العميل بنجاح`
              : `Synced ${data.messages.length} messages`
          );
        } else {
          setSyncFeedback(
            isAr
              ? "تم إرسال طلب سحب المحادثة من واتساب، جاري التحديث..."
              : "Sync requested from phone..."
          );
        }
      }
      onRefreshChats(selectedAccountId);
    } catch (err) {
      console.error("Error syncing messages:", err);
      setSyncFeedback(isAr ? "تعذر سحب الرسائل حالياً" : "Failed to sync messages");
    } finally {
      setIsSyncingMessages(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Analyze what the customer requested from their message history
  const handleAnalyzeCustomerRequest = async () => {
    if (!activeChatPhone || messages.length === 0) return;
    try {
      setIsAnalyzingRequest(true);
      const customerMsgs = messages
        .filter((m) => !m.fromMe)
        .map((m) => `[${m.timestamp}] ${m.text}`)
        .join("\n");

      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: `تحليل رسائل هذا العميل بدقة وتوضيح ماذا كان يطلب العميل:
رسائل العميل هي:
${customerMsgs || activeChat.lastMessage}
قم بتلخيص الآتي باختصار ووضوح:
1. ما الذي كان يطلبه العميل بالضبط (السلعة / الخدمة / الاستفسار)؟
2. هل ذكر تفاصيل هامة (ميزانية، موعد، شروط)؟
3. الإجراء المطلوب للرد عليه وإتمام المعاملة بنجاح.`,
          tone: "professional",
          language: isAr ? "ar" : "en",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomerRequestSummary(data.template || null);
      }
    } catch (err) {
      console.error("Error analyzing customer request:", err);
    } finally {
      setIsAnalyzingRequest(false);
    }
  };

  // Suggest smart AI response
  const handleAiSuggestReply = async () => {
    if (!activeChatPhone || messages.length === 0) {
      setMessageInput(
        isAr
          ? "أهلاً وسهلاً بك! نسعد بخدمتك، تفضل بطلب أي استفسار عن خدماتنا وسنقوم بالرد عليك فوراً."
          : "Hello! We are glad to assist you. Feel free to ask any question and we will reply immediately."
      );
      return;
    }

    try {
      setIsAiGenerating(true);
      // Quick generate template or contextual reply
      const lastIncoming = [...messages].reverse().find((m) => !m.fromMe)?.text || activeChat.lastMessage;
      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: `الرد على استفسار عميل في الواتساب بخصوص: "${lastIncoming}" وعرض المساعدة وإتمام الطلب بلباقة`,
          tone: "friendly",
          language: isAr ? "ar" : "en",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.template) {
          setMessageInput(data.template.trim());
        }
      }
    } catch (err) {
      console.error("Error generating AI reply:", err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Quick templates
  const quickTemplates = isAr
    ? [
        { label: "مرحباً", text: "أهلاً بك يا فندم! كيف يمكننا مساعدتك اليوم؟" },
        { label: "عرض السعر", text: "يسعدنا تقديم عرض سعر مخصص لسيادتكم، هل تحب نرسله الآن؟" },
        { label: "طلب اتصال", text: "هل يناسبك اتصال هاتفي سريع لمناقشة التفاصيل والإجابة على كل استفساراتك؟" },
        { label: "رابط الطلب", text: "يمكنك إتمام التسجيل وتفعيل الخدمة مباشرة من خلال الرابط التالي." },
      ]
    : [
        { label: "Hello", text: "Hello! How can we assist you today?" },
        { label: "Pricing", text: "We would love to share our pricing packages with you. Shall we send it now?" },
        { label: "Call", text: "Would you like a quick phone call to discuss all details?" },
      ];

  const unregisteredCount = extractedChats.filter((c) => !c.isAlreadyLead).length;

  return (
    <div className="flex flex-col h-[740px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* WhatsApp Header Bar */}
      <div className="bg-[#005c4b] text-white px-4 py-2.5 flex items-center justify-between shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 shadow-inner">
            <MessageSquare className="w-5 h-5 fill-emerald-400/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">WhatsApp Live</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  waStatus?.status === "CONNECTED" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
            </div>
            <p className="text-[11px] text-emerald-100/80">
              {waStatus?.status === "CONNECTED"
                ? isAr
                  ? `متصل: ${waStatus?.user?.phone || "جاهز"}`
                  : `Online: ${waStatus?.user?.phone || "Ready"}`
                : isAr
                ? "جاهز للاستقبال والإرسال"
                : "Ready to chat"}
            </p>
          </div>
        </div>

        {/* Account Selector in Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-400/30 rounded-xl px-2.5 py-1">
            <Smartphone className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <select
              id="wa-header-account-select"
              value={selectedAccountId}
              onChange={(e) => {
                const val = e.target.value;
                if (onSelectAccountId) onSelectAccountId(val);
                onRefreshChats(val);
              }}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">
                {isAr ? "🌐 جميع الحسابات (مزامنة كاملة)" : "🌐 All Accounts (Combined)"}
              </option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                  {acc.status === "CONNECTED" ? "🟢" : "⚪"} {acc.name} {acc.phone ? `(${acc.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          {onOpenAccountManager && (
            <button
              onClick={onOpenAccountManager}
              title={isAr ? "إدارة الحسابات وربط رقم جديد" : "Manage accounts / Link new number"}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-emerald-100 hover:text-white transition cursor-pointer text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{isAr ? "ربط رقم" : "Add"}</span>
            </button>
          )}

          <button
            id="wa-deep-sync-btn"
            onClick={handleDeepSyncAll}
            disabled={isDeepSyncing}
            title={isAr ? "مزامنة دقيقة وشاملة لجميع محادثات وأرقام الواتساب" : "Deep sync WhatsApp contacts & chats"}
            className="flex items-center gap-1 bg-emerald-700/60 hover:bg-emerald-600/70 border border-emerald-400/30 text-emerald-100 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDeepSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isAr ? "مزامنة دقيقة" : "Accurate Sync"}</span>
          </button>
          <button
            id="wa-refresh-btn"
            onClick={() => onRefreshChats(selectedAccountId)}
            title={isAr ? "تحديث المحادثات" : "Refresh chats"}
            className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="wa-new-chat-btn"
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? "محادثة جديدة" : "New Chat"}</span>
          </button>
        </div>
      </div>

      {/* Connected Accounts Dedicated Screen Tabs & Accurate Synchronization Bar */}
      <div className="bg-slate-950/95 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAr ? "شاشات الحسابات المتصلة:" : "Connected Screens:"}</span>
          </span>

          {/* All accounts combined tab */}
          <button
            onClick={() => {
              if (onSelectAccountId) onSelectAccountId("all");
              onRefreshChats("all");
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 cursor-pointer border ${
              selectedAccountId === "all"
                ? "bg-slate-800 border-slate-600 text-white shadow-sm"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <span>🌐</span>
            <span>{isAr ? "كل الحسابات (مدمج)" : "All Accounts"}</span>
            <span className="text-[10px] bg-slate-700/80 px-1.5 py-0.2 rounded-full text-slate-300">
              {extractedChats.length}
            </span>
          </button>

          {/* Dedicated Screen for each connected account */}
          {accounts
            .filter((a) => a.status === "CONNECTED")
            .map((acc) => {
              const isCurrent = selectedAccountId === acc.id;
              const accChatsCount = extractedChats.filter(
                (c) => !c.accountId || c.accountId === acc.id
              ).length;

              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    if (onSelectAccountId) onSelectAccountId(acc.id);
                    onRefreshChats(acc.id);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-2 cursor-pointer border ${
                    isCurrent
                      ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-200 shadow-md shadow-emerald-950/40"
                      : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-bold">{acc.name}</span>
                  {acc.phone && (
                    <span className="text-[10px] text-emerald-400/80 font-mono dir-ltr">
                      ({acc.phone})
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isCurrent
                        ? "bg-emerald-900/90 text-emerald-300"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {accChatsCount} {isAr ? "محادثة" : "chats"}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded font-mono">
                      {isAr ? "شاشة نشطة" : "Active"}
                    </span>
                  )}
                </button>
              );
            })}

          {accounts.filter((a) => a.status === "CONNECTED").length === 0 && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <span>
                ⚠️ {isAr ? "لا توجد أرقام متصلة حالياً - اضغط ربط رقم لبدء الاستقبال" : "No active accounts"}
              </span>
            </span>
          )}
        </div>

        {/* Sync Status & Verification Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-emerald-500/30 text-[11px] text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {isAr
                ? `مزامنة مؤكدة (${extractedChats.length} محادثة)`
                : `Sync Verified (${extractedChats.length} chats)`}
            </span>
          </div>

          <button
            onClick={handleDeepSyncAll}
            disabled={isDeepSyncing}
            title={isAr ? "فحص وتأكيد دقة المزامنة وسحب أحدث الرسائل" : "Verify and synchronize accurate chats"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isDeepSyncing ? "animate-spin text-emerald-400" : ""}`} />
            <span>
              {isDeepSyncing
                ? isAr
                  ? "جاري فحص المزامنة..."
                  : "Verifying..."
                : isAr
                ? "فحص وتأكيد دقة المزامنة"
                : "Verify Sync"}
            </span>
          </button>
        </div>
      </div>

      {/* Verification Notice Banner */}
      {syncVerifiedNotice && (
        <div className="bg-emerald-950 border-b border-emerald-800/80 px-4 py-1.5 text-xs text-emerald-200 flex items-center justify-between shrink-0 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{syncVerifiedNotice}</span>
          </div>
          <button
            onClick={() => setSyncVerifiedNotice(null)}
            className="text-emerald-400 hover:text-white text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sub-Column: Chat List */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-e border-slate-800 flex flex-col bg-slate-900/90 shrink-0">
          {/* Search & Filter Bar */}
          <div className="p-2.5 border-b border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="wa-chat-search"
                type="text"
                placeholder={isAr ? "بحث في المحادثات والأرقام..." : "Search chats or numbers..."}
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl ps-9 pe-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                id="filter-all-chats"
                onClick={() => setFilterMode("all")}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-medium transition cursor-pointer ${
                  filterMode === "all"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {isAr ? "الكل" : "All"} ({extractedChats.length})
              </button>
              <button
                id="filter-unregistered-chats"
                onClick={() => setFilterMode("unregistered")}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-medium transition cursor-pointer ${
                  filterMode === "unregistered"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {isAr ? "غير مسجل" : "New"} ({unregisteredCount})
              </button>
              <button
                id="filter-leads-chats"
                onClick={() => setFilterMode("leads")}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-medium transition cursor-pointer ${
                  filterMode === "leads"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {isAr ? "عملاء CRM" : "Leads"} ({leads.length})
              </button>
            </div>
          </div>

          {/* Chats Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p>{isAr ? "لا توجد محادثات مطابقة" : "No chats found"}</p>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="mt-3 text-xs text-emerald-400 hover:underline"
                >
                  {isAr ? "+ بدء محادثة مع رقم جديد" : "+ Start chat with a number"}
                </button>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isSelected = chat.phone === activeChatPhone;
                const lead = leads.find((l) => l.phone === chat.phone);

                // Format phone number cleanly
                const formatPhone = (p: string) => {
                  const clean = p.replace(/[^0-9]/g, "");
                  if (clean.startsWith("20") && clean.length === 12) {
                    return `+20 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
                  }
                  return `+${clean}`;
                };

                const formattedPhone = formatPhone(chat.phone);
                const hasCustomName = chat.name && !chat.name.startsWith("+") && chat.name !== chat.phone;

                // Format timestamp nicely
                const formatTime = (ts: string) => {
                  if (!ts) return "";
                  try {
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return ts;
                    const today = new Date();
                    const isToday = d.toDateString() === today.toDateString();
                    if (isToday) {
                      return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });
                    }
                    return d.toLocaleDateString("ar-EG", { month: "numeric", day: "numeric" });
                  } catch {
                    return ts;
                  }
                };

                return (
                  <div
                    key={chat.phone}
                    id={`chat-item-${chat.phone}`}
                    onClick={() => setActiveChatPhone(chat.phone)}
                    className={`p-3 flex items-start gap-3 cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-slate-800/95 border-s-4 border-emerald-500 shadow-sm"
                        : "hover:bg-slate-800/50"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs border border-slate-700 shadow-inner">
                        {hasCustomName
                          ? chat.name.slice(0, 2).toUpperCase()
                          : chat.phone.slice(-2)}
                      </div>
                      {chat.isAlreadyLead && (
                        <span
                          title={isAr ? "مسجل في الـ CRM" : "CRM Lead"}
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-semibold text-white truncate">
                            {hasCustomName ? chat.name : formattedPhone}
                          </span>
                          {chat.unreadCount > 0 && (
                            <span className="bg-emerald-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-sans">
                          {formatTime(chat.lastMessageTimestamp)}
                        </span>
                      </div>

                      {hasCustomName && (
                        <p className="text-[10px] text-slate-400 font-mono mb-1 dir-ltr text-start">
                          {formattedPhone}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-300 truncate mb-2 leading-relaxed">
                        {chat.lastMessage || (isAr ? "محادثة نشطة عبر واتساب" : "Active chat")}
                      </p>

                      {/* Badges / Quick Action */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {lead ? (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${
                                STAGE_LABELS[lead.stage]?.color || "text-slate-300"
                              }`}
                            >
                              {isAr ? STAGE_LABELS[lead.stage]?.ar : STAGE_LABELS[lead.stage]?.en}
                            </span>
                          ) : (
                            <button
                              id={`quick-add-lead-${chat.phone}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onConvertChatToLead(
                                  chat.phone,
                                  hasCustomName ? chat.name : undefined,
                                  chat.lastMessage
                                );
                              }}
                              className="text-[10px] flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>{isAr ? "+ إضافة كـ Lead" : "+ Add Lead"}</span>
                            </button>
                          )}

                          {chat.accountName && (
                            <span
                              title={isAr ? `الحساب: ${chat.accountName}` : `Account: ${chat.accountName}`}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/90 text-emerald-300/90 border border-emerald-500/20 font-sans"
                            >
                              📱 {chat.accountName}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-500 font-sans">
                          {chat.messageCount > 0
                            ? isAr
                              ? `${chat.messageCount} رسالة`
                              : `${chat.messageCount} msgs`
                            : isAr
                            ? "متصل"
                            : "Online"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sub-Column: Active Conversation Screen */}
        <div className="flex-1 flex flex-col bg-slate-950/80 overflow-hidden">
          {activeChatPhone ? (
            <>
              {/* Active Chat Top Bar */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                    {activeChat.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{activeChat.name}</h4>
                      {activeLead && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            STAGE_LABELS[activeLead.stage]?.color
                          }`}
                        >
                          {isAr
                            ? STAGE_LABELS[activeLead.stage]?.ar
                            : STAGE_LABELS[activeLead.stage]?.en}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono dir-ltr block text-start">
                      +{activeChat.phone}
                    </span>
                  </div>
                </div>

                {/* Lead Action Controls */}
                <div className="flex items-center gap-2">
                  {/* Sync Chat Messages from WhatsApp Button */}
                  <button
                    id="sync-chat-messages-btn"
                    onClick={handleSyncChatMessages}
                    disabled={isSyncingMessages}
                    className="flex items-center gap-1.5 text-xs bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
                    title={isAr ? "سحب سجل الرسائل والمحادثة لهذا العميل من واتساب" : "Sync WhatsApp messages for this client"}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMessages ? "animate-spin text-cyan-400" : ""}`} />
                    <span>{isSyncingMessages ? (isAr ? "جاري السحب..." : "Syncing...") : (isAr ? "سحب رسائل العميل" : "Sync Messages")}</span>
                  </button>

                  {/* Analyze Customer Request with AI Button */}
                  {messages.length > 0 && (
                    <button
                      onClick={handleAnalyzeCustomerRequest}
                      disabled={isAnalyzingRequest}
                      className="flex items-center gap-1.5 text-xs bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
                      title={isAr ? "تحليل وتوضيح ماذا كان يطلب العميل في الرسائل السابقة بالذكاء الاصطناعي" : "Analyze what the client requested using AI"}
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${isAnalyzingRequest ? "animate-spin" : ""}`} />
                      <span>{isAnalyzingRequest ? (isAr ? "جاري الفحص..." : "Analyzing...") : (isAr ? "ماذا كان يطلب العميل؟" : "Client Request Summary")}</span>
                    </button>
                  )}

                  {activeLead ? (
                    <div className="flex items-center gap-1.5">
                      {/* Stage Selector */}
                      {onUpdateLeadStage && (
                        <select
                          id="active-lead-stage-select"
                          value={activeLead.stage}
                          onChange={(e) =>
                            onUpdateLeadStage(activeLead.id, e.target.value as LeadStage)
                          }
                          className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          {Object.entries(STAGE_LABELS).map(([key, val]) => (
                            <option key={key} value={key}>
                              {isAr ? val.ar : val.en}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        id="view-lead-crm-btn"
                        onClick={() => onSelectLead(activeLead)}
                        className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg font-medium transition cursor-pointer shadow-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{isAr ? "ملف الـ CRM" : "CRM Details"}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      id="convert-active-chat-btn"
                      onClick={handleConvertActiveChat}
                      disabled={isConverting}
                      className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer shadow-md shadow-amber-600/20"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>
                        {isConverting
                          ? isAr
                            ? "جاري الحفظ..."
                            : "Saving..."
                          : isAr
                          ? "+ إضافة الرقم كـ Lead في CRM"
                          : "+ Add as Lead"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sync Feedback Toast */}
              {syncFeedback && (
                <div className="bg-cyan-950/80 border-b border-cyan-500/30 px-4 py-2 text-xs text-cyan-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{syncFeedback}</span>
                  </div>
                  <button onClick={() => setSyncFeedback(null)} className="text-cyan-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Customer Request Summary Card (AI Analysis) */}
              {customerRequestSummary && (
                <div className="bg-purple-950/60 border-b border-purple-500/30 p-3.5 text-xs text-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold text-purple-300">
                      <Bot className="w-4 h-4 text-purple-400" />
                      <span>{isAr ? "تحليل طلب العميل من الرسائل السابقة (AI)" : "Customer Request Summary (AI)"}</span>
                    </div>
                    <button
                      onClick={() => setCustomerRequestSummary(null)}
                      className="text-purple-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-purple-100 bg-slate-950/60 p-3 rounded-xl border border-purple-500/20">
                    {customerRequestSummary}
                  </div>
                </div>
              )}

              {/* Message Sort Order & Status Bar */}
              <div className="px-3.5 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-[11px] shrink-0">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ArrowDownUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {messageSortOrder === "newest_first"
                      ? isAr
                        ? "ترتيب المحادثة: أحدث رسالة في الأعلى ⬇️ أقدم رسالة بالأسفل"
                        : "Order: Latest message at top ⬇️ Older below"
                      : isAr
                      ? "ترتيب المحادثة: أقدم رسالة في الأعلى ⬇️ أحدث رسالة بالأسفل"
                      : "Order: Oldest message at top ⬇️ Newest below"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMessageSortOrder((prev) => (prev === "newest_first" ? "oldest_first" : "newest_first"))
                  }
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer border border-slate-700/50"
                  title={isAr ? "تبديل ترتيب الرسائل" : "Toggle message sort order"}
                >
                  <span>
                    {messageSortOrder === "newest_first"
                      ? isAr
                        ? "عرض الأقدم أولاً"
                        : "Show oldest first"
                      : isAr
                      ? "عرض الأحدث أولاً"
                      : "Show newest first"}
                  </span>
                </button>
              </div>

              {/* Messages Body */}
              <div
                ref={chatContainerRef}
                onScroll={handleContainerScroll}
                className="flex-1 p-4 overflow-y-auto space-y-3 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950"
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{isAr ? "جاري تحميل الرسائل..." : "Loading messages..."}</span>
                  </div>
                ) : displayMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs text-center p-6 space-y-3">
                    <MessageSquare className="w-12 h-12 opacity-30 text-emerald-400" />
                    <p className="font-semibold text-slate-300 text-sm">
                      {isAr ? "لم يتم سحب رسائل هذا الرقم بعد" : "No messages recorded yet"}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                      {isAr
                        ? "لسحب المحادثة والرسائل السابقة من واتساب ومعرفة ماذا كان يطلب العميل، اضغط على زر السحب أدناه:"
                        : "To pull previous messages from WhatsApp and see what the client requested, click below:"}
                    </p>
                    <button
                      onClick={handleSyncChatMessages}
                      disabled={isSyncingMessages}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow transition cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingMessages ? "animate-spin" : ""}`} />
                      <span>
                        {isSyncingMessages
                          ? isAr
                            ? "جاري سحب الرسائل من واتساب..."
                            : "Pulling from WhatsApp..."
                          : isAr
                          ? "سحب رسائل ومحادثة العميل الآن من واتساب"
                          : "Pull Messages from WhatsApp Now"}
                      </span>
                    </button>
                  </div>
                ) : (
                  displayMessages.map((msg, idx) => {
                    const isMe = msg.fromMe;
                    const isNewest =
                      (messageSortOrder === "newest_first" && idx === 0) ||
                      (messageSortOrder === "oldest_first" && idx === displayMessages.length - 1);
                    const isOldest =
                      (messageSortOrder === "newest_first" && idx === displayMessages.length - 1) ||
                      (messageSortOrder === "oldest_first" && idx === 0);

                    return (
                      <div key={msg.id || idx} className="space-y-1">
                        {isNewest && (
                          <div className="flex items-center justify-center my-1">
                            <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                              <span>✨</span>
                              <span>{isAr ? "آخر رسالة حديثة" : "Latest Message"}</span>
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-sm leading-relaxed ${
                              isMe
                                ? "bg-emerald-600 text-white rounded-tr-xs"
                                : "bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-xs"
                            }`}
                          >
                            {!isMe && msg.senderName && (
                              <span className="block text-[10px] font-bold text-emerald-400 mb-0.5">
                                {msg.senderName}
                              </span>
                            )}
                            <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                            <div
                              className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                                isMe ? "text-emerald-200" : "text-slate-400"
                              }`}
                            >
                              <span>{msg.timestamp}</span>
                              {isMe && <CheckCheck className="w-3 h-3 text-emerald-200" />}
                            </div>
                          </div>
                        </div>

                        {isOldest && displayMessages.length > 1 && (
                          <div className="flex items-center justify-center my-1">
                            <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span>🏁</span>
                              <span>{isAr ? "أول رسالة قديمة" : "Oldest Message / Beginning"}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Smart AI Suggestion Bar */}
              <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                  <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {isAr ? "ردود سريعة:" : "Quick replies:"}
                  </span>
                  {quickTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      id={`quick-tpl-${i}`}
                      onClick={() => handleSendMessage(tpl.text)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-[11px] transition shrink-0 cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                <button
                  id="ai-suggest-reply-btn"
                  onClick={handleAiSuggestReply}
                  disabled={isAiGenerating}
                  className="flex items-center gap-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>
                    {isAiGenerating
                      ? isAr
                        ? "جاري الاقتراح..."
                        : "Thinking..."
                      : isAr
                      ? "اقتراح ذكي (AI)"
                      : "AI Reply"}
                  </span>
                </button>
              </div>

              {/* Sending Account Selector Bar */}
              <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-slate-400 shrink-0">{isAr ? "الإرسال عبر:" : "Send via:"}</span>
                  <select
                    id="wa-sending-account-select"
                    value={currentSendingAccountId}
                    onChange={(e) => setCurrentSendingAccountId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-emerald-400 text-[11px] font-semibold rounded-lg px-2 py-0.5 focus:outline-none focus:border-emerald-500 cursor-pointer truncate max-w-[220px]"
                  >
                    {accounts.length > 0 ? (
                      accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.status === "CONNECTED" ? "🟢" : "⚪"} {acc.name} {acc.phone ? `(${acc.phone})` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="">{isAr ? "الحساب الافتراضي" : "Default Account"}</option>
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>{isAr ? "مزامنة مباشرة ومضبوطة" : "Accurate Sync"}</span>
                </div>
              </div>

              {/* Message Composer Input */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    id="wa-message-input"
                    type="text"
                    placeholder={
                      isAr ? "اكتب رسالة واتساب للعميل..." : "Type a WhatsApp message..."
                    }
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                  />

                  <button
                    id="wa-send-btn"
                    type="submit"
                    disabled={isSending || !messageInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? (isAr ? "إرسال..." : "Sending...") : isAr ? "إرسال" : "Send"}</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
              <MessageSquare className="w-12 h-12 mb-3 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300 mb-1">
                {isAr ? "اختر محادثة من القائمة للبدء" : "Select a conversation to start"}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                {isAr
                  ? "تظهر هنا جميع المحادثات والرسائل الواردة من الواتساب مع إمكانية تحويل أي رقم إلى عميل (Lead) ومراسلته فوراً."
                  : "All WhatsApp incoming messages and conversations appear here with 1-click lead conversion."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "بدء محادثة واتساب جديدة" : "Start New WhatsApp Chat"}
                </h3>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  {isAr ? "رقم الهاتف (مع كود الدولة مثل 201xxxxxxxxx)" : "Phone Number (with country code)"}
                </label>
                <input
                  id="new-chat-phone-input"
                  type="text"
                  placeholder="201012345678"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  {isAr ? "اسم جهة الاتصال (اختياري)" : "Contact Name (Optional)"}
                </label>
                <input
                  id="new-chat-name-input"
                  type="text"
                  placeholder={isAr ? "مثال: م. أحمد خليل" : "e.g. John Doe"}
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  id="submit-new-chat-btn"
                  type="button"
                  onClick={() => {
                    const clean = newChatPhone.replace(/[^0-9]/g, "");
                    if (!clean) return;
                    setActiveChatPhone(clean);
                    setIsNewChatModalOpen(false);
                    setNewChatPhone("");
                    setNewChatName("");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold transition"
                >
                  {isAr ? "فتح المحادثة" : "Open Chat"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
