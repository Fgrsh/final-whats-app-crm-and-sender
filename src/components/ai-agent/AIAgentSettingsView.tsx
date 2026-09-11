import React, { useState } from "react";
import {
  Settings,
  Bot,
  Clock,
  Shield,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Save,
  CheckCircle2,
  Loader2,
  Sliders,
  MessageSquare,
  AlertOctagon,
  FileText,
  ListOrdered,
  History,
  Check,
} from "lucide-react";
import type { AIAgentSettings, AIAgentMode } from "../../types.ts";

interface AIAgentSettingsViewProps {
  settings: AIAgentSettings;
  language: "ar" | "en";
  onSaveSettings: (updated: Partial<AIAgentSettings>) => Promise<void>;
}

export const AIAgentSettingsView: React.FC<AIAgentSettingsViewProps> = ({
  settings,
  language,
  onSaveSettings,
}) => {
  const isAr = language === "ar";
  const [formData, setFormData] = useState<AIAgentSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Sync if prop updates only when not dirty
  React.useEffect(() => {
    if (!isDirty) {
      setFormData(settings);
    }
  }, [settings, isDirty]);

  const updateField = <K extends keyof AIAgentSettings>(
    key: K,
    val: AIAgentSettings[K]
  ) => {
    setIsDirty(true);
    setSaveSuccess(false);
    setSavedNotice(null);
    setErrorMessage(null);
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSavedNotice(null);
    setErrorMessage(null);
    try {
      await onSaveSettings(formData);
      setIsDirty(false);
      setSaveSuccess(true);
      setSavedNotice(
        isAr
          ? `تم حفظ وتحديث هوية الوكيل (${formData.agentName}) والشركة (${formData.companyName}) بنجاح!`
          : `Agent identity (${formData.agentName}) and store (${formData.companyName}) saved successfully!`
      );
      setTimeout(() => {
        setSaveSuccess(false);
        setSavedNotice(null);
      }, 5000);
    } catch (e: any) {
      console.error("Error saving settings:", e);
      setErrorMessage(
        e?.message || (isAr ? "حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى." : "Error saving settings, please retry.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-teal-400" />
            <h2 className="text-base font-bold text-white">
              {isAr ? "إعدادات وقواعد عمل الوكيل الذكي" : "AI Sales Agent Rules & Settings"}
            </h2>
            {isDirty && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-semibold animate-pulse">
                {isAr ? "تعديلات غير محفوظة" : "Unsaved changes"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? "تخصيص هوية الوكيل، اسم المتجر، سرعة الرد الطبيعية، شروط التحويل البشري، ونطاق العمل."
              : "Customize agent identity, company store name, natural delay, handoff triggers, and operating scope."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              {isAr ? "تم الحفظ بنجاح!" : "Saved successfully!"}
            </span>
          )}
          <button
            id="save-agent-settings-btn"
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition ${
              isDirty
                ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30 ring-2 ring-teal-400/40"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            } disabled:opacity-50`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isAr ? "حفظ كافة الإعدادات" : "Save All Settings"}</span>
          </button>
        </div>
      </div>

      {/* Success Notification Message */}
      {savedNotice && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 text-emerald-300 text-xs font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{savedNotice}</span>
          </div>
          <button
            onClick={() => setSavedNotice(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-500/40 rounded-xl flex items-center justify-between gap-3 text-rose-300 text-xs font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Agent Identity & Brand */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm relative">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-teal-400" />
              <span>{isAr ? "هوية الوكيل والشركة" : "Agent & Brand Identity"}</span>
            </h3>
            <button
              id="save-identity-card-btn"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isAr ? "حفظ الهوية" : "Save Identity"}</span>
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium flex items-center justify-between">
                <span>{isAr ? "اسم الوكيل الافتراضي (Agent Name):" : "Agent Name:"}</span>
                <span className="text-[10px] text-teal-400 font-normal">
                  {isAr ? "يستخدم في التعريف والردود" : "Used in greetings"}
                </span>
              </label>
              <input
                id="ai-agent-name-input"
                type="text"
                value={formData.agentName}
                onChange={(e) => updateField("agentName", e.target.value)}
                placeholder="سارة - مستشارة المبيعات"
                className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-3 py-2 text-white font-medium transition"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium flex items-center justify-between">
                <span>{isAr ? "اسم العلامة التجارية أو الشركة:" : "Company / Store Name:"}</span>
                <span className="text-[10px] text-teal-400 font-normal">
                  {isAr ? "الاسم الرسمي في المحادثات والكتالوج" : "Official store name"}
                </span>
              </label>
              <input
                id="ai-company-name-input"
                type="text"
                value={formData.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="متجرنا الرسمي"
                className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-3 py-2 text-white font-medium transition"
              />
            </div>

            {/* Live Identity Badge Preview */}
            <div className="p-3 bg-slate-950/60 border border-teal-500/20 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-teal-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAr ? "المعاينة الحية لتعريف الوكيل للعملاء:" : "Live Customer Intro Preview:"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formData.tone === "friendly"
                    ? isAr ? "نبرة ودودة" : "Friendly tone"
                    : formData.tone === "professional"
                    ? isAr ? "نبرة رسمية" : "Professional tone"
                    : formData.tone === "persuasive"
                    ? isAr ? "نبرة إقناعية" : "Persuasive tone"
                    : isAr ? "نبرة استشارية" : "Consultative tone"}
                </span>
              </div>
              <p className="text-xs text-slate-200 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 leading-relaxed font-sans">
                {isAr
                  ? `« أهلاً بحضرتك! أنا ${formData.agentName || "سارة"} من ${formData.companyName || "متجرنا الرسمي"}. يسعدني جداً مساعدتك اليوم 🌸 »`
                  : `"Hello! I am ${formData.agentName || "Sarah"} from ${formData.companyName || "our store"}. How can I assist you today?"`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">
                  {isAr ? "نبرة الصوت والأسلوب:" : "Tone of Voice:"}
                </label>
                <select
                  id="ai-tone-select"
                  value={formData.tone}
                  onChange={(e) => updateField("tone", e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 rounded-xl px-3 py-2 text-white"
                >
                  <option value="friendly">{isAr ? "ودود ولطيف (Friendly)" : "Friendly"}</option>
                  <option value="professional">{isAr ? "رسمي ومحترف (Professional)" : "Professional"}</option>
                  <option value="persuasive">{isAr ? "إقناعي ومحفز للشراء (Persuasive)" : "Persuasive"}</option>
                  <option value="consultative">{isAr ? "استشاري هادئ (Consultative)" : "Consultative"}</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">
                  {isAr ? "لغة المحادثة:" : "Language:"}
                </label>
                <select
                  id="ai-language-select"
                  value={formData.language}
                  onChange={(e) => updateField("language", e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 rounded-xl px-3 py-2 text-white"
                >
                  <option value="ar">{isAr ? "العربية (اللهجة البيضاء)" : "Arabic"}</option>
                  <option value="en">{isAr ? "الإنجليزية (English)" : "English"}</option>
                  <option value="auto">{isAr ? "تلقائي حسب لغة العميل" : "Auto-detect"}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                {isAr ? "نموذج الذكاء الاصطناعي (Gemini Model):" : "AI Model:"}
              </label>
              <select
                value={
                  formData.model && formData.model !== "gemini-flash-latest"
                    ? formData.model
                    : "gemini-3.8-flash"
                }
                onChange={(e) => updateField("model", e.target.value)}
                className="w-full bg-slate-850 border border-slate-700/60 rounded-xl px-3 py-2 text-teal-400 font-mono text-xs focus:outline-none focus:border-teal-500 transition"
              >
                <option value="gemini-3.8-flash">
                  gemini-3.8-flash {isAr ? "(النموذج القياسي الموصى به - أداء عالي وسرعة فائقة)" : "(Recommended Standard)"}
                </option>
                <option value="gemini-3.1-flash-lite">
                  gemini-3.1-flash-lite {isAr ? "(خفيف وفائق السرعة)" : "(Fast Lite)"}
                </option>
                <option value="gemini-flash-latest">
                  gemini-flash-latest {isAr ? "(أحدث إصدار تجريبي)" : "(Latest Preview)"}
                </option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {isAr
                  ? "نموذج gemini-3.8-flash يوفر أقصى استقرار وسرعة فائقة وفهماً متقناً للغة العربية واستخراج الطلبات بدقة بدون انقطاع."
                  : "gemini-3.8-flash provides highest stability, ultra fast responses, and accurate Arabic comprehension."}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Operating Mode & Natural Delay */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Clock className="w-4 h-4 text-teal-400" />
            <span>{isAr ? "نطاق الرد وسرعة المحادثة الطبيعية" : "Operating Scope & Natural Delay"}</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                {isAr ? "نطاق عمل الوكيل (Operating Mode):" : "Operating Mode:"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: "all",
                    label: isAr ? "جميع العملاء" : "All Customers",
                    desc: isAr ? "الرد التلقائي على أي محادثة واردة" : "Auto-reply to all incoming chats",
                  },
                  {
                    id: "new_leads_only",
                    label: isAr ? "العملاء الجدد فقط" : "New Leads Only",
                    desc: isAr ? "الرد على أول 6 رسائل فقط للترحيب" : "Reply only for first 6 turns",
                  },
                  {
                    id: "whitelist_only",
                    label: isAr ? "قائمة محددة فقط" : "Whitelist Only",
                    desc: isAr ? "الرد فقط على الأرقام المحددة للاختبار" : "Only reply to whitelisted numbers",
                  },
                  {
                    id: "off",
                    label: isAr ? "إيقاف مؤقت" : "Paused",
                    desc: isAr ? "عدم الرد التلقائي على أي عميل" : "Do not auto-reply to anyone",
                  },
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => updateField("operatingMode", m.id as AIAgentMode)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition ${
                      formData.operatingMode === m.id
                        ? "bg-teal-950/40 border-teal-500 text-white"
                        : "bg-slate-800/60 border-slate-700/70 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">{m.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Delay Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">
                  {isAr ? "مهلة التفكير والرد الطبيعي:" : "Natural Response Delay:"}
                </label>
                <span className="font-mono text-teal-400 font-bold">
                  {formData.responseDelaySeconds || 4} {isAr ? "ثوانٍ" : "seconds"}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={formData.responseDelaySeconds || 4}
                onChange={(e) => updateField("responseDelaySeconds", Number(e.target.value))}
                className="w-full accent-teal-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isAr
                  ? "تأخير واقعي يجعل العميل يشعر أنه يتحدث مع إنسان حقيقي يكتب الرد عبر واتساب."
                  : "Realistic delay so customer feels a natural human cadence while typing."}
              </p>
            </div>

            {/* WhatsApp Typing Presence Indicator */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="typing-indicator-check"
                checked={formData.typingIndicator}
                onChange={(e) => updateField("typingIndicator", e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="typing-indicator-check" className="text-slate-300 cursor-pointer">
                {isAr
                  ? 'إظهار مؤشر "جاري الكتابة..." (Typing...) في واتساب العميل أثناء التفكير'
                  : 'Send WhatsApp "typing..." presence indicator to customer'}
              </label>
            </div>

            {/* Auto CRM Sync */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="crm-sync-check"
                checked={formData.autoScoreLeads}
                onChange={(e) => updateField("autoScoreLeads", e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="crm-sync-check" className="text-slate-300 cursor-pointer">
                {isAr
                  ? "المزامنة وتصنيف العملاء تلقائياً في منظومة الـ CRM والليدز"
                  : "Automatically sync and score leads in CRM"}
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Human Handoff Triggers & Safeguards */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <UserCheck className="w-4 h-4 text-purple-400" />
            <span>{isAr ? "قواعد التحويل البشري الآمن (Human Handoff)" : "Safe Human Handoff Triggers"}</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                {isAr
                  ? "الكلمات المفتاحية لتحويل المحادثة لموظف فوراً (مفصولة بفاصلة):"
                  : "Handoff Keywords (comma separated):"}
              </label>
              <textarea
                rows={2}
                value={formData.humanHandoffKeywords.join(", ")}
                onChange={(e) =>
                  updateField(
                    "humanHandoffKeywords",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="موظف، بشري، خدمة العملاء، مدير، انسان، شكوى..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-handoff-angry-check"
                checked={formData.autoHandoffOnAngry}
                onChange={(e) => updateField("autoHandoffOnAngry", e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="auto-handoff-angry-check" className="text-slate-300 cursor-pointer">
                {isAr
                  ? "تحويل تلقائي لموظف بشري عند استشعار غضب أو شكوى العميل"
                  : "Auto handoff on angry sentiment or customer complaint"}
              </label>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                {isAr ? "رسالة التحويل البشري التي تصل للعميل:" : "Handoff Notice to Customer:"}
              </label>
              <textarea
                rows={2}
                value={formData.handoffMessage}
                onChange={(e) => updateField("handoffMessage", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Welcome Message & Custom Instructions */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            <span>{isAr ? "رسالة الترحيب والتعليمات الخاصة" : "Welcome Message & Custom Directives"}</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                {isAr ? "رسالة الترحيب الأولى:" : "Initial Welcome Greeting:"}
              </label>
              <textarea
                rows={2}
                value={formData.welcomeMessage}
                onChange={(e) => updateField("welcomeMessage", e.target.value)}
                placeholder="أهلاً بحضرتك! أنا سارة مستشارة المبيعات..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white leading-relaxed"
              />
              <span className="text-[10px] text-slate-500">
                {isAr ? "يمكنك استخدام {company} لإدراج اسم الشركة تلقائياً." : "Use {company} to interpolate store name."}
              </span>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                {isAr ? "تعليمات وتوجيهات خاصة للذكاء الاصطناعي (Custom Prompt):" : "Custom System Prompt Directives:"}
              </label>
              <textarea
                rows={3}
                value={formData.systemPromptCustom}
                onChange={(e) => updateField("systemPromptCustom", e.target.value)}
                placeholder={isAr ? "اكتب أي تعليمات إضافية بخصوص طريقة الحديث أو العروض..." : "Any custom guidelines for AI reasoning..."}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white leading-relaxed"
              />
            </div>

            {/* Blacklist Phones */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <span>{isAr ? "القائمة السوداء (أرقام مستثناة من الرد):" : "Blacklisted Phones (No AI response):"}</span>
              </label>
              <input
                type="text"
                value={formData.blacklistPhones.join(", ")}
                onChange={(e) =>
                  updateField(
                    "blacklistPhones",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="201012345678, 201198765432"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Anti-Ban Protection & Strict Real-Time Filter */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? "درع الحماية من الحظر وفلترة الرسائل الجديدة فقط" : "Anti-Ban Shield & Real-Time Filter"}</span>
          </h3>

          <div className="space-y-4 text-xs">
            {/* Anti-Ban Enable Switch */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anti-ban-safety-check"
                checked={formData.antiBanSafetyEnabled ?? true}
                onChange={(e) => updateField("antiBanSafetyEnabled", e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="anti-ban-safety-check" className="text-slate-300 font-medium cursor-pointer">
                {isAr
                  ? "تفعيل درع الحماية ضد الحظر التلقائي (Anti-Ban Protection Shield)"
                  : "Enable WhatsApp Anti-Ban Protection Shield"}
              </label>
            </div>

            {/* ONLY REPLY TO NEW MESSAGES TOGGLE (User Request 1) */}
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="only-reply-new-messages-check"
                  checked={formData.onlyReplyToNewMessages ?? true}
                  onChange={(e) => updateField("onlyReplyToNewMessages", e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 mt-0.5"
                />
                <div>
                  <label htmlFor="only-reply-new-messages-check" className="text-emerald-300 font-semibold cursor-pointer block">
                    {isAr
                      ? "الرد على الرسائل الجديدة فقط وتجاهل الرسائل القديمة نهائياً (Real-Time Only)"
                      : "Strict Real-Time Only: Drop historical messages completely"}
                  </label>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    {isAr
                      ? "يمنع الذكاء الاصطناعي من الرد بأثر رجعي على المحادثات القديمة أو رسائل المزامنة السابقة عند تشغيل السيرفر أو إعادة ربط واتساب. يتم الرد فقط وبشكل فوري على الرسائل الحية الواردة الآن."
                      : "Completely ignores historical messages or background sync. Only replies to incoming real-time messages."}
                  </p>
                </div>
              </div>

              {/* Max Message Age Slider */}
              <div className="pt-2 border-t border-emerald-800/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 text-[11px] font-medium">
                    {isAr ? "أقصى وقت مسموح لعمر الرسالة الواردة:" : "Max Message Age Allowed:"}
                  </span>
                  <span className="font-mono text-emerald-400 font-bold text-xs">
                    {formData.maxMessageAgeSeconds || 45} {isAr ? "ثانية" : "seconds"}
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={formData.maxMessageAgeSeconds || 45}
                  onChange={(e) => updateField("maxMessageAgeSeconds", Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isAr
                    ? "الرسائل الأقدم من هذه المدة يتم إسقاطها فوراً دون رد لحماية الرقم من التراكم."
                    : "Messages older than this threshold are instantly dropped to protect the account."}
                </p>
              </div>
            </div>

            {/* Max Replies Per Minute */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">
                  {isAr ? "الحد الأقصى للردود في الدقيقة الواحدة:" : "Max Replies Per Minute:"}
                </label>
                <span className="font-mono text-emerald-400 font-bold">
                  {formData.maxRepliesPerMinute || 3} {isAr ? "رسائل / دقيقة" : "replies/min"}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={formData.maxRepliesPerMinute || 3}
                onChange={(e) => updateField("maxRepliesPerMinute", Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isAr
                  ? "موصى به: 2-3 رسائل في الدقيقة لتجنب خوارزميات مكافحة السبام التابعة لشركة واتساب."
                  : "Recommended: 2-3 replies per minute to stay completely below WhatsApp spam detection algorithms."}
              </p>
            </div>

            {/* Min Interval Between Messages */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">
                  {isAr ? "الفاصل الزمني البشري بين كل رد وآخر:" : "Inter-Message Human Interval:"}
                </label>
                <span className="font-mono text-emerald-400 font-bold">
                  {formData.minReplyIntervalSeconds || 4} {isAr ? "ثوانٍ" : "seconds"}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                step="1"
                value={formData.minReplyIntervalSeconds || 4}
                onChange={(e) => updateField("minReplyIntervalSeconds", Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isAr
                  ? "يضمن فاصلاً زمنياً بين الرسائل المتتابعة لمحاكاة وتيرة المستخدم البشري ومنع الإرسال الدفعي المتزامن."
                  : "Ensures human-like breathing intervals between outgoing messages, preventing burst flags."}
              </p>
            </div>
          </div>
        </div>

        {/* Section 6: Guided Interactive Options & Customer Choice Flow (User Request 2) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <ListOrdered className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? "نظام الخيارات التفاعلية الموجهة للعميل (بدل الأسئلة المفتوحة)" : "Guided Options Menu System"}</span>
          </h3>

          <div className="space-y-4 text-xs">
            {/* Interactive Options Master Switch */}
            <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="enable-interactive-options-check"
                  checked={formData.enableInteractiveOptions ?? true}
                  onChange={(e) => updateField("enableInteractiveOptions", e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 mt-0.5"
                />
                <div>
                  <label htmlFor="enable-interactive-options-check" className="text-cyan-300 font-semibold cursor-pointer block">
                    {isAr
                      ? "عرض خيارات محددة ومرقمة للعميل تلقائياً لمنع التشتت وعدم المطابقة"
                      : "Present structured numbered options (1-4) to prevent mismatched answers"}
                  </label>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    {isAr
                      ? "بدل أن يظل الذكاء الاصطناعي يسأل العميل أسئلة مفتوحة محيرة تؤدي لإجابات غير مطابقة أو عدم الرد، يعرض النظام قائمة خيارات واضحة وسريعة ويرد فوراً وبدقة على اختيار العميل."
                      : "Provides direct numbered choices (1: Products, 2: Shipping/Payment, 3: Order, 4: Support) for fast grounded replies."}
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Preview of the Interactive Options Menu */}
            <div className="space-y-2">
              <label className="text-slate-300 block font-medium">
                {isAr ? "شكل القائمة التفاعلية التي تظهر في واتساب العميل:" : "Preview of WhatsApp Options Menu:"}
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-slate-200">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs border-b border-slate-800/80 pb-1.5">
                  <span>💡</span>
                  <span>{isAr ? "خيارات الرد السريع للعميل:" : "Customer Quick Options:"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                    <span className="font-bold text-cyan-400">1️⃣</span>
                    <span>{isAr ? "المنتجات والأسعار المتاحة" : "Products & Prices"}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                    <span className="font-bold text-cyan-400">2️⃣</span>
                    <span>{isAr ? "تفاصيل الشحن والدفع والضمان" : "Shipping & Policies"}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                    <span className="font-bold text-cyan-400">3️⃣</span>
                    <span>{isAr ? "طلب أوردر جديد فوراً" : "Place an Order"}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                    <span className="font-bold text-cyan-400">4️⃣</span>
                    <span>{isAr ? "التحدث مع موظف بشري" : "Customer Support Agent"}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 pt-1">
                  {isAr
                    ? "✨ إذا أرسل العميل رقم 1 أو 2 أو 3 أو 4، أو كتب كلمتها، يتم الرد عليه فوراً بمعلومات موثقة 100% من الكتالوج دون أي تردد أو تشتت."
                    : "When customer sends 1, 2, 3, or 4, a grounded response is returned instantly."}
                </p>
              </div>
            </div>

            {/* Custom Options Menu Prompt Text */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                {isAr ? "مقدمة نص القائمة التفاعلية (اختياري للتخصيص):" : "Custom Menu Intro Prompt (Optional):"}
              </label>
              <textarea
                rows={2}
                value={formData.optionsMenuPrompt || ""}
                onChange={(e) => updateField("optionsMenuPrompt", e.target.value)}
                placeholder={
                  isAr
                    ? "أهلاً بحضرتك! لتسهيل خدمتك وتوفير وقتك، يمكنك الرد برقم الخدمة المطلوبة أو إرسال طلبك:"
                    : "Welcome! To assist you quickly, you can reply with the service number:"
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white leading-relaxed font-sans"
              />
              <span className="text-[10px] text-slate-500">
                {isAr
                  ? "اتركه فارغاً للاعتماد على الصيغة القياسية الجذابة التلقائية."
                  : "Leave blank to use the standard default greeting."}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Save Bar when Dirty */}
      {isDirty && (
        <div className="sticky bottom-4 z-30 bg-slate-900/95 border border-teal-500/60 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-teal-400 animate-pulse shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">
                {isAr
                  ? "تنبيه: توجد تعديلات غير محفوظة في هوية الوكيل أو الإعدادات"
                  : "Unsaved changes in agent identity or settings"}
              </p>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? `اسم الوكيل الحالي: "${formData.agentName}" | اسم الشركة: "${formData.companyName}"`
                  : `Current: "${formData.agentName}" | Store: "${formData.companyName}"`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                setFormData(settings);
                setIsDirty(false);
              }}
              disabled={saving}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              {isAr ? "إلغاء التعديلات" : "Discard"}
            </button>
            <button
              id="save-settings-bottom-btn"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-500/25 transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isAr ? "حفظ كافة التغييرات الآن" : "Save All Changes Now"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
