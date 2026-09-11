import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Bot,
  Flame,
  Zap,
  ShoppingBag,
  UserCheck,
  Power,
  Play,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  Send,
  Loader2,
  Tag,
  HelpCircle,
  Package,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type {
  AIAgentDashboardStats,
  AIAgentSettings,
  AIAgentActivityLog,
  AIKnowledgeBase,
} from "../../types.ts";

interface AIAgentOverviewProps {
  stats: AIAgentDashboardStats | null;
  settings: AIAgentSettings;
  knowledge?: AIKnowledgeBase | null;
  logs: AIAgentActivityLog[];
  language: "ar" | "en";
  onToggleEnabled: (enabled: boolean) => void;
  onNavigateToTab: (tab: "sessions" | "knowledge" | "orders" | "settings") => void;
  onRefresh?: () => void;
}

export const AIAgentOverview: React.FC<AIAgentOverviewProps> = ({
  stats,
  settings,
  knowledge,
  logs,
  language,
  onToggleEnabled,
  onNavigateToTab,
  onRefresh,
}) => {
  const isAr = language === "ar";
  const [resettingBreaker, setResettingBreaker] = useState(false);

  const handleResetCircuitBreaker = async () => {
    setResettingBreaker(true);
    try {
      const res = await fetch("/api/ai-agent/reset-circuit-breaker", { method: "POST" });
      const data = await res.json();
      if (data.success && onRefresh) {
        onRefresh();
      }
    } catch (e) {
      console.error("Error resetting circuit breaker:", e);
    } finally {
      setResettingBreaker(false);
    }
  };

  // Products from active catalog
  const products = knowledge?.products || [];
  const primaryProduct = products[0];
  const secondaryProduct = products[1];
  const companyName = knowledge?.companyName || settings.companyName || (isAr ? "متجرنا" : "our store");

  // Dynamic default customer question matching user catalog
  const getCatalogDefaultMessage = () => {
    if (primaryProduct) {
      return isAr
        ? `السلام عليكم، بكم سعر ${primaryProduct.name.trim()} وهل متوفر دفع عند الاستلام؟`
        : `Hi, how much is ${primaryProduct.name.trim()} and do you have cash on delivery?`;
    }
    return isAr
      ? "السلام عليكم، ما هي المنتجات والأسعار المتوفرة لديكم وطرق التوصيل؟"
      : "Hi, what products and prices are available, and what are delivery options?";
  };

  // Simulator test state
  const [testMessage, setTestMessage] = useState<string>(getCatalogDefaultMessage);
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorResult, setSimulatorResult] = useState<any | null>(null);

  // If products load after mount and message still has the old hardcoded watch prompt, auto-sync to real product
  useEffect(() => {
    if (primaryProduct) {
      if (
        testMessage.includes("الساعة الترا") ||
        testMessage.includes("Smart Watch Ultra") ||
        !testMessage.trim()
      ) {
        setTestMessage(
          isAr
            ? `السلام عليكم، بكم سعر ${primaryProduct.name.trim()} وهل متوفر دفع عند الاستلام؟`
            : `Hi, how much is ${primaryProduct.name.trim()} and do you have cash on delivery?`
        );
      }
    }
  }, [primaryProduct?.name, isAr]);

  const handleRunSimulator = async () => {
    if (!testMessage.trim()) return;
    setSimulatorLoading(true);
    try {
      const res = await fetch("/api/ai-agent/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "201000000000",
          message: testMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimulatorResult(data.result);
      }
    } catch (e) {
      console.error("Simulator test error:", e);
    } finally {
      setSimulatorLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Quick Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                settings.enabled
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {settings.agentName}
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 border ${
                    settings.enabled
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      settings.enabled ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                    }`}
                  />
                  {settings.enabled
                    ? isAr
                      ? "الوكيل نشط وجاهز للرد التلقائي"
                      : "Agent Active & Auto-replying"
                    : isAr
                    ? "الوكيل متوقف مؤقتاً"
                    : "Agent Paused"}
                </span>
                <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
                  {settings.operatingMode === "all"
                    ? isAr ? "الرد على جميع العملاء" : "All Customers"
                    : settings.operatingMode === "new_leads_only"
                    ? isAr ? "العملاء الجدد فقط" : "New Leads Only"
                    : settings.operatingMode === "whitelist_only"
                    ? isAr ? "قائمة محددة فقط" : "Whitelist Only"
                    : isAr ? "معطل" : "Off"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isAr
                  ? `يعمل بنموذج الذكاء الاصطناعي Gemini (${settings.model}) ومربوط بكتالوج المنتجات الرسمي مع ذاكرة دائمة للمحادثات.`
                  : `Powered by Gemini AI (${settings.model}), grounded in your official product catalog with persistent customer memory.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="toggle-ai-agent-btn"
              onClick={() => onToggleEnabled(!settings.enabled)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs shadow-md transition ${
                settings.enabled
                  ? "bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-600/20"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {settings.enabled
                  ? isAr ? "إيقاف مؤقت للردود" : "Pause Auto-replies"
                  : isAr ? "تفعيل الردود الذكية" : "Enable AI Auto-replies"}
              </span>
            </button>
            <button
              id="overview-to-settings-btn"
              onClick={() => onNavigateToTab("settings")}
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition"
            >
              {isAr ? "الإعدادات والقواعد" : "Rules & Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* Anti-Ban Safety Protection Status Banner */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white">
                  {isAr ? "درع الحماية من حظر واتساب (Anti-Ban Shield)" : "WhatsApp Anti-Ban Shield"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isAr ? "الحماية القصوى نشطة 🛡️" : "Protection Active"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAr
                  ? "نظام الإرسال المتسلسل الآمن (Safe Serialized Queue) يمنع الحظر عبر فواصل زمنية بشرية وتجاهل كامل للرسائل القديمة ومزامنة الشات."
                  : "Serialized safe dispatch prevents bans with natural human gaps and zero processing of legacy chat syncs."}
              </p>
            </div>
          </div>

          {/* Circuit Breaker Status or Action */}
          {stats?.antiBanStatus?.circuitBreakerTripped ? (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-xl text-rose-400 shrink-0">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
              <div className="text-xs">
                <span className="font-bold">
                  {isAr ? "قاطع الأمان مفعل مؤقتاً" : "Circuit Breaker Tripped"}
                </span>
                {stats.antiBanStatus.circuitBreakerRemainingSeconds ? (
                  <span className="text-[10px] text-rose-300 block">
                    {isAr
                      ? `متبقي ${stats.antiBanStatus.circuitBreakerRemainingSeconds} ثانية للتبريد`
                      : `${stats.antiBanStatus.circuitBreakerRemainingSeconds}s remaining`}
                  </span>
                ) : null}
              </div>
              <button
                onClick={handleResetCircuitBreaker}
                disabled={resettingBreaker}
                className="ms-2 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition flex items-center gap-1"
              >
                <RotateCcw className={`w-3 h-3 ${resettingBreaker ? "animate-spin" : ""}`} />
                <span>{isAr ? "إعادة تعيين فوري" : "Reset"}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-emerald-300 text-xs shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium text-[11px]">
                {isAr ? "معدل الإرسال آمن ومستقر" : "Safe Dispatch Cadence"}
              </span>
            </div>
          )}
        </div>

        {/* 3 Micro Safety Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-850/60 border border-slate-800 rounded-xl p-2.5">
            <Clock className="w-4 h-4 text-teal-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">
                {isAr ? "معدل الرسائل / الدقيقة" : "Replies / Minute"}
              </div>
              <div className="text-xs font-bold text-white">
                {stats?.antiBanStatus?.repliesInLastMinute || 0} /{" "}
                {stats?.antiBanStatus?.maxRepliesPerMinute || settings.maxRepliesPerMinute || 3}{" "}
                <span className="text-[10px] text-slate-400 font-normal">
                  {isAr ? "(حد أمان صارم)" : "(strict safety cap)"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-850/60 border border-slate-800 rounded-xl p-2.5">
            <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">
                {isAr ? "طابور الإرسال المتسلسل" : "Safe Queue Buffer"}
              </div>
              <div className="text-xs font-bold text-white">
                {stats?.antiBanStatus?.safeQueueLength || 0}{" "}
                <span className="text-[10px] text-slate-400 font-normal">
                  {isAr ? "رسائل بالانتظار (دون تداخل)" : "messages queued"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-850/60 border border-slate-800 rounded-xl p-2.5">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">
                {isAr ? "تصفية الرسائل التاريخية" : "History Sync Filter"}
              </div>
              <div className="text-xs font-bold text-emerald-400">
                {isAr ? "محمية بنسبة 100%" : "100% Protected"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Conversations */}
        <div
          onClick={() => onNavigateToTab("sessions")}
          className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">
              {isAr ? "محادثات العملاء" : "Customer Chats"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {stats?.totalConversations || 0}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>
              {stats?.activeAiChats || 0}{" "}
              {isAr ? "محادثة يديرها الذكاء الاصطناعي الآن" : "managed by AI now"}
            </span>
          </div>
        </div>

        {/* Orders Collected */}
        <div
          onClick={() => onNavigateToTab("orders")}
          className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">
              {isAr ? "طلبات الشراء المستخرجة" : "Collected Orders"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {stats?.totalOrders || 0}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-teal-300 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              {stats?.totalOrderValue?.toLocaleString() || 0} {stats?.currency || "ج.م"}
            </span>
          </div>
        </div>

        {/* Hot / Warm Leads */}
        <div
          onClick={() => onNavigateToTab("sessions")}
          className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">
              {isAr ? "تصنيف العملاء المحتملين" : "Lead Scoring"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">
              {stats?.hotLeadsCount || 0}
            </span>
            <span className="text-xs text-amber-300/80 font-medium">
              {isAr ? "عميل ساخن 🔥" : "Hot leads"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
            <span>
              {stats?.warmLeadsCount || 0} {isAr ? "مهتم ⚡" : "Warm"}
            </span>
            <span>•</span>
            <span>
              {stats?.coldLeadsCount || 0} {isAr ? "بارد ❄️" : "Cold"}
            </span>
          </div>
        </div>

        {/* Human Takeover */}
        <div
          onClick={() => onNavigateToTab("sessions")}
          className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">
              {isAr ? "التحويل لموظف بشري" : "Human Handoffs"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {stats?.humanTakeovers || 0}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-purple-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {isAr ? "تحويل آمن عند طلب العميل" : "Safe handoff on request"}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Simulator & Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Top: Interactive Simulator Playground */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Play className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "محاكي ردود الوكيل الذكي (AI Simulator)" : "Live AI Agent Simulator"}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isAr
                    ? "اختبر كيف سيفهم الوكيل استفسار العميل ويرد عليه وفقاً للكتالوج دون إرسال واتساب فعلي."
                    : "Test how the agent reasons, checks catalog, and drafts responses without sending a WhatsApp message."}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab("knowledge")}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium transition"
            >
              {isAr ? "تعديل الكتالوج والأسعار ←" : "Edit Catalog ←"}
            </button>
          </div>

          <div className="space-y-3">
            {/* Catalog Info & Picker */}
            {products.length > 0 && (
              <div className="p-3 bg-teal-950/30 border border-teal-500/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-teal-300 font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    {isAr
                      ? `جرّب سؤالاً عن منتجات ${companyName}:`
                      : `Try a question for ${companyName} products:`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isAr ? "انقر على أي منتج لتعبئة السؤال فوراً" : "Click product to load question"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {products.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setTestMessage(
                          isAr
                            ? `السلام عليكم، تفاصيل وسعر ${prod.name.trim()} وطريقة الطلب والتوصيل؟`
                            : `Hi, what is the price and details for ${prod.name.trim()}?`
                        );
                      }}
                      className="flex items-center gap-1 text-[11px] bg-slate-850 hover:bg-teal-900/40 text-slate-200 hover:text-teal-200 border border-slate-700/80 hover:border-teal-500/50 px-2.5 py-1 rounded-lg transition font-medium"
                      title={prod.description}
                    >
                      <Package className="w-3 h-3 text-teal-400" />
                      <span>{prod.name.trim()}</span>
                      <span className="text-[10px] text-teal-400 font-semibold">
                        ({prod.price} {prod.currency || "ج.م"})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-300 font-medium flex items-center justify-between mb-1.5">
                <span>{isAr ? "رسالة العميل التجريبية:" : "Customer Test Message:"}</span>
                <span className="text-[10px] text-slate-500">
                  {isAr ? "يمكنك كتابة أي سؤال أو استفسار بحرية" : "Type any customer question"}
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  id="simulator-input"
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRunSimulator();
                  }}
                  placeholder={
                    isAr
                      ? "اكتب سؤال عميل عن منتجاتك، الأسعار، الشحن، أو طريقة الشراء..."
                      : "Type a customer question about your products, prices, shipping..."
                  }
                  className="flex-1 bg-slate-800 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
                />
                <button
                  id="run-simulator-btn"
                  onClick={handleRunSimulator}
                  disabled={simulatorLoading || !testMessage.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition"
                >
                  {simulatorLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isAr ? "محاكاة الرد" : "Simulate"}</span>
                </button>
              </div>
            </div>

            {/* Quick Prompts Pills (Dynamic according to actual products) */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-500 font-medium">
                {isAr ? "نماذج استفسارات:" : "Quick tests:"}
              </span>
              {[
                ...(primaryProduct
                  ? [
                      {
                        label: isAr
                          ? `سعر ${primaryProduct.name.trim().slice(0, 18)}`
                          : `Price of ${primaryProduct.name.trim().slice(0, 15)}`,
                        text: isAr
                          ? `السلام عليكم، بكم سعر ${primaryProduct.name.trim()} وهل متوفر دفع عند الاستلام؟`
                          : `Hi, how much is ${primaryProduct.name.trim()} and do you have cash on delivery?`,
                      },
                    ]
                  : []),
                ...(secondaryProduct
                  ? [
                      {
                        label: isAr
                          ? `طلب شراء ${secondaryProduct.name.trim().slice(0, 18)}`
                          : `Order ${secondaryProduct.name.trim().slice(0, 15)}`,
                        text: isAr
                          ? `عايز اطلب ${secondaryProduct.name.trim()}، عنواني في القاهرة وهدفع كاش`
                          : `I want to order ${secondaryProduct.name.trim()} to Cairo, cash on delivery`,
                      },
                    ]
                  : []),
                ...(products.length > 2
                  ? [
                      {
                        label: isAr
                          ? `توفر ${products[2].name.trim().slice(0, 18)}`
                          : `Stock ${products[2].name.trim().slice(0, 15)}`,
                        text: isAr
                          ? `لو سمحت هل ${products[2].name.trim()} متوفر حالياً وبكام؟`
                          : `Is ${products[2].name.trim()} available right now and what is the price?`,
                      },
                    ]
                  : []),
                {
                  label: isAr ? "1️⃣ المنتجات والأسعار (جملة)" : "1️⃣ Products (wholesale)",
                  text: "1",
                },
                {
                  label: isAr ? "2️⃣ الشحن والدفع" : "2️⃣ Shipping info",
                  text: "2",
                },
                {
                  label: isAr ? "3️⃣ طلب أوردر" : "3️⃣ Order placement",
                  text: "3",
                },
                {
                  label: isAr ? "4️⃣ موظف خدمة العملاء" : "4️⃣ Customer service",
                  text: "4",
                },
                {
                  label: isAr ? "سياسة الشحن والتوصيل" : "Shipping policy",
                  text: isAr
                    ? "الشحن بياخد كام يوم ومصاريف التوصيل كام؟"
                    : "How many days does shipping take and what is the cost?",
                },
                {
                  label: isAr ? "❓ سؤال غير متوفر (تحويل لخدمة العملاء)" : "❓ Unknown Question (Handoff)",
                  text: isAr
                    ? "هل عندكم فرع في أسوان لبيع الآيس كريم ومين المدير؟"
                    : "Do you have a branch in Aswan selling ice cream?",
                },
                {
                  label: isAr ? "طلب موظف بشري" : "Request human agent",
                  text: isAr
                    ? "لو سمحت عايز اكلم موظف خدمة عملاء ضروري"
                    : "I want to speak with a human support agent please",
                },
              ].map((pill, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setTestMessage(pill.text);
                  }}
                  className="text-[10px] bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white px-2 py-0.5 rounded-lg border border-slate-700/60 transition"
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Simulator Output Box */}
            {simulatorResult && (
              <div className="mt-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {isAr ? "تحليل الذكاء الاصطناعي:" : "AI Reasoning Analysis:"}
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                      Intent: {simulatorResult.intent}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        simulatorResult.leadQuality === "hot"
                          ? "bg-rose-500/20 text-rose-300"
                          : simulatorResult.leadQuality === "warm"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      Score: {simulatorResult.leadScore}/100 ({simulatorResult.leadQuality})
                    </span>
                  </div>

                  {simulatorResult.wantsHumanAgent && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      {isAr ? "تحويل لموظف بشري" : "Handoff Triggered"}
                    </span>
                  )}
                </div>

                {/* Simulated WhatsApp Bubble */}
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3.5 relative">
                  <div className="text-[10px] text-emerald-400/80 font-medium mb-1">
                    {settings.agentName} (رد واتساب المقترح):
                  </div>
                  <p className="text-xs text-white leading-relaxed whitespace-pre-wrap">
                    {simulatorResult.replyMessage}
                  </p>
                </div>

                {/* Extracted Order Box if detected */}
                {simulatorResult.extractedOrder?.items?.length > 0 && (
                  <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="font-semibold text-teal-300 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {isAr ? "بيانات الطلب المستخرجة:" : "Extracted Order Details:"}
                    </div>
                    <div className="text-slate-300">
                      {simulatorResult.extractedOrder.items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>
                            • {it.productName} × {it.quantity || 1}
                          </span>
                          {it.unitPrice && (
                            <span className="font-mono text-teal-400">
                              {it.unitPrice} {stats?.currency || "ج.م"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {simulatorResult.extractedOrder.shippingAddress && (
                      <div className="text-[11px] text-slate-400">
                        📍 العنوان: {simulatorResult.extractedOrder.shippingAddress}
                      </div>
                    )}
                    {simulatorResult.extractedOrder.paymentMethod && (
                      <div className="text-[11px] text-slate-400">
                        💳 طريقة الدفع: {simulatorResult.extractedOrder.paymentMethod}
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Memory Update */}
                {simulatorResult.memorySummary && (
                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-300 font-medium">
                      {isAr ? "ذاكرة العميل الجديدة:" : "Updated Customer Memory:"}{" "}
                    </span>
                    {simulatorResult.memorySummary}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right / Bottom: Live Activity Audit Feed */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {isAr ? "سجل أنشطة الوكيل اللحظي" : "Live Agent Activity Log"}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {logs.length} {isAr ? "حدث مسجل" : "events"}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {isAr
                  ? "لا توجد أنشطة مسجلة بعد. ستظهر هنا فور تفاعل الوكيل مع العملاء عبر واتساب."
                  : "No logged activity yet. Events will appear here as the AI interacts with WhatsApp customers."}
              </div>
            ) : (
              logs.slice(0, 15).map((log) => {
                let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                if (log.type === "ai_reply") badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                else if (log.type === "order_collected") badgeColor = "bg-teal-500/10 text-teal-300 border-teal-500/20";
                else if (log.type === "human_handoff") badgeColor = "bg-purple-500/10 text-purple-300 border-purple-500/20";
                else if (log.type === "error") badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";

                return (
                  <div
                    key={log.id}
                    className="p-2.5 bg-slate-850/60 hover:bg-slate-850 border border-slate-800/80 rounded-xl transition text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${badgeColor}`}>
                        {log.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                      {log.details}
                    </p>
                    {log.phone && log.phone !== "SYSTEM" && (
                      <div className="text-[10px] text-teal-400/80 font-mono">
                        +{log.phone}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
