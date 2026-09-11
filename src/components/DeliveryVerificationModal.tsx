import React, { useState } from "react";
import {
  CheckCheck,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Smartphone,
  Search,
  Wifi,
  Info,
  ShieldCheck,
  Eye,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type { DeliveryVerificationResult, ContactDeliveryDiagnostic } from "../types.ts";

interface DeliveryVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  result: DeliveryVerificationResult | null;
  error: string | null;
  language: "ar" | "en";
}

export const DeliveryVerificationModal: React.FC<DeliveryVerificationModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  isLoading,
  result,
  error,
  language,
}) => {
  if (!isOpen) return null;

  const isAr = language === "ar";
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "guide">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "delivered" | "waiting" | "read" | "issues">("all");

  const contacts = result?.contacts || [];

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.phone.toLowerCase().includes(q) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.messageId && c.messageId.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;
    if (statusFilter === "delivered") return c.deliveryStatus === "DELIVERY_ACK";
    if (statusFilter === "waiting") return c.deliveryStatus === "SERVER_ACK" || c.deliveryStatus === "PENDING";
    if (statusFilter === "read") return c.deliveryStatus === "READ";
    if (statusFilter === "issues")
      return c.deliveryStatus === "NOT_REGISTERED" || c.deliveryStatus === "ERROR" || !c.isRegisteredOnWhatsApp;

    return true;
  });

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict) {
      case "ALL_DELIVERED":
        return {
          bg: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300",
          icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
          title: isAr ? "تسليم مؤكد لجميع أجهزة المستلمين" : "All Messages Delivered to Devices",
        };
      case "PARTIAL_DELIVERY":
        return {
          bg: "bg-blue-950/60 border-blue-500/40 text-blue-300",
          icon: <Clock className="w-5 h-5 text-blue-400" />,
          title: isAr ? "تسليم جزئي - بعض الرسائل بانتظار اتصال المستلمين" : "Partial Delivery - Some waiting for online",
        };
      case "SERVER_WAITING":
        return {
          bg: "bg-amber-950/60 border-amber-500/40 text-amber-300",
          icon: <Clock className="w-5 h-5 text-amber-400" />,
          title: isAr ? "الرسائل في خوادم واتساب وبانتظار اتصال أجهزة المستلمين (صح واحد)" : "Queued on WhatsApp Server (Single Tick)",
        };
      case "UNREGISTERED_DETECTED":
        return {
          bg: "bg-red-950/60 border-red-500/40 text-red-300",
          icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
          title: isAr ? "تم رصد أرقام غير مسجلة على واتساب" : "Unregistered Numbers Detected",
        };
      case "DISCONNECTED":
        return {
          bg: "bg-rose-950/60 border-rose-500/40 text-rose-300",
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          title: isAr ? "حساب واتساب غير متصل حالياً" : "WhatsApp Account Disconnected",
        };
      default:
        return {
          bg: "bg-slate-800/80 border-slate-700 text-slate-300",
          icon: <Info className="w-5 h-5 text-slate-400" />,
          title: isAr ? "تقرير فحص وتشخيص وصول الرسائل" : "Delivery Verification Report",
        };
    }
  };

  const verdictStyle = getVerdictStyle(result?.summary?.verdict);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <CheckCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isAr ? "فحص وتشخيص وصول الرسائل المباشر" : "WhatsApp Delivery Diagnostic"}
                </h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-semibold">
                  Baileys Live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "فحص وتأكيد حالة الاستلام الفعلي للرسائل مباشرة من خوادم واتساب لبيان أسباب عدم ظهورها على الهاتف"
                  : "Verify actual message delivery directly with WhatsApp servers and troubleshoot mobile sync"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title={isAr ? "إعادة الفحص الآن" : "Re-verify now"}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isAr ? "تحديث الفحص" : "Refresh"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isAr ? "إغلاق" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-900/80 text-xs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl font-bold transition border-b-2 ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isAr ? "نظرة عامة والتشخيص" : "Overview & Verdict"}</span>
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl font-bold transition border-b-2 ${
              activeTab === "contacts"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <CheckCheck className="w-4 h-4" />
            <span>{isAr ? "سجل إيصالات الأرقام" : "Contact Receipts"}</span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full">
              {contacts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl font-bold transition border-b-2 ${
              activeTab === "guide"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>{isAr ? "دليل حل مشكلة عدم الظهور على الهاتف 🔍" : "Mobile Sync Troubleshooting 🔍"}</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {error && (
            <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-200 text-xs">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <strong className="block text-white font-bold">{isAr ? "خطأ في الفحص:" : "Diagnostic Error:"}</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & VERDICT */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Verdict Banner */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${verdictStyle.bg}`}>
                <div className="mt-0.5 shrink-0">{verdictStyle.icon}</div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">{verdictStyle.title}</h4>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {isAr ? result?.summary?.verdictLabelAr : result?.summary?.verdictLabelEn}
                  </p>
                </div>
              </div>

              {/* Provider & Connection Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-slate-400">{isAr ? "الحساب المتصل:" : "Linked Account:"}</span>
                  <div className="text-xs font-bold text-white truncate">
                    {result?.provider?.accountName || "Default Account"}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                    <Smartphone className="w-3 h-3 text-slate-400" />
                    <span>{result?.provider?.senderPhone || "—"}</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-slate-400">{isAr ? "حالة السوكت (Baileys):" : "Socket State:"}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        result?.provider?.isConnected ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                    <span className="text-xs font-bold text-white">
                      {result?.provider?.isConnected ? (isAr ? "متصل بالخادم" : "Connected") : (isAr ? "غير متصل" : "Offline")}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    WebSocket: {result?.provider?.wsReadyState || "UNKNOWN"}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-slate-400">{isAr ? "تسليم مؤكد للأجهزة (Double Ticks):" : "Delivered to Devices:"}</span>
                  <div className="text-sm font-extrabold text-emerald-400 flex items-center gap-1">
                    <CheckCheck className="w-4 h-4" />
                    <span>{result?.summary?.deliveredCount || 0}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      /{result?.summary?.totalContactsChecked || 0}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {result?.summary?.readCount ? `+ ${result.summary.readCount} ${isAr ? "تمت قراءتها" : "Read"}` : (isAr ? "وصلت لأجهزة المستلمين" : "On recipient phones")}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-slate-400">{isAr ? "في سيرفر واتساب (Single Tick):" : "In WhatsApp Server:"}</span>
                  <div className="text-sm font-extrabold text-blue-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{result?.summary?.serverAckCount || 0}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isAr ? "بانتظار اتصال أجهزة المستلمين" : "Waiting for phones to connect"}
                  </div>
                </div>
              </div>

              {/* Actionable Explanation for "Appears sent but not received" */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span>
                    {isAr
                      ? "لماذا قد تظهر الرسالة 'ناجحة' في النظام ولا تراها فوراً على واتساب في الهاتف؟"
                      : "Why messages might appear 'Sent' in the system but not immediately on your mobile phone:"}
                  </span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5" />
                      <span>{isAr ? "1. استخدام البحث (🔍) في تطبيق الواتساب" : "1. Use Search (🔍) in Mobile WhatsApp"}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      {isAr
                        ? "في تحديثات واتساب (Multi-Device)، الرسائل الصادرة لأرقام جديدة غير محفوظة في جهات اتصالك لا تقفز تلقائياً لأعلى قائمة الدردشات. افتح واتساب في هاتفك وابحث عن رقم الهاتف في شريط البحث (🔍) لتظهر المحادثة فوراً بكامل رسائلها."
                        : "In Multi-Device WhatsApp, outgoing messages to unsaved contacts do not automatically push to the top of your Chats list. Search the phone number using the search bar (🔍) to open the thread."}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="font-bold text-blue-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{isAr ? "2. علامة صح واحدة vs علامتا صح" : "2. Single Tick vs Double Ticks"}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      {isAr
                        ? "الصح الرمادي الواحد يعني أن الرسالة خرجت من حسابك واستلمها سيرفر واتساب بنجاح 100%، لكن هاتف المستلم مغلق حالياً أو ليس به إنترنت. فور فتح المستلم للإنترنت ستصل وتتحول إلى علامتي صح."
                        : "A single gray tick means WhatsApp servers successfully took the message, but the recipient device is offline. It will turn into double ticks as soon as they go online."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations list */}
              {result?.recommendations && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300">
                    {isAr ? "توصيات وإرشادات النظام:" : "System Recommendations:"}
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-400 list-disc list-inside bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                    {(isAr ? result.recommendations.ar : result.recommendations.en).map((rec, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONTACTS & RECEIPTS */}
          {activeTab === "contacts" && (
            <div className="space-y-4">
              {/* Controls: Search & Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? "بحث بالرقم أو الاسم أو معرّف الرسالة..." : "Search by phone, name, or message ID..."}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 rtl:pl-4 rtl:pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      statusFilter === "all"
                        ? "bg-blue-600 text-white border-blue-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {isAr ? "الكل" : "All"} ({contacts.length})
                  </button>

                  <button
                    onClick={() => setStatusFilter("delivered")}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      statusFilter === "delivered"
                        ? "bg-emerald-600 text-white border-emerald-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {isAr ? "تم التسليم ✅✅" : "Delivered"} ({result?.summary?.deliveredCount || 0})
                  </button>

                  <button
                    onClick={() => setStatusFilter("waiting")}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      statusFilter === "waiting"
                        ? "bg-blue-600 text-white border-blue-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {isAr ? "في السيرفر ⏱️" : "Server Queued"} ({result?.summary?.serverAckCount || 0})
                  </button>

                  <button
                    onClick={() => setStatusFilter("issues")}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      statusFilter === "issues"
                        ? "bg-red-600 text-white border-red-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {isAr ? "مشاكل / غير مسجل ❌" : "Issues"} ({result?.summary?.unregisteredCount || 0})
                  </button>
                </div>
              </div>

              {/* Contacts List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {filteredContacts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                    {isAr ? "لا توجد أرقام مطابقة لخيارات البحث المحددة" : "No contacts match search query"}
                  </div>
                ) : (
                  filteredContacts.map((c, index) => {
                    const isDelivered = c.deliveryStatus === "DELIVERY_ACK";
                    const isRead = c.deliveryStatus === "READ";
                    const isServerAck = c.deliveryStatus === "SERVER_ACK";
                    const isUnregistered = c.deliveryStatus === "NOT_REGISTERED" || !c.isRegisteredOnWhatsApp;

                    return (
                      <div
                        key={c.phone + index}
                        className={`p-3.5 rounded-2xl border transition space-y-2 ${
                          isUnregistered
                            ? "bg-red-950/20 border-red-500/30"
                            : isDelivered || isRead
                            ? "bg-emerald-950/15 border-emerald-500/30"
                            : "bg-slate-950 border-slate-800"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isRead
                                  ? "bg-blue-500/20 text-blue-400"
                                  : isDelivered
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : isServerAck
                                  ? "bg-amber-500/20 text-amber-400"
                                  : isUnregistered
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {isRead ? (
                                <Eye className="w-4 h-4" />
                              ) : isDelivered ? (
                                <CheckCheck className="w-4 h-4" />
                              ) : isServerAck ? (
                                <Clock className="w-4 h-4" />
                              ) : isUnregistered ? (
                                <AlertTriangle className="w-4 h-4" />
                              ) : (
                                <Info className="w-4 h-4" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs dir-ltr">{c.phone}</span>
                                {c.name && <span className="text-slate-400 text-xs">({c.name})</span>}
                                {c.isSelf && (
                                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-semibold">
                                    {isAr ? "رقمك الخاص" : "Your Number"}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>
                                  {c.isRegisteredOnWhatsApp ? (
                                    <span className="text-emerald-400 font-medium">
                                      {isAr ? "مسجل في واتساب ✅" : "On WhatsApp ✅"}
                                    </span>
                                  ) : (
                                    <span className="text-red-400 font-medium">
                                      {isAr ? "غير مسجل في واتساب ❌" : "Not on WhatsApp ❌"}
                                    </span>
                                  )}
                                </span>
                                {c.messageId && (
                                  <span className="truncate max-w-[120px] font-mono" title={c.messageId}>
                                    ID: {c.messageId.slice(0, 10)}...
                                  </span>
                                )}
                                {c.sentAt && (
                                  <span>{new Date(c.sentAt).toLocaleTimeString("ar-EG", { hour12: true })}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="text-right">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border inline-block ${
                                isRead
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                  : isDelivered
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                  : isServerAck
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : isUnregistered
                                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {isAr ? c.deliveryStatusLabelAr : c.deliveryStatusLabelEn}
                            </span>
                          </div>
                        </div>

                        {/* Diagnostic Note & Guidance */}
                        {(c.diagnosticNote || c.troubleshootGuide) && (
                          <div className="bg-slate-900/90 rounded-xl p-2.5 text-[11px] text-slate-300 border border-slate-800/80 space-y-1">
                            {c.diagnosticNote && <p className="leading-relaxed">{c.diagnosticNote}</p>}
                            {c.troubleshootGuide && (
                              <p className="text-blue-300 leading-relaxed font-medium">
                                💡 {c.troubleshootGuide}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP TROUBLESHOOTING GUIDE */}
          {activeTab === "guide" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-950/40 border border-blue-500/30 rounded-2xl flex items-center gap-3 text-blue-200 text-xs">
                <Smartphone className="w-6 h-6 text-blue-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {isAr
                      ? "دليل حل مشكلة: 'بيقولي ناجح بس مش بلاقي حاجه مبعوته على الموبايل'"
                      : "Troubleshooting: 'Appears sent but not visible on mobile WhatsApp'"}
                  </h4>
                  <p className="text-blue-300/90 mt-0.5">
                    {isAr
                      ? "هذا الدليل يشرح الخصائص التقنية لتطبيق واتساب وكيفية التحقق من وصول الرسالة خطوة بخطوة."
                      : "Follow these 4 practical steps to verify messages on your smartphone."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                {/* Step 1 */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs">
                      1
                    </span>
                    <span>{isAr ? "البحث بالرقم في واتساب الموبايل 🔍" : "Search in Mobile WhatsApp 🔍"}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {isAr
                      ? "عندما ترسل رسالة من أجهزة مرتبطة (Multi-Device) إلى رقم جديد ليس مسجلاً في جهات اتصالك، واتساب لا يضعه في أول شاشة الدردشات تلقائياً. افتح تطبيق واتساب، اضغط على أيقونة البحث (🔍) واكتب رقم المستلم؛ ستجد الشات والرسالة موجودين فوراً."
                      : "Outgoing messages to new, unsaved numbers do not always show at the top of the mobile screen. Open WhatsApp on your phone, tap Search (🔍), and enter the phone number to view the chat."}
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs">
                      2
                    </span>
                    <span>{isAr ? "تطابق الحساب والشريحة (SIM 1 / SIM 2)" : "Verify Sender SIM & Account"}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {isAr
                      ? `تأكد أنك تفحص تطبيق الواتساب المربوط بنفس الرقم الظاهر في النظام (${result?.provider?.senderPhone || "الرقم المربوط"}). إذا كان لديك هاتف بخطين أو تطبيق واتساب إضافي (واتساب أعمال)، تأكد من فتح الحساب المطابق.`
                      : `Ensure that you are checking the WhatsApp client corresponding to the connected number (${result?.provider?.senderPhone || "connected number"}).`}
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">
                      3
                    </span>
                    <span>{isAr ? "حالة المستلم (صح واحد vs صحين)" : "Recipient Status (Single vs Double Ticks)"}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {isAr
                      ? "علامة صح واحدة تعني أن الرسالة استلمها سيرفر واتساب بنجاح، لكن هاتف المستلم مغلق حالياً أو غير متصل بالإنترنت. لا تقلق، فور فتح المستلم للإنترنت ستصل وتتحول تلقائياً لصحين رماديين."
                      : "A single tick confirms delivery to WhatsApp servers. If the recipient's phone is switched off or disconnected from the internet, it remains a single tick until they reconnect."}
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs">
                      4
                    </span>
                    <span>{isAr ? "كود الدولة والتحقق المسبق" : "Country Code & Pre-validation"}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {isAr
                      ? "النظام يقوم الآن بتنسيق كود الدولة تلقائياً (مثل 20 لمصر) وفحص الحساب قبل الإرسال. الأرقام غير المسجلة على واتساب سيتم تنبيهك بها هنا في التقرير فوراً ولن يتم تكرار إرسالها."
                      : "The system now auto-formats country codes and pre-validates numbers on WhatsApp servers so non-existent numbers are caught before sending."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              {isAr ? "آخر فحص:" : "Last checked:"}{" "}
              {result?.timestamp ? new Date(result.timestamp).toLocaleTimeString("ar-EG", { hour12: true }) : "الآن"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition cursor-pointer shadow-sm shadow-blue-600/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isAr ? "إعادة الفحص المباشر" : "Re-verify Live"}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition cursor-pointer"
            >
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
