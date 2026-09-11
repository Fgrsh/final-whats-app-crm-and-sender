import React, { useMemo, useState } from "react";
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  BarChart3,
  PieChart,
} from "lucide-react";
import type { Contact, QueueProgress, LogEntry } from "../types.ts";
import { Tooltip } from "./Tooltip.tsx";

interface MessageHistorySummaryProps {
  contacts: Contact[];
  progress: QueueProgress;
  logs: LogEntry[];
  language: "ar" | "en";
}

export const MessageHistorySummary: React.FC<MessageHistorySummaryProps> = ({
  contacts,
  progress,
  logs,
  language,
}) => {
  const isAr = language === "ar";
  const [chartType, setChartType] = useState<"donut" | "bar">("donut");

  // Derive message counts and rates
  const metrics = useMemo(() => {
    const total = contacts.length || progress.total;
    const sent = contacts.filter((c) => c.status === "sent").length;
    const failed = contacts.filter((c) => c.status === "failed").length;
    const pending = contacts.filter(
      (c) => c.status === "pending" || c.status === "generating" || c.status === "sending"
    ).length;

    // Use higher value between contact filter and progress state for resilience
    const finalSent = Math.max(sent, progress.sent);
    const finalFailed = Math.max(failed, progress.failed);
    const processed = finalSent + finalFailed;

    const successRate = processed > 0 ? (finalSent / processed) * 100 : 0;
    const failureRate = processed > 0 ? (finalFailed / processed) * 100 : 0;
    const overallCompletionRate = total > 0 ? (processed / total) * 100 : 0;

    // Recent message history (most recent sent or failed contacts)
    const historyList = contacts
      .filter((c) => c.status === "sent" || c.status === "failed")
      .sort((a, b) => {
        if (a.sentAt && b.sentAt) {
          return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
        }
        return 0;
      })
      .slice(0, 10);

    // Delivery health evaluation
    let healthLabel = isAr ? "غير محدد" : "N/A";
    let healthColor = "text-slate-400 bg-slate-800 border-slate-700";
    let healthNote = isAr
      ? "بانتظار بدء الإرسال لتقييم كفاءة ومعدلات التسليم."
      : "Awaiting dispatch to calculate delivery health.";

    if (processed > 0) {
      if (successRate >= 92) {
        healthLabel = isAr ? "ممتاز جداً" : "Optimal";
        healthColor = "text-emerald-300 bg-emerald-950/60 border-emerald-500/40";
        healthNote = isAr
          ? "معدل التسليم استثنائي وتصل الرسائل بنجاح بدون مشاكل بالأرقام."
          : "Exceptional delivery rate, contacts are active and reachable.";
      } else if (successRate >= 75) {
        healthLabel = isAr ? "جيد ومستقر" : "Good";
        healthColor = "text-teal-300 bg-teal-950/60 border-teal-500/40";
        healthNote = isAr
          ? "معدل التسليم طبيعي وضمن الحدود التشغيلية المقبولة."
          : "Normal delivery rate within acceptable operational margins.";
      } else if (successRate >= 50) {
        healthLabel = isAr ? "متوسط" : "Fair";
        healthColor = "text-amber-300 bg-amber-950/60 border-amber-500/40";
        healthNote = isAr
          ? "يوجد بعض الأرقام غير المسجلة أو مشاكل اتصال، يرجى فحص القائمة."
          : "Elevated error frequency. Review failed numbers for invalid entries.";
      } else {
        healthLabel = isAr ? "يحتاج مراجعة" : "Attention Required";
        healthColor = "text-red-300 bg-red-950/60 border-red-500/40";
        healthNote = isAr
          ? "نسبة الفشل مرتفعة، تحقق من اتصال واتساب وصحة صيغ الأرقام."
          : "High failure rate. Verify WhatsApp connection and phone formatting.";
      }
    }

    return {
      total,
      sent: finalSent,
      failed: finalFailed,
      pending,
      processed,
      successRate,
      failureRate,
      overallCompletionRate,
      historyList,
      healthLabel,
      healthColor,
      healthNote,
    };
  }, [contacts, progress, isAr]);

  // Geometry for SVG Donut Chart
  const size = 150;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const successStroke = (metrics.successRate / 100) * circumference;
  const failureStroke = (metrics.failureRate / 100) * circumference;

  return (
    <div
      id="message-history-section"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm"
    >
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {isAr ? "سجل وأداء الرسائل (Message History)" : "Message History & Performance"}
              </h3>
              <Tooltip
                title={isAr ? "تحليل معدل النجاح والفشل" : "Delivery Success & Failure Analysis"}
                content={
                  isAr ? (
                    <p>
                      رسم بياني إحصائي يُظهر نسبة الرسائل التي تم تسليمها بنجاح مقارنة بالرسائل التي واجهت أخطاء إرسال، مع عرض تفصيلي لآخر السجلات وتوزيع الحالات.
                    </p>
                  ) : (
                    <p>
                      Visualizes real-time delivery success vs. failure rates with detailed historical dispatches and reliability indicators.
                    </p>
                  )
                }
              />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr
                ? "متابعة دقيقة لمعدلات تسليم الرسائل ونسبة الأخطاء المباشرة للحملة"
                : "Live visualization of message delivery throughput, success ratios, and failure rates"}
            </p>
          </div>
        </div>

        {/* Action / Toggle Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setChartType("donut")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                chartType === "donut"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title={isAr ? "عرض دائري (Donut)" : "Donut Chart View"}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>{isAr ? "دائري" : "Donut"}</span>
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                chartType === "bar"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title={isAr ? "عرض أشرطة بيانية (Bar)" : "Bar Chart View"}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isAr ? "أشرطة" : "Bars"}</span>
            </button>
          </div>

          <span className="text-[11px] font-mono px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
            {isAr ? "تم معالجة:" : "Processed:"}{" "}
            <strong className="text-white">{metrics.processed}</strong> / {metrics.total}
          </span>
        </div>
      </div>

      {/* Main Grid: Visual Chart + Detailed Rate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Chart Column (5 cols) */}
        <div className="md:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px]">
          {metrics.processed === 0 ? (
            /* Standby State when campaign hasn't sent any messages yet */
            <div className="text-center py-4 space-y-2.5">
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <svg className="w-full h-full" viewBox={`0 0 ${size} ${size}`}>
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                    strokeDasharray="6 6"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <Activity className="w-6 h-6 text-slate-600 mb-1 animate-pulse" />
                  <span className="text-xs font-bold text-slate-400">0%</span>
                  <span className="text-[9px] text-slate-500">{isAr ? "جاهز للإرسال" : "Ready"}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                {isAr
                  ? "سيبدأ الرسم البياني برصد وتصنيف معدل النجاح والفشل لحظياً فور إطلاق الحملة."
                  : "The chart will visualize success and failure rates dynamically as messages are dispatched."}
              </p>
            </div>
          ) : chartType === "donut" ? (
            /* Donut Chart Visualization */
            <div className="w-full flex flex-col items-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
                  {/* Background Track */}
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                  />

                  {/* Success Arc (Green) */}
                  {metrics.successRate > 0 && (
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${successStroke} ${circumference}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  )}

                  {/* Failure Arc (Red) */}
                  {metrics.failureRate > 0 && (
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${failureStroke} ${circumference}`}
                      strokeDashoffset={-successStroke}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  )}
                </svg>

                {/* Donut Center Metrics */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-2xl font-black tracking-tight text-white font-mono">
                    {metrics.successRate.toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-400">
                    {isAr ? "معدل النجاح" : "Success Rate"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {metrics.sent} / {metrics.processed}
                  </span>
                </div>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  <span className="text-slate-300 font-medium">
                    {isAr ? "ناجحة" : "Success"} ({metrics.successRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                  <span className="text-slate-300 font-medium">
                    {isAr ? "فاشلة" : "Failed"} ({metrics.failureRate.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Bar Chart Visualization */
            <div className="w-full space-y-3.5 py-2">
              {/* Success Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isAr ? "معدل الإرسال الناجح:" : "Success Rate:"}</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {metrics.successRate.toFixed(1)}% ({metrics.sent})
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${metrics.successRate}%` }}
                  />
                </div>
              </div>

              {/* Failure Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-red-400 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isAr ? "معدل الإرسال الفاشل:" : "Failure Rate:"}</span>
                  </span>
                  <span className="font-mono font-bold text-red-400">
                    {metrics.failureRate.toFixed(1)}% ({metrics.failed})
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-red-600 to-rose-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${metrics.failureRate}%` }}
                  />
                </div>
              </div>

              {/* Pending / Remaining Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{isAr ? "قيد الانتظار بالطابور:" : "Pending In Queue:"}</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {metrics.total > 0 ? ((metrics.pending / metrics.total) * 100).toFixed(1) : 0}% ({metrics.pending})
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${metrics.total > 0 ? (metrics.pending / metrics.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rate Cards & Quality Indicators (7 cols) */}
        <div className="md:col-span-7 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Success Metrics Card */}
            <div className="bg-slate-950/70 border border-emerald-500/25 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isAr ? "رسائل ناجحة" : "Delivered"}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded-full border border-emerald-500/20 font-mono">
                  {metrics.successRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{metrics.sent}</span>
                <span className="text-[11px] text-slate-400">
                  {isAr ? "من المعالجة" : "of processed"}
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-tight">
                {isAr
                  ? "تم تسليمها للعملاء بنجاح عبر بروتوكول واتساب."
                  : "Successfully dispatched and delivered to active WhatsApp account."}
              </p>
            </div>

            {/* Failure Metrics Card */}
            <div className="bg-slate-950/70 border border-red-500/25 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{isAr ? "رسائل متعثرة" : "Failed"}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500/10 text-red-300 rounded-full border border-red-500/20 font-mono">
                  {metrics.failureRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{metrics.failed}</span>
                <span className="text-[11px] text-slate-400">
                  {isAr ? "أخطاء تسليم" : "delivery errors"}
                </span>
              </div>
              <p className="text-[11px] text-red-200/80 leading-tight">
                {isAr
                  ? "أرقام غير موجودة أو واجهت مهلة اتصال."
                  : "Invalid phone formatting, unregistered, or timed out."}
              </p>
            </div>
          </div>

          {/* Delivery Reliability & Health Assessment Banner */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-bold">
                  {isAr ? "مؤشر صحة الحملة:" : "Delivery Health Index:"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${metrics.healthColor}`}
                >
                  {metrics.healthLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-md">{metrics.healthNote}</p>
            </div>

            {/* Quick Completion Ratio */}
            <div className="text-right">
              <div className="text-[11px] text-slate-400">
                {isAr ? "إنجاز الحملة الكلي" : "Campaign Progress"}
              </div>
              <div className="text-sm font-mono font-bold text-white">
                {metrics.overallCompletionRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Message History Stream (Last Dispatches) */}
      {metrics.historyList.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>{isAr ? "آخر الرسائل المرسلة بالسجل:" : "Recent Outbound Message Stream:"}</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {isAr ? "أحدث" : "Latest"} {metrics.historyList.length}{" "}
              {isAr ? "عمليات" : "dispatches"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {metrics.historyList.map((item) => (
              <div
                key={item.id}
                className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition ${
                  item.status === "sent"
                    ? "bg-slate-950/80 border-emerald-500/20 hover:border-emerald-500/40"
                    : "bg-slate-950/80 border-red-500/20 hover:border-red-500/40"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {item.status === "sent" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                  <div className="overflow-hidden">
                    <p className="font-semibold text-white truncate text-[11px]">
                      {item.name || `+${item.phone}`}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">+{item.phone}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      item.status === "sent"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-red-500/10 text-red-300"
                    }`}
                  >
                    {item.status === "sent" ? (isAr ? "ناجح" : "Sent") : isAr ? "فشل" : "Fail"}
                  </span>
                  {item.sentAt && (
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {new Date(item.sentAt).toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
