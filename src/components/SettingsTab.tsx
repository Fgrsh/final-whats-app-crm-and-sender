import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Clock,
  Zap,
  Sliders,
  Smartphone,
  ExternalLink,
  Calendar,
  Hash,
  HelpCircle,
  Sparkles,
  Database,
  Download,
  Upload,
} from "lucide-react";
import type { CampaignConfig } from "../types.ts";
import { Tooltip } from "./Tooltip.tsx";

interface SettingsTabProps {
  config: CampaignConfig;
  onChangeConfig: (newConfig: Partial<CampaignConfig>) => void;
  language: "ar" | "en";
  onOpenBackupModal?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  config,
  onChangeConfig,
  language,
  onOpenBackupModal,
}) => {
  const isAr = language === "ar";

  // Local string states for inputs to allow smooth typing without mid-keystroke resets
  const [minDelayStr, setMinDelayStr] = useState<string>(String(config.minDelay ?? 8));
  const [maxDelayStr, setMaxDelayStr] = useState<string>(String(config.maxDelay ?? 20));

  useEffect(() => {
    setMinDelayStr(String(config.minDelay ?? 8));
  }, [config.minDelay]);

  useEffect(() => {
    setMaxDelayStr(String(config.maxDelay ?? 20));
  }, [config.maxDelay]);

  const handleMinDelayChange = (rawVal: number) => {
    const safeMin = Math.max(1, Math.round(rawVal));
    const currentMax = config.maxDelay || 20;
    const safeMax = Math.max(safeMin, currentMax);
    onChangeConfig({
      minDelay: safeMin,
      maxDelay: safeMax,
    });
  };

  const handleMaxDelayChange = (rawVal: number) => {
    const safeMax = Math.max(1, Math.round(rawVal));
    const currentMin = config.minDelay || 8;
    const safeMin = Math.min(safeMax, currentMin);
    onChangeConfig({
      minDelay: safeMin,
      maxDelay: safeMax,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Daily Sending Limit Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "الحد الأقصى للإرسال اليومي والاستئناف التلقائي" : "Daily Sending Quota & Auto-Continuation"}
                </h3>
                <Tooltip
                  title={isAr ? "كيف تعمل الحصة اليومية للمبتدئين؟" : "How Daily Quota Works"}
                  badgeText={isAr ? "حماية الحساب" : "Account Safety"}
                  content={
                    isAr ? (
                      <div className="space-y-1.5">
                        <p>
                          <strong className="text-amber-300">لماذا نحدد سقفاً يومياً؟</strong> تفرض واتساب رقابة مشددة على الحسابات التي تبدأ محادثات كثيرة مع أرقام جديدة. إرسال 100 إلى 150 رسالة يومياً هو المعدل الأكثر أماناً لحماية الرقم من التقييد أو الحظر.
                        </p>
                        <p>
                          <strong className="text-emerald-300">الاستئناف التلقائي:</strong> عند بلوغ الحد المحدد (مثلاً 150)، تتوقف الحملة مؤقتاً وبمجرد بدء اليوم التالي تواصل الإرسال أوتوماتيكياً حتى تنتهي القائمة بالكامل دون أي تدخل منك.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p>
                          <strong className="text-amber-300">Why a Daily Quota?</strong> WhatsApp strictly monitors accounts initiating excessive conversations with non-contacts. Keeping daily volume around 100-150 messages safeguards your account from restrictions.
                        </p>
                        <p>
                          <strong className="text-emerald-300">Auto-Continuation:</strong> Once today's quota is reached, the campaign pauses and resumes automatically tomorrow.
                        </p>
                      </div>
                    )
                  }
                />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "تحديد حد أقصى للرسائل يومياً (مثل 150 أو 100). عند بلوغ الحد، تتوقف الحملة وتستأنف تلقائياً في اليوم التالي."
                  : "Cap daily outbound volume (e.g. 150 messages/day). Automatically pauses and resumes on the next day."}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableDailyLimit}
              onChange={(e) => onChangeConfig({ enableDailyLimit: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {config.enableDailyLimit && (
          <div className="space-y-4 pt-2 border-t border-slate-800/80">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300">
                  {isAr ? "عدد الأرقام / الرسائل المسموح بها في اليوم الواحد:" : "Daily Message Limit (Messages / Day):"}
                </label>
                <div className="flex items-center gap-2">
                  {[50, 100, 150, 250, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChangeConfig({ dailyLimit: preset })}
                      className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg border transition ${
                        config.dailyLimit === preset
                          ? "bg-emerald-600 text-white border-emerald-500 shadow"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={config.dailyLimit}
                  onChange={(e) => onChangeConfig({ dailyLimit: Math.max(1, Number(e.target.value)) })}
                  className="w-36 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400">
                  {isAr
                    ? "رسالة كل 24 ساعة (مثال: إذا وضعت 1000 رقم واخترت 150، سيرسل 150 اليوم ثم يكمل غداً 150 وهكذا حتى يكتمل الـ 1000)"
                    : "messages every 24 hours. Extra numbers automatically queue for the following day."}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-300/90 leading-relaxed">
              💡 {isAr
                ? "ميزة الأمان الذكي: يمكنك دائماً مراقبة كمية الإرسال اليومية من لوحة المؤشرات (Dashboard) وتجاوز الحد يدوياً إذا رغبت بالاستمرار في أي وقت."
                : "Safe Sending Tip: You can monitor daily progress on the Dashboard tab and override the limit anytime if needed."}
            </div>
          </div>
        )}
      </div>

      {/* Anti-Ban Delay Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "نظام الفاصل الزمني العشوائي (Anti-Ban Delays)" : "Anti-Ban Smart Delay Intervals"}
                </h3>
                <Tooltip
                  title={isAr ? "كيف يحميك الفاصل الزمني العشوائي؟" : "How Rate Limiting Protects You"}
                  badgeText={isAr ? "تنظيم الوتيرة" : "Rate Limiting"}
                  content={
                    isAr ? (
                      <div className="space-y-1.5">
                        <p>
                          <strong className="text-emerald-300">ما هي مشكلة الإرسال السريع؟</strong> خوارزميات مكافحة السبام في واتساب تراقب السرعة الفورية. إرسال رسائل متتالية بسرعة ثابتة أو بدون توقف يكشف فوراً أن الحساب يستخدم برنامجاً آلياً (Bot).
                        </p>
                        <p>
                          <strong className="text-teal-300">الفاصل العشوائي:</strong> يقوم النظام باختيار وقت انتظار عشوائي جديد تماماً لكل رسالة بين الحد الأدنى والأقصى (مثلاً: 12 ثانية، ثم 19 ثانية، ثم 8 ثوانٍ)، مما يظهر المحادثات كنشاط بشري طبيعي تماماً.
                        </p>
                        <p className="text-slate-400 pt-0.5 border-t border-slate-800 text-[11px]">
                          💡 للأرقام الجديدة أو الحساسة، ننصح برفع الفاصل إلى 30-120 ثانية.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p>
                          <strong className="text-emerald-300">Why Rate Limiting?</strong> WhatsApp anti-spam algorithms instantly detect bot behavior when messages are sent in rapid or constant intervals.
                        </p>
                        <p>
                          <strong className="text-teal-300">Randomized Timing:</strong> For each recipient, the system generates an unpredictable delay between Min and Max, flawlessly emulating authentic human conversation rhythms.
                        </p>
                      </div>
                    )
                  }
                />
              </div>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "يضع فاصلاً زمنياً عشوائياً بين كل رسالة والأخرى لمحاكاة السلوك البشري وتفادي الحظر"
                  : "Randomized delays mimic authentic human typing rhythm to protect your account"}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {config.minDelay}s - {config.maxDelay}s
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          {/* Min Delay Slider & Input */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <span>{isAr ? "الحد الأدنى للانتظار (Min):" : "Minimum Delay (Min):"}</span>
                <Tooltip
                  content={
                    isAr
                      ? "أقل عدد ثوانٍ سينتظره البرنامج قبل إرسال الرسالة التالية. يُنصح بـ 8 ثوانٍ أو أكثر."
                      : "The shortest waiting time before dispatching the next message. 8+ seconds recommended."
                  }
                />
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={minDelayStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setMinDelayStr(val);
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 1) {
                      handleMinDelayChange(num);
                    }
                  }}
                  onBlur={() => {
                    const num = parseInt(minDelayStr, 10);
                    if (isNaN(num) || num < 1) {
                      setMinDelayStr(String(config.minDelay || 8));
                    } else {
                      handleMinDelayChange(num);
                      setMinDelayStr(String(num));
                    }
                  }}
                  className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-emerald-400 text-center focus:outline-none transition"
                />
                <span className="text-slate-400 text-[11px]">{isAr ? "ثانية" : "sec"}</span>
              </div>
            </div>

            <input
              type="range"
              min={1}
              max={100}
              value={config.minDelay || 8}
              onChange={(e) => handleMinDelayChange(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />

            {/* Min Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>1s</span>
                <span className="font-medium text-slate-400">{isAr ? "خيارات سريعة:" : "Quick Presets:"}</span>
                <span>100s</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[3, 5, 8, 12, 20, 30].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleMinDelayChange(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                      config.minDelay === preset
                        ? "bg-emerald-600 text-white border-emerald-500 font-bold shadow-sm"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {preset}s
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {isAr ? "أقل مدة انتظار قبل الانتقال للرقم التالي" : "Fastest gap between messages"}
            </p>
          </div>

          {/* Max Delay Slider & Input */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <span>{isAr ? "الحد الأقصى للانتظار (Max):" : "Maximum Delay (Max):"}</span>
                <Tooltip
                  content={
                    isAr
                      ? "أقصى مدة انتظار عشوائية (تصل إلى 200 ثانية وأكثر). كلما كانت أعلى، زاد الأمان وتشتيت الرصد الآلي."
                      : "The upper limit for the random pause (supports up to 200s+). Longer delays provide superior safety."
                  }
                />
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={maxDelayStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setMaxDelayStr(val);
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 1) {
                      handleMaxDelayChange(num);
                    }
                  }}
                  onBlur={() => {
                    const num = parseInt(maxDelayStr, 10);
                    if (isNaN(num) || num < 1) {
                      setMaxDelayStr(String(config.maxDelay || 20));
                    } else {
                      handleMaxDelayChange(num);
                      setMaxDelayStr(String(num));
                    }
                  }}
                  className="w-16 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-emerald-400 text-center focus:outline-none transition"
                />
                <span className="text-slate-400 text-[11px]">{isAr ? "ثانية" : "sec"}</span>
              </div>
            </div>

            <input
              type="range"
              min={1}
              max={250}
              value={config.maxDelay || 20}
              onChange={(e) => handleMaxDelayChange(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />

            {/* Max Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>1s</span>
                <span className="font-medium text-slate-400">{isAr ? "خيارات سريعة:" : "Quick Presets:"}</span>
                <span>250s</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[15, 30, 60, 100, 150, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleMaxDelayChange(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                      config.maxDelay === preset
                        ? "bg-emerald-600 text-white border-emerald-500 font-bold shadow-sm"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {preset}s
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {isAr ? "أعلى مدة انتظار عشوائية بين الرسائل لحماية الرقم وتفادي الحظر" : "Highest randomized gap limit"}
            </p>
          </div>
        </div>

        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-300/90 leading-relaxed">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-emerald-200">
              {isAr
                ? `⏱️ نطاق الفاصل المطبق حالياً: عشوائي من ${config.minDelay || 8} إلى ${config.maxDelay || 20} ثانية بين كل رسالة والأخرى`
                : `⏱️ Active Delay Range: Randomized from ${config.minDelay || 8} to ${config.maxDelay || 20} seconds between consecutive messages`}
            </div>
            <p className="text-slate-400 text-[11px]">
              {isAr
                ? "يقوم المحرك باختيار وقت انتظار عشوائي جديد تماماً قبل كل رسالة لمحاكاة سرعة الطباعة البشرية ومنع الحساب من السقوط في فخ رصد البوتات."
                : "The engine picks a brand new random delay before dispatching each message, emulating human activity and bypassing automated bot detection."}
            </p>
          </div>
        </div>
      </div>

      {/* Batch Pause / Cooldown Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "فصل أمان عشوائي دوري بعد كل دفعة رسائل (Batch Cooldown)" : "Periodic Randomized Batch Pause"}
                </h3>
                <Tooltip
                  title={isAr ? "كيف تحميك استراحة الدفعات (Batch Pause)؟" : "How Batch Pause Protects You"}
                  badgeText={isAr ? "حماية من الحظر" : "Anti-Ban Shield"}
                  content={
                    isAr ? (
                      <div className="space-y-1.5">
                        <p>
                          <strong className="text-purple-300">لماذا الاستراحة الدورية ضرورية؟</strong> حتى مع وجود فواصل بين الرسائل، فإن الإرسال المستمر لعشرات الأرقام دون توقف يرفع معدل نشاط الحساب (Burst Activity) لدى خوادم واتساب.
                        </p>
                        <p>
                          <strong className="text-teal-300">تبريد الحساب:</strong> بعد إرسال كل 10 رسائل (أو حسب رغبتك)، يتوقف البرنامج تماماً لمدة 200 ثانية (~3.3 دقائق). هذا التوقف يسمح للحساب بالراحة، واستقبال تقارير التسليم، ومحاكاة شخص حقيقي يقوم بمهام أخرى.
                        </p>
                        <p>
                          <strong className="text-emerald-300">التنويع العشوائي (±15 ثانية):</strong> يغير البرنامج مدة التوقف قليلاً في كل مرة تلقائياً حتى لا يكون هناك نمط ميكانيكي ثابت يمكن رصده.
                        </p>
                        <p className="text-slate-400 pt-0.5 border-t border-slate-800 text-[11px]">
                          ⚡ ميزة أوتوماتيكية بالكامل: يستأنف الإرسال وحده فور انتهاء وقت التبريد دون الحاجة لتدخلك.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p>
                          <strong className="text-purple-300">The Problem with Continuous Sending:</strong> Even with delays, non-stop dispatching builds up burst scores.
                        </p>
                        <p>
                          <strong className="text-teal-300">Account Cooldown:</strong> Automatically pauses every 10 messages for ~200s (~3.3m). This cools down the connection and emulates a human taking a break.
                        </p>
                        <p>
                          <strong className="text-emerald-300">Random Jitter:</strong> Applies ±15s variation so the pause duration never looks mechanical.
                        </p>
                      </div>
                    )
                  }
                />
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 font-medium">
                  {isAr ? "حماية متقدمة من الحظر" : "Anti-Ban Shield"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "توقف مؤقت عشوائي بعد كل 10 رسائل مدته 200 ثانية (أو حسب رغبتك) لمحاكاة سلوك الإنسان الطبيعي وتبريد الحساب."
                  : "Pause the campaign after every batch of messages for a randomized duration to let the account cool down."}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableBatchPause ?? true}
              onChange={(e) => onChangeConfig({ enableBatchPause: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {(config.enableBatchPause ?? true) && (
          <div className="space-y-4 pt-2 border-t border-slate-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Batch Size */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1">
                    <span>{isAr ? "فصل الإرسال بعد كل:" : "Pause after every:"}</span>
                    <Tooltip
                      content={
                        isAr
                          ? "حجم الدفعة: عدد الرسائل التي تُرسل قبل الدخول في فترة الاستراحة وتبريد الحساب. القيمة المثالية: 10 رسائل."
                          : "Batch size: Number of messages sent before pausing for cooldown. Default recommended: 10 messages."
                      }
                    />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={config.batchSize || 10}
                      onChange={(e) => onChangeConfig({ batchSize: Math.max(1, Number(e.target.value)) })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-purple-400 text-center"
                    />
                    <span className="text-slate-400 text-[11px]">{isAr ? "رسائل" : "msgs"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5, 10, 15, 20, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChangeConfig({ batchSize: preset })}
                      className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition ${
                        (config.batchSize || 10) === preset
                          ? "bg-purple-600 text-white border-purple-500 shadow"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {preset} {isAr ? "رسائل" : "msgs"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  {isAr ? "القيمة الموصى بها: كل 10 رسائل يتم عمل توقف مؤقت" : "Recommended: 10 messages per batch"}
                </p>
              </div>

              {/* Pause Duration */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1">
                    <span>{isAr ? "مدة الفصل الأمني (ثوانٍ):" : "Pause Duration (sec):"}</span>
                    <Tooltip
                      content={
                        isAr
                          ? "مدة الاستراحة بالثواني (200 ثانية = 3.3 دقائق). يقوم النظام بإضافة تنويع عشوائي طفيف تلقائياً (±15 ثانية) لكسر أي نمط مكشوف."
                          : "Duration of the cooldown pause (200s = ~3.3 min). Includes ±15s random variation for natural pacing."
                      }
                    />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={10}
                      max={900}
                      value={config.batchPauseDuration || 200}
                      onChange={(e) => onChangeConfig({ batchPauseDuration: Math.max(10, Number(e.target.value)) })}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-purple-400 text-center"
                    />
                    <span className="text-slate-400 text-[11px]">
                      {isAr
                        ? `ثانية (~${((config.batchPauseDuration || 200) / 60).toFixed(1)} د)`
                        : `sec (~${((config.batchPauseDuration || 200) / 60).toFixed(1)} m)`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[60, 120, 180, 200, 300].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChangeConfig({ batchPauseDuration: preset })}
                      className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition ${
                        (config.batchPauseDuration || 200) === preset
                          ? "bg-purple-600 text-white border-purple-500 shadow"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {preset}s {preset === 200 ? (isAr ? "(الافتراضي)" : "(Default)") : ""}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  {isAr
                    ? "مدة التوقف (افتراضي 200 ثانية مع تنويع عشوائي ذكي ±15 ثانية لمنع النمط الثابت)"
                    : "Default 200s with random jitter ±15s to emulate natural human pauses"}
                </p>
              </div>
            </div>

            <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-purple-300/90 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                {isAr
                  ? `الحماية مفعلة: بعد إرسال كل ${config.batchSize || 10} رسائل، سيتوقف البرنامج تلقائياً لمدة ${config.batchPauseDuration || 200} ثانية (~${((config.batchPauseDuration || 200) / 60).toFixed(1)} دقيقة) بشكل عشوائي، ثم يستأنف باقي الحملة بدون تدخل منك.`
                  : `Active Protection: The queue automatically pauses for ~${config.batchPauseDuration || 200} seconds every ${config.batchSize || 10} messages with random variation, then resumes seamlessly.`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Unique Verification & Timestamp Code Option */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isAr ? "تذييل كل رسالة بالتوقيت وكود فريد" : "Dynamic Timestamp & Unique Verification Code"}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "يضمن أن كل رسالة تخرج ببصمة رقمية مختلفة ومحتوى غير مكرر"
                  : "Ensures every outbound message has a unique cryptographic hash and distinct timestamp"}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.appendTimestampAndCode}
              onChange={(e) => onChangeConfig({ appendTimestampAndCode: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Sending Method Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {isAr ? "طريقة وآلية الإرسال المفضلة" : "Dispatch Method"}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr
                ? "اختر بين الإرسال التلقائي الصامت عبر الحساب المرتبط أو تجهيز روابط المحادثة الفورية"
                : "Choose automated socket sending or manual 1-click wa.me dispatch"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Option 1: Baileys Auto */}
          <div
            onClick={() => onChangeConfig({ sendMethod: "baileys" })}
            className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
              config.sendMethod === "baileys"
                ? "bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10"
                : "bg-slate-950 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white">
                  {isAr ? "إرسال تلقائي عبر واتساب المرتبط (Baileys)" : "Direct Linked Device (Auto)"}
                </h4>
              </div>
              <input
                type="radio"
                name="sendMethod"
                checked={config.sendMethod === "baileys"}
                onChange={() => onChangeConfig({ sendMethod: "baileys" })}
                className="accent-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isAr
                ? "يرسل الرسائل آلياً في الخلفية مباشرة من شريحتك دون الحاجة لفتح المتصفح لكل رقم."
                : "Silently dispatches messages directly through your connected WhatsApp multi-device session."}
            </p>
          </div>

          {/* Option 2: Direct Link */}
          <div
            onClick={() => onChangeConfig({ sendMethod: "direct_link" })}
            className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
              config.sendMethod === "direct_link"
                ? "bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10"
                : "bg-slate-950 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-teal-400" />
                <h4 className="text-xs font-bold text-white">
                  {isAr ? "روابط واتساب ويب المباشرة (wa.me)" : "Click-to-Chat Links (Manual)"}
                </h4>
              </div>
              <input
                type="radio"
                name="sendMethod"
                checked={config.sendMethod === "direct_link"}
                onChange={() => onChangeConfig({ sendMethod: "direct_link" })}
                className="accent-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isAr
                ? "تجهيز الرسائل وروابط wa.me لكل رقم لإرسالها يدوياً بنقرة واحدة بدون الحاجة لربط باركود."
                : "Prepares tailored messages and wa.me links you can click to send via WhatsApp Web."}
            </p>
          </div>
        </div>
      </div>

      {/* Full System Backup & Restore Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "النسخ الاحتياطي واستعادة كافة البيانات (Full System Backup & Restore)" : "Full System Backup & Restore"}
                </h3>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded-full font-medium">
                  {isAr ? "شامل لكل شيء" : "Everything"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "تصدير أو استيراد كل بيانات التطبيق: كتالوج المنتجات، الأسئلة الشائعة (14 سؤال وجواب)، إعدادات الوكيل، أوردرات البيع، عملاء الـ CRM، والقوالب والحملات."
                  : "Export or restore entire database: products, 14 FAQs, agent settings, orders, CRM leads, and campaigns."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-300 leading-relaxed">
            <p className="font-semibold text-white mb-1">
              {isAr ? "🔒 أمان واستمرارية عملك بنسبة 100%" : "🔒 100% Data Continuity"}
            </p>
            <p className="text-slate-400">
              {isAr
                ? "إذا أردت إغلاق البرنامج وفتحه لاحقاً، حمّل ملف النسخة الاحتياطية بنقرة واحدة، وعند فتحه مجدداً استرجع كل صغيرة وكبيرة فورياً."
                : "Easily backup all data to a single JSON snapshot file, and restore it anytime with 1 click."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => {
                if (onOpenBackupModal) {
                  onOpenBackupModal();
                } else {
                  window.open("/api/system/export?download=true", "_blank");
                }
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isAr ? "تصدير كل البيانات (.json)" : "Export All (.json)"}</span>
            </button>

            {onOpenBackupModal && (
              <button
                onClick={onOpenBackupModal}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{isAr ? "استيراد واسترجاع" : "Import & Restore"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
