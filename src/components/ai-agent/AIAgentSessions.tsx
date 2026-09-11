import React, { useState } from "react";
import {
  User,
  Phone,
  Clock,
  Sparkles,
  UserCheck,
  Power,
  RotateCcw,
  Send,
  Search,
  MessageSquare,
  Flame,
  Zap,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import type { AIAgentSession, ExtractedMessage } from "../../types.ts";

interface AIAgentSessionsProps {
  sessions: AIAgentSession[];
  language: "ar" | "en";
  onRefresh: () => void;
}

export const AIAgentSessions: React.FC<AIAgentSessionsProps> = ({
  sessions,
  language,
  onRefresh,
}) => {
  const isAr = language === "ar";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(
    sessions.length > 0 ? sessions[0].phone : null
  );

  const [activeSessionDetail, setActiveSessionDetail] = useState<{
    session: AIAgentSession | null;
    messages: ExtractedMessage[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Manual message composer
  const [manualReplyText, setManualReplyText] = useState("");
  const [sendingManualReply, setSendingManualReply] = useState(false);

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.phone.includes(searchQuery) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.summary.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Load selected session details
  const handleSelectSession = async (phone: string) => {
    setSelectedPhone(phone);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/ai-agent/sessions/${phone}`);
      const data = await res.json();
      if (data.success) {
        setActiveSessionDetail({
          session: data.session,
          messages: data.messages || [],
        });
      }
    } catch (e) {
      console.error("Failed to fetch session detail:", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Initial load if selectedPhone is set
  React.useEffect(() => {
    if (selectedPhone) {
      handleSelectSession(selectedPhone);
    }
  }, []);

  const handleTakeover = async (phone: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/ai-agent/sessions/${phone}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "استلام فوري من موظف المبيعات" }),
      });
      await handleSelectSession(phone);
      onRefresh();
    } catch (e) {
      console.error("Error taking over session:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (phone: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/ai-agent/sessions/${phone}/resume`, {
        method: "POST",
      });
      await handleSelectSession(phone);
      onRefresh();
    } catch (e) {
      console.error("Error resuming session:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearMemory = async (phone: string) => {
    if (
      !confirm(
        isAr
          ? "هل أنت متأكد من تصفير ذاكرة وتفضيلات هذا العميل؟"
          : "Are you sure you want to reset this customer's AI memory?"
      )
    )
      return;

    setActionLoading(true);
    try {
      await fetch(`/api/ai-agent/sessions/${phone}/clear-memory`, {
        method: "POST",
      });
      await handleSelectSession(phone);
      onRefresh();
    } catch (e) {
      console.error("Error clearing memory:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendManualReply = async () => {
    if (!selectedPhone || !manualReplyText.trim()) return;
    setSendingManualReply(true);
    try {
      const res = await fetch(`/api/ai-agent/sessions/${selectedPhone}/manual-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: manualReplyText.trim(),
          accountId: activeSessionDetail?.session?.accountId || "default",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setManualReplyText("");
        await handleSelectSession(selectedPhone);
        onRefresh();
      } else {
        alert(data.error || "تعذر إرسال الرسالة");
      }
    } catch (e: any) {
      alert("خطأ في الاتصال: " + e.message);
    } finally {
      setSendingManualReply(false);
    }
  };

  const currentSession =
    activeSessionDetail?.session ||
    sessions.find((s) => s.phone === selectedPhone);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Customer Sessions List (4 cols) */}
      <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-teal-400" />
            <span>{isAr ? "ذاكرة وجلسات العملاء" : "Customer AI Memory"}</span>
          </h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
            {filteredSessions.length} {isAr ? "عميل" : "customers"}
          </span>
        </div>

        {/* Search & Status Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "بحث بالرقم أو الاسم أو التفضيلات..." : "Search by phone, name, memory..."}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "all", label: isAr ? "الكل" : "All" },
              { id: "active", label: isAr ? "الذكاء الاصطناعي (نشط)" : "AI Active" },
              { id: "human_takeover", label: isAr ? "استلام بشري" : "Human Takeover" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                  statusFilter === st.id
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Sessions */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              {isAr ? "لا توجد جلسات تطابق البحث" : "No sessions found matching filters."}
            </div>
          ) : (
            filteredSessions.map((s) => {
              const isSelected = s.phone === selectedPhone;
              const isHot = s.leadQuality === "hot" || s.leadScore >= 70;
              const isWarm = s.leadQuality === "warm" || s.leadScore >= 40;

              return (
                <div
                  key={s.phone}
                  onClick={() => handleSelectSession(s.phone)}
                  className={`p-3 rounded-xl border cursor-pointer transition relative text-xs space-y-1.5 ${
                    isSelected
                      ? "bg-slate-800/90 border-teal-500/80 shadow-md shadow-teal-500/10"
                      : "bg-slate-850/50 hover:bg-slate-800/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {s.name || `عميل (${s.phone.slice(-4)})`}
                      </span>
                      {s.hasUnreadForHuman && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        s.status === "human_takeover"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {s.status === "human_takeover"
                        ? isAr ? "تحويل بشري" : "Human"
                        : isAr ? "وكيل AI" : "AI Agent"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-mono text-slate-400">+{s.phone}</span>
                    <span
                      className={`font-semibold flex items-center gap-1 ${
                        isHot
                          ? "text-rose-400"
                          : isWarm
                          ? "text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      {isHot ? <Flame className="w-3 h-3 text-rose-400" /> : <Zap className="w-3 h-3 text-amber-400" />}
                      {s.leadScore}/100
                    </span>
                  </div>

                  {s.summary && (
                    <p className="text-[11px] text-slate-300 line-clamp-1 italic bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80">
                      "{s.summary}"
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Customer Details, Memory & Live Messages (7 cols) */}
      <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
        {loadingDetails ? (
          <div className="text-center py-20 text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            <span>{isAr ? "جاري تحميل تفاصيل الجلسة..." : "Loading session details..."}</span>
          </div>
        ) : !currentSession ? (
          <div className="text-center py-20 text-slate-500 text-xs">
            {isAr
              ? "اختر عميلاً من القائمة لعرض سجل الذاكرة والرسائل والتحكم في المحادثة."
              : "Select a customer from the left list to view memory, chat history, and controls."}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header with Customer Info & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">
                    {currentSession.name}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    +{currentSession.phone}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                      currentSession.leadQuality === "hot"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : currentSession.leadQuality === "warm"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {isAr ? "نقاط الاهتمام:" : "Lead Score:"} {currentSession.leadScore}/100 (
                    {currentSession.leadQuality === "hot"
                      ? isAr ? "ساخن 🔥" : "Hot"
                      : currentSession.leadQuality === "warm"
                      ? isAr ? "مهتم ⚡" : "Warm"
                      : isAr ? "بارد ❄️" : "Cold"}
                    )
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span>{isAr ? "النية المكتشفة:" : "Intent:"} <strong className="text-teal-300">{currentSession.intent}</strong></span>
                  <span>•</span>
                  <span>{isAr ? "التبادلات:" : "Turns:"} {currentSession.totalTurns}</span>
                  <span>•</span>
                  <span>{isAr ? "آخر تفاعل:" : "Last active:"} {new Date(currentSession.lastInteraction).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Action Buttons: Takeover vs Resume */}
              <div className="flex items-center gap-2">
                {currentSession.status === "human_takeover" ? (
                  <button
                    id="resume-ai-btn"
                    onClick={() => handleResume(currentSession.phone)}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isAr ? "استئناف ردود AI" : "Resume AI"}</span>
                  </button>
                ) : (
                  <button
                    id="takeover-btn"
                    onClick={() => handleTakeover(currentSession.phone)}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{isAr ? "استلام بشري (إيقاف AI)" : "Takeover (Pause AI)"}</span>
                  </button>
                )}

                <button
                  onClick={() => handleClearMemory(currentSession.phone)}
                  disabled={actionLoading}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 border border-slate-700/60 transition"
                  title={isAr ? "تصفير ذاكرة العميل" : "Reset memory"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Persistent AI Memory & Preferences Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAr ? "ذاكرة الوكيل الذكي عن هذا العميل:" : "Persistent AI Memory:"}
                </span>
                {currentSession.handoffReason && (
                  <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    سبب التحويل: {currentSession.handoffReason}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                {currentSession.summary || (
                  <span className="text-slate-500">
                    {isAr
                      ? "لا توجد ذاكرة متراكمة بعد. يقوم الوكيل بتحديث هذا الملخص تلقائياً مع استمرار المحادثة."
                      : "No accumulated memory yet. The AI agent automatically updates this summary as the conversation progresses."}
                  </span>
                )}
              </p>

              {currentSession.keyPreferences && currentSession.keyPreferences.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-500 font-medium">
                    {isAr ? "التفضيلات والاهتمامات:" : "Key Preferences:"}
                  </span>
                  {currentSession.keyPreferences.map((pref, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-slate-800 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-md"
                    >
                      {pref}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* WhatsApp Messages Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>{isAr ? "سجل رسائل واتساب الحية:" : "Live WhatsApp Messages:"}</span>
                <span>{activeSessionDetail?.messages.length || 0} {isAr ? "رسالة" : "messages"}</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 max-h-[300px] overflow-y-auto space-y-2.5">
                {!activeSessionDetail?.messages || activeSessionDetail.messages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    {isAr ? "لا توجد رسائل مسجلة لهذا الرقم بعد" : "No messages recorded yet"}
                  </div>
                ) : (
                  activeSessionDetail.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.fromMe ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                          m.fromMe
                            ? "bg-teal-700 text-white rounded-br-none shadow-sm"
                            : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/70 shadow-sm"
                        }`}
                      >
                        <div className="text-[10px] text-slate-300 font-semibold mb-0.5">
                          {m.fromMe ? "الوكيل / الموظف" : m.senderName || currentSession.name}
                        </div>
                        <p>{m.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                        {m.timestamp}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Direct Operator Reply Composer */}
            <div className="bg-slate-850/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-teal-400" />
                  {isAr ? "إرسال رد يدوي فوري عبر واتساب:" : "Send Manual Reply via WhatsApp:"}
                </span>
                {currentSession.status === "active" && (
                  <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {isAr ? "ملاحظة: إرسال رد يدوي سيوقف الرد الآلي للذكاء الاصطناعي مؤقتاً" : "Note: sending manual reply will pause AI"}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualReplyText}
                  onChange={(e) => setManualReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendManualReply();
                  }}
                  placeholder={
                    isAr
                      ? "اكتب رسالة للعميل تصل مباشرة عبر واتساب..."
                      : "Type a message to send directly to customer..."
                  }
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  id="send-manual-reply-btn"
                  onClick={handleSendManualReply}
                  disabled={sendingManualReply || !manualReplyText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition"
                >
                  {sendingManualReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isAr ? "إرسال" : "Send"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
