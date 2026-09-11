import React from "react";
import {
  Smartphone,
  Calendar,
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Paperclip,
  Users,
  FileEdit,
  Sliders,
  Send,
  Trash2,
  FastForward,
} from "lucide-react";
import type { QueueProgress, WhatsAppStatus, CampaignConfig, Contact, LogEntry } from "../types.ts";
import { Tooltip } from "./Tooltip.tsx";

interface DashboardTabProps {
  progress: QueueProgress;
  waStatus: WhatsAppStatus | null;
  config: CampaignConfig;
  contacts: Contact[];
  logs: LogEntry[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
  onReset: () => void;
  onOverrideDailyLimit: () => void;
  onOpenConnectModal: () => void;
  onNavigateTab: (tab: "contacts" | "composer" | "settings" | "campaign" | "crm") => void;
  language: "ar" | "en";
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  progress,
  waStatus,
  config,
  contacts,
  logs,
  onStart,
  onPause,
  onResume,
  onClear,
  onReset,
  onOverrideDailyLimit,
  onOpenConnectModal,
  onNavigateTab,
  language,
}) => {
  const isAr = language === "ar";
  const isConnected = waStatus?.status === "CONNECTED";

  const total = contacts.length;
  const sent = contacts.filter((c) => c.status === "sent").length;
  const failed = contacts.filter((c) => c.status === "failed").length;
  const pending = contacts.filter(
    (c) => c.status === "pending" || c.status === "generating" || c.status === "sending"
  ).length;

  const totalPercent = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;
  const dailyPercent =
    config.enableDailyLimit && config.dailyLimit > 0
      ? Math.min(100, Math.round((progress.sentToday / config.dailyLimit) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner Alert if Waiting for Next Day */}
      {progress.isWaitingForNextDay && (
        <div className="bg-amber-950/50 border border-amber-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">
                {isAr ? "تم بلوغ الحد الأقصى للإرسال اليومي!" : "Daily Quota Reached!"}
              </span>
              <p className="text-amber-300/80 mt-0.5">
                {isAr
                  ? `أرسلت اليوم ${progress.sentToday} من أصل ${config.dailyLimit} رسالة. تم إيقاف الحملة مؤقتاً وستستكمل أوتوماتيكياً في اليوم التالي لحماية حسابك.`
                  : `Sent ${progress.sentToday} of ${config.dailyLimit} limit today. Automated pause until tomorrow to protect account.`}
              </p>
            </div>
          </div>
          <button
            onClick={onOverrideDailyLimit}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition shadow text-xs"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{isAr ? "تجاوز الحد اليومي والاستمرار الآن" : "Override & Continue Now"}</span>
          </button>
        </div>
      )}

      {/* Primary 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* WhatsApp Device Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {isAr ? "حالة جهاز واتساب" : "WhatsApp Device"}
            </span>
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
          </div>
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone className={`w-5 h-5 ${isConnected ? "text-emerald-400" : "text-slate-500"}`} />
              <span className="truncate">
                {isConnected
                  ? waStatus?.user?.name || waStatus?.user?.phone || (isAr ? "متصل وجاهز" : "Connected")
                  : isAr
                  ? "غير متصل"
                  : "Disconnected"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isConnected
                ? isAr
                  ? "الجلسة نشطة ومحمية عبر Baileys"
                  : "Active Baileys Multi-Device"
                : isAr
                ? "امسح الباركود لربط الجهاز"
                : "Scan QR code to pair"}
            </p>
          </div>
          <button
            onClick={onOpenConnectModal}
            className="w-full py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition flex items-center justify-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isConnected ? (isAr ? "إدارة الاتصال" : "Manage Device") : (isAr ? "ربط واتساب" : "Link WhatsApp")}</span>
          </button>
        </div>

        {/* Daily Quota Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span>{isAr ? "حد الإرسال اليومي" : "Daily Sending Quota"}</span>
              <Tooltip
                title={isAr ? "سقف الإرسال اليومي الآمن" : "Daily Quota System"}
                badgeText={isAr ? "حماية" : "Safety"}
                content={
                  isAr
                    ? "تحديد سقف يومي (100-150 رسالة) يحمي الحساب من الرصد الآلي. عند اكتمال الحصة، تتوقف الحملة أوتوماتيكياً وتستأنف في اليوم التالي دون فقدان التقدم."
                    : "Caps outbound messages per 24 hours to prevent account flagging. Automatically pauses and resumes tomorrow."
                }
              />
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {config.enableDailyLimit ? `${progress.sentToday} / ${config.dailyLimit}` : isAr ? "غير محدود" : "Unlimited"}
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white font-mono flex items-baseline gap-1">
              <span>{progress.sentToday}</span>
              {config.enableDailyLimit && (
                <span className="text-xs font-normal text-slate-400">
                  / {config.dailyLimit} {isAr ? "اليوم" : "today"}
                </span>
              )}
            </div>
            {config.enableDailyLimit && (
              <div className="w-full bg-slate-950 h-2 rounded-full mt-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${dailyPercent}%` }}
                />
              </div>
            )}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              {config.enableDailyLimit
                ? isAr
                  ? `متبقي اليوم: ${Math.max(0, config.dailyLimit - progress.sentToday)}`
                  : `Left today: ${Math.max(0, config.dailyLimit - progress.sentToday)}`
                : isAr
                ? "الحماية مفعلة"
                : "Active"}
            </span>
            <button
              onClick={() => onNavigateTab("settings")}
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              {isAr ? "تعديل الحد" : "Change Limit"}
            </button>
          </div>
        </div>

        {/* Campaign Deliveries */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              {isAr ? "إنجاز الحملة الإجمالي" : "Campaign Progress"}
            </span>
            <span className="text-xs font-mono font-bold text-white">{totalPercent}%</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <div>
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">{sent}</span>
                <span className="text-[11px] text-slate-400 block">{isAr ? "تم الإرسال" : "Sent"}</span>
              </div>
              <div className="border-r border-slate-800 h-8 mx-1" />
              <div>
                <span className="text-2xl font-extrabold text-amber-400 font-mono">{pending}</span>
                <span className="text-[11px] text-slate-400 block">{isAr ? "متبقي" : "Pending"}</span>
              </div>
              <div className="border-r border-slate-800 h-8 mx-1" />
              <div>
                <span className="text-2xl font-extrabold text-red-400 font-mono">{failed}</span>
                <span className="text-[11px] text-slate-400 block">{isAr ? "فشل" : "Failed"}</span>
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${totalPercent}%` }}
            />
          </div>
        </div>

        {/* Anti-Ban & Features Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span>{isAr ? "أنظمة الأمان والخصائص" : "Security & Features"}</span>
              <Tooltip
                title={isAr ? "دروع الحماية من الحظر" : "Anti-Ban Protection Shield"}
                content={
                  isAr
                    ? "مجموعة تقنيات ذكية مصممة خصيصاً للمستخدمين لحماية حسابات واتساب من الرصد الآلي، تشمل الفواصل العشوائية واستراحات التبريد الدورية."
                    : "Intelligent features designed to protect your WhatsApp account from algorithmic rate blocks and bans."
                }
              />
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            {/* Rate Limiting Delay */}
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isAr ? "فاصل عشوائي:" : "Delay:"}</span>
                <Tooltip
                  title={isAr ? "تنظيم وتيرة الإرسال (Rate Limiting)" : "Rate Limiting Intervals"}
                  content={
                    isAr
                      ? `فاصل عشوائي متغير (${config.minDelay}-${config.maxDelay} ثانية) بين كل رسالة لمحاكاة سرعة الإنسان ومنع تصنيف الحساب كبوت.`
                      : `Randomized gap (${config.minDelay}-${config.maxDelay}s) between consecutive dispatches to prevent bot detection.`
                  }
                />
              </span>
              <span className="font-mono text-emerald-400 text-[11px]">
                {config.minDelay}-{config.maxDelay}s
              </span>
            </div>

            {/* Batch Pause Cooldown */}
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>{isAr ? "فصل الدفعات:" : "Batch Cooldown:"}</span>
                <Tooltip
                  title={isAr ? "استراحة تبريد الحساب (Batch Pause)" : "Batch Pause Cooldown"}
                  badgeText={isAr ? "موصى به" : "Anti-Ban"}
                  content={
                    isAr
                      ? `استراحة أمان دورية كل ${config.batchSize || 10} رسائل مدتها ~${config.batchPauseDuration || 200} ثانية لتبريد الاتصال وكسر وتيرة الإرسال المتواصل.`
                      : `Automatic cooldown every ${config.batchSize || 10} messages for ~${config.batchPauseDuration || 200}s to cool down the connection.`
                  }
                />
              </span>
              <span className="font-mono text-purple-400 text-[11px]">
                {config.enableBatchPause
                  ? `${config.batchSize || 10}m / ~${config.batchPauseDuration || 200}s`
                  : isAr
                  ? "معطل"
                  : "Off"}
              </span>
            </div>

            {/* AI Rewriter */}
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                {isAr ? "إعادة صياغة Gemini:" : "AI Rewriter:"}
              </span>
              <span className={`text-[11px] ${config.useAI ? "text-emerald-400" : "text-slate-500"}`}>
                {config.useAI ? (isAr ? "مفعّل" : "Active") : isAr ? "معطّل" : "Disabled"}
              </span>
            </div>

            {/* Unique Timestamp */}
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isAr ? "توقيت وكود فريد:" : "Unique Timestamp:"}</span>
                <Tooltip
                  content={
                    isAr
                      ? "إضافة كود وختم زمني ديناميكي أسفل كل رسالة لمنع تطابق بصمة النص في خوادم واتساب."
                      : "Appends unique codes to eliminate duplicate text hash flags."
                  }
                />
              </span>
              <span className={`text-[11px] ${config.appendTimestampAndCode ? "text-emerald-400" : "text-slate-500"}`}>
                {config.appendTimestampAndCode ? (isAr ? "نعم (مانع للتكرار)" : "Enabled") : "Disabled"}
              </span>
            </div>

            {/* Attachment */}
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-[11px]">
                <Paperclip className="w-3.5 h-3.5 text-purple-400" />
                {isAr ? "مرفقات مضافة:" : "Attachment:"}
              </span>
              <span className="text-[11px] text-slate-300 truncate max-w-[120px]">
                {config.attachment ? config.attachment.fileName : isAr ? "لا يوجد" : "None"}
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("composer")}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold text-right rtl:text-right ltr:text-left"
          >
            {isAr ? "تعديل القالب والمرفق ←" : "Edit Template & Media →"}
          </button>
        </div>
      </div>

      {/* Main Action Bar: Start / Pause / Clear / Resume */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {isAr ? "التحكم الفوري في الحملة" : "Instant Campaign Controls"}
            </h3>
            <p className="text-xs text-slate-400">
              {progress.isRunning && !progress.isPaused
                ? isAr
                  ? "الحملة قيد الإرسال الآن..."
                  : "Campaign is actively dispatching..."
                : progress.isPaused
                ? isAr
                  ? "الحملة متوقفة مؤقتاً"
                  : "Campaign is currently paused"
                : isAr
                ? "جاهز للبدء فوراً"
                : "Ready to launch"}
            </p>
          </div>
        </div>

        {/* Buttons: Start, Pause, Resume, Clear */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!progress.isRunning ? (
            <button
              onClick={onStart}
              disabled={contacts.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isAr ? "بدء إرسال الحملة" : "Start Campaign"}</span>
            </button>
          ) : progress.isPaused ? (
            <button
              onClick={onResume}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isAr ? "استكمال الإرسال (Resume)" : "Resume"}</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow transition"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>{isAr ? "توقف مؤقت (Pause)" : "Pause"}</span>
            </button>
          )}

          {/* Clear Button */}
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-950/60 hover:bg-red-900/80 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl transition"
            title={isAr ? "مسح وإلغاء الحملة بالكامل" : "Clear and cancel campaign"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isAr ? "مسح وإلغاء الحملة (Clear)" : "Clear Campaign"}</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            disabled={progress.isRunning}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
            title={isAr ? "إعادة تعيين حالات الإرسال" : "Reset statuses"}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? "إعادة تعيين" : "Reset"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateTab("crm")}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isAr ? "نظام إدارة العملاء CRM" : "CRM & Leads"}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAr ? "سحب الرسائل والمتابعات" : "Leads & Follow-ups"}
              </p>
            </div>
          </div>
          <span className="text-xs text-blue-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition">
            →
          </span>
        </div>

        <div
          onClick={() => onNavigateTab("contacts")}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isAr ? "إدارة وتعديل جهات الاتصال" : "Manage Contacts"}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {contacts.length} {isAr ? "رقم مستهدف" : "contacts loaded"}
              </p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition">
            →
          </span>
        </div>

        <div
          onClick={() => onNavigateTab("composer")}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-105 transition">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isAr ? "القالب والمرفقات والذكاء الاصطناعي" : "Template & Attachments"}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {config.attachment ? (isAr ? "مرفق جاهز" : "Attachment ready") : isAr ? "نص فقط" : "Text only"}
              </p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition">
            →
          </span>
        </div>

        <div
          onClick={() => onNavigateTab("campaign")}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isAr ? "غرفة المراقبة والتقرير" : "Live Room & Report"}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAr ? "سجل حي وتصدير CSV" : "Real-time feed & export"}
              </p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition">
            →
          </span>
        </div>
      </div>
    </div>
  );
};
