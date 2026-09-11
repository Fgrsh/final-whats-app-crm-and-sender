import React, { useState, useRef } from "react";
import {
  Sparkles,
  Wand2,
  Eye,
  RefreshCw,
  Check,
  Copy,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  Clock,
  ShieldCheck,
  Info,
  Bookmark,
  Save,
  Trash2,
  Plus,
  CheckCircle2,
  Layers,
} from "lucide-react";
import type { CampaignConfig, Contact, CampaignAttachment, MessageTemplate } from "../types.ts";

interface ComposerTabProps {
  config: CampaignConfig;
  onChangeConfig: (newConfig: Partial<CampaignConfig>) => void;
  sampleContact?: Contact;
  onPreviewAI: () => Promise<string>;
  onGenerateAITemplate: (purpose: string) => Promise<string>;
  templates?: MessageTemplate[];
  onSaveTemplate?: (name: string, isNew?: boolean, templateId?: string) => Promise<void>;
  onDeleteTemplate?: (id: string) => Promise<void>;
  onSelectTemplate?: (template: MessageTemplate) => void;
  language: "ar" | "en";
}

export const ComposerTab: React.FC<ComposerTabProps> = ({
  config,
  onChangeConfig,
  sampleContact,
  onPreviewAI,
  onGenerateAITemplate,
  templates = [],
  onSaveTemplate,
  onDeleteTemplate,
  onSelectTemplate,
  language,
}) => {
  const isAr = language === "ar";
  const [isPreviewingAI, setIsPreviewingAI] = useState(false);
  const [aiPreviewResult, setAiPreviewResult] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templatePurpose, setTemplatePurpose] = useState("");
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template Library States
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const variables = [
    { tag: "{name}", label: isAr ? "الاسم" : "Name" },
    { tag: "{company}", label: isAr ? "الشركة" : "Company" },
    { tag: "{notes}", label: isAr ? "ملاحظات / تفاصيل" : "Notes" },
    { tag: "{phone}", label: isAr ? "رقم الهاتف" : "Phone" },
  ];

  const handleInsertTag = (tag: string) => {
    onChangeConfig({ template: config.template + " " + tag });
  };

  const handleTestAI = async () => {
    setIsPreviewingAI(true);
    try {
      const res = await onPreviewAI();
      setAiPreviewResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPreviewingAI(false);
    }
  };

  const handleGenerateTemplate = async () => {
    if (!templatePurpose.trim()) return;
    setIsGeneratingTemplate(true);
    try {
      const generated = await onGenerateAITemplate(templatePurpose);
      if (generated) {
        onChangeConfig({ template: generated });
        setShowTemplateModal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const copyToClipboard = (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch (e) {
      // safe fallback if clipboard is restricted in iframe
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImg && !isPdf) {
      setFileError(isAr ? "يرجى اختيار صورة (JPG/PNG) أو ملف PDF فقط" : "Please select an Image or PDF file only.");
      setTimeout(() => setFileError(null), 4000);
      return;
    }
    setFileError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const attachment: CampaignAttachment = {
        type: isImg ? "image" : "document",
        fileName: file.name,
        mimetype: file.type || (isImg ? "image/jpeg" : "application/pdf"),
        dataBase64: base64,
        size: file.size,
      };
      onChangeConfig({ attachment });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    onChangeConfig({ attachment: null });
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Interpolate basic preview for immediate visualization
  let simpleInterpolated = config.template
    .replace(/\{name\}/gi, sampleContact?.name || (isAr ? "أحمد محمد" : "John Doe"))
    .replace(/\{company\}/gi, sampleContact?.company || (isAr ? "شركة الأمل" : "Acme Corp"))
    .replace(/\{notes\}/gi, sampleContact?.notes || (isAr ? "تأكيد موعد استشارتك غداً" : "Appointment confirmation"))
    .replace(/\{phone\}/gi, sampleContact?.phone || "201012345678");

  if (config.appendTimestampAndCode) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const code = "A9X7Q";
    simpleInterpolated += isAr
      ? `\n\n────────────────\n🕒 ${dateStr} ${timeStr} • كود التحقق: #${code}`
      : `\n\n────────────────\n🕒 ${dateStr} ${timeStr} • Ref: #${code}`;
  }

  const handleSaveTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateNameInput.trim() || !onSaveTemplate) return;
    try {
      setIsSavingTemplate(true);
      await onSaveTemplate(templateNameInput.trim(), true);
      setSaveSuccessNotice(
        isAr ? `تم حفظ القالب "${templateNameInput.trim()}" بنجاح!` : `Template "${templateNameInput.trim()}" saved!`
      );
      setIsSaveModalOpen(false);
      setTemplateNameInput("");
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err) {
      console.error("Error saving template:", err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleUpdateCurrentTemplate = async () => {
    if (!config.templateId || !config.templateName || !onSaveTemplate) return;
    try {
      setIsSavingTemplate(true);
      await onSaveTemplate(config.templateName, false, config.templateId);
      setSaveSuccessNotice(
        isAr ? `تم تحديث القالب "${config.templateName}" بنجاح!` : `Template updated successfully!`
      );
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err) {
      console.error("Error updating template:", err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Main: Template & Attachments & Anti-Spam Options */}
        <div className="lg:col-span-7 space-y-5">
          {/* Saved Templates & Media Library Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{isAr ? "مكتبة القوالب والمرفقات المحفوظة" : "Saved Templates & Media Library"}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {templates.length} {isAr ? "قوالب مسجلة" : "templates"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? "اختر قالباً جاهزاً مع مرفقه، أو احفظ القالب الحالي والمرفق باسم لاستخدامه في الحملات"
                      : "Select a saved template with its media, or save current one for campaigns"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Save as New Template Button */}
                <button
                  type="button"
                  onClick={() => {
                    setTemplateNameInput(config.templateName ? `${config.templateName} (نسخة)` : "");
                    setIsSaveModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/30 transition cursor-pointer"
                  title={isAr ? "حفظ القالب والمرفق الحالي كقالب جديد" : "Save as new template"}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isAr ? "حفظ كقالب جديد" : "Save as New"}</span>
                </button>

                {/* Update Current Template Button (if loaded) */}
                {config.templateId && (
                  <button
                    type="button"
                    onClick={handleUpdateCurrentTemplate}
                    disabled={isSavingTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
                    title={isAr ? "تحديث القالب الحالي بالتعديلات والمرفق" : "Update current template"}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSavingTemplate ? "animate-spin" : ""}`} />
                    <span>{isAr ? "تحديث القالب" : "Update"}</span>
                  </button>
                )}

                {/* Clear / New Blank Template Button */}
                <button
                  type="button"
                  onClick={() => {
                    onChangeConfig({
                      template: "",
                      templateId: undefined,
                      templateName: undefined,
                      attachment: null,
                    });
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs transition cursor-pointer"
                  title={isAr ? "بدء قالب فارغ جديد" : "Start blank"}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notification Toast */}
            {saveSuccessNotice && (
              <div className="bg-emerald-950/80 border border-emerald-500/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccessNotice}</span>
              </div>
            )}

            {/* Template Selector Dropdown & Quick Badges */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <span className="text-slate-400 shrink-0">{isAr ? "تحميل قالب محفوظ:" : "Load template:"}</span>
                <select
                  value={config.templateId || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (!selectedId) {
                      onChangeConfig({ templateId: undefined, templateName: undefined });
                      return;
                    }
                    const tpl = templates.find((t) => t.id === selectedId);
                    if (tpl) {
                      if (onSelectTemplate) {
                        onSelectTemplate(tpl);
                      } else {
                        onChangeConfig({
                          template: tpl.template,
                          templateId: tpl.id,
                          templateName: tpl.name,
                          attachment: tpl.attachment || null,
                          aiInstruction: tpl.aiInstruction || config.aiInstruction,
                          aiTone: tpl.aiTone || config.aiTone,
                        });
                      }
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">{isAr ? "-- اختر قالباً من المكتبة --" : "-- Select a template --"}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.attachment ? (t.attachment.type === "image" ? "📎 [صورة]" : "📄 [PDF]") : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Active Template Badge & Delete Button */}
              {config.templateId && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-slate-800 px-2 py-1 rounded-lg text-emerald-300 font-semibold border border-slate-700 flex items-center gap-1.5">
                    <Bookmark className="w-3 h-3 text-emerald-400" />
                    <span>{config.templateName || (isAr ? "قالب محدد" : "Active Template")}</span>
                    {config.attachment && (
                      <span className="text-purple-300 text-[10px]">
                        {config.attachment.type === "image" ? "📎 صورة" : "📄 PDF"}
                      </span>
                    )}
                  </span>

                  {deleteConfirmId === config.templateId ? (
                    <div className="flex items-center gap-1 bg-red-950/80 px-2 py-0.5 rounded-lg border border-red-500/40 text-[11px]">
                      <span className="text-red-300 text-[10px]">{isAr ? "حذف؟" : "Delete?"}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (onDeleteTemplate && config.templateId) {
                            await onDeleteTemplate(config.templateId);
                            onChangeConfig({ templateId: undefined, templateName: undefined });
                          }
                          setDeleteConfirmId(null);
                        }}
                        className="text-red-300 hover:text-white font-bold px-1"
                      >
                        {isAr ? "نعم" : "Yes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-slate-400 hover:text-slate-200 px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(config.templateId || null)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                      title={isAr ? "حذف هذا القالب من المكتبة" : "Delete template"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main Message Template */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isAr ? "قالب الرسالة الأساسي" : "Base Message Template"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? "اكتب نص الرسالة واستخدم المتغيرات التلقائية لتخصيص كل رسالة"
                    : "Write message template and drop in variable placeholders"}
                </p>
              </div>

              {/* AI Suggest Template Button */}
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{isAr ? "اكتب لي قالباً بالذكاء الاصطناعي" : "AI Template Assistant"}</span>
              </button>
            </div>

            {/* Variable Tags Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-400 font-medium">
                {isAr ? "إدراج متغير:" : "Insert variable:"}
              </span>
              {variables.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertTag(v.tag)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 text-emerald-400 hover:bg-emerald-950/60 hover:border-emerald-500/40 border border-slate-700 transition"
                >
                  {v.tag} <span className="text-[10px] text-slate-400 font-sans">({v.label})</span>
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div>
              <textarea
                rows={6}
                value={config.template}
                onChange={(e) => onChangeConfig({ template: e.target.value })}
                placeholder={
                  isAr
                    ? "مرحباً {name}، نأمل أن تكون بخير! بخصوص {notes}، يسعدنا التواصل معك من {company}."
                    : "Hello {name}, hope you're doing well! Regarding {notes} from {company}..."
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
              />
              <div className="flex justify-between text-[11px] text-slate-500 px-1 mt-1">
                <span>{isAr ? "يدعم تنسيق واتساب (*عريض*، _مائل_)" : "Supports WhatsApp styling (*bold*, _italic_)"}</span>
                <span>{config.template.length} {isAr ? "حرف" : "chars"}</span>
              </div>
            </div>
          </div>

          {/* Media Attachment Card (Image or PDF) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {isAr ? "إرفاق ملف مع الرسالة (صورة أو PDF)" : "Attach Media (Image or PDF)"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? "إرسال صورة ترويجية أو بروشور / كتالوج PDF مع الرسالة تلقائياً"
                      : "Automatically send promotional photos or PDF documents with each message"}
                  </p>
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelected}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
              />

              {!config.attachment ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white rounded-xl text-xs font-semibold border border-purple-500/30 transition flex items-center gap-1.5"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{isAr ? "اختيار صورة أو PDF" : "Attach File"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-xl text-xs font-semibold border border-red-500/30 transition flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isAr ? "إزالة المرفق" : "Remove"}</span>
                </button>
              )}
            </div>

            {fileError && (
              <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-red-400 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {config.attachment && (
              <div className="p-3.5 bg-slate-950 border border-purple-500/30 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {config.attachment.type === "image" ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 shrink-0 bg-slate-900">
                      <img
                        src={config.attachment.dataBase64}
                        alt="attachment"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-white truncate">{config.attachment.fileName}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {config.attachment.type === "image" ? (isAr ? "صورة مرافقة" : "Attached Image") : "PDF Document"}
                      {config.attachment.size
                        ? ` • ${(config.attachment.size / 1024).toFixed(1)} KB`
                        : ""}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                  {isAr ? "جاهز للإرسال" : "Ready"}
                </span>
              </div>
            )}
          </div>

          {/* Dynamic Unique Timestamp & Verification Code Anti-Duplication Feature */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {isAr ? "إضافة توقيت وكود فريد متغير لكل رسالة" : "Dynamic Timestamp & Unique Ref Code"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? "يضع في ذيل كل رسالة التاريخ والوقت بالثانية وكوداً مشفراً لمنع حظر الرسائل المكررة"
                      : "Appends unique date, second-exact timestamp and ref code to prevent identical hash flags"}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
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

            {config.appendTimestampAndCode && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-400/90 leading-relaxed flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isAr
                    ? "نموذج الذيل: 🕒 2026-09-07 14:45:10 • كود التحقق: #A8F2K (يتغير مع كل عميل)"
                    : "Footer Sample: 🕒 2026-09-07 14:45:10 • Ref: #A8F2K (unique per recipient)"}
                </span>
              </div>
            )}
          </div>

          {/* Gemini AI Personalization Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {isAr ? "إعادة الصياغة بالذكاء الاصطناعي (Gemini Anti-Spam)" : "AI Smart Variation (Anti-Spam)"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? "تنويع الجمل والكلمات لكل عميل لتفادي خوارزميات رصد الرسائل المكررة"
                      : "Dynamically rewords each message to avoid identical spam pattern bans"}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useAI}
                  onChange={(e) => onChangeConfig({ useAI: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {config.useAI && (
              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                {/* Tone Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    {isAr ? "نبرة وأسلوب الرسالة:" : "Tone of voice:"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { key: "friendly", label: isAr ? "ودود وعفوي" : "Friendly" },
                      { key: "professional", label: isAr ? "رسمي واحترافي" : "Professional" },
                      { key: "sales", label: isAr ? "تسويقي ومقنع" : "Sales Offer" },
                      { key: "reminder", label: isAr ? "تذكير مهذب" : "Reminder" },
                      { key: "casual", label: isAr ? "مختصر وسريع" : "Quick Note" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => onChangeConfig({ aiTone: t.key as any })}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold text-center transition border ${
                          config.aiTone === t.key
                            ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Instruction */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {isAr ? "توجيهات إضافية للذكاء الاصطناعي (اختياري):" : "Custom instructions for Gemini (optional):"}
                  </label>
                  <input
                    type="text"
                    value={config.aiInstruction}
                    onChange={(e) => onChangeConfig({ aiInstruction: e.target.value })}
                    placeholder={
                      isAr
                        ? "مثال: تحدث بلهجة مصرية محبوبة، أضف إيموجي ورود، اجعل الرسالة دافئة وموجزة"
                        : "e.g. Keep it punchy, add friendly emojis, emphasize 24-hour urgency"
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Preview Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                {isAr ? "معاينة الرسالة المباشرة" : "Live Message Preview"}
              </h4>
              <button
                onClick={handleTestAI}
                disabled={isPreviewingAI}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPreviewingAI ? "animate-spin" : ""}`} />
                <span>{isAr ? "توليد تجربة بالذكاء الاصطناعي" : "Generate AI Test"}</span>
              </button>
            </div>

            {/* WhatsApp Chat Bubble Simulation */}
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[300px] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="space-y-3">
                {/* Simulated message sender header */}
                <div className="text-[11px] text-slate-500 border-b border-slate-800/80 pb-2 flex items-center justify-between">
                  <span>
                    {isAr ? "المستلم التجريبي:" : "Sample recipient:"}{" "}
                    <strong className="text-slate-300">
                      {sampleContact?.name || (isAr ? "أحمد حسام" : "John Doe")} (+
                      {sampleContact?.phone || "201012345678"})
                    </strong>
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    {aiPreviewResult ? "Gemini AI" : isAr ? "القالب الأساسي" : "Base Template"}
                  </span>
                </div>

                {/* The Chat Bubble */}
                <div className="max-w-[94%] bg-emerald-900/40 border border-emerald-500/30 rounded-2xl rounded-tr-sm p-3.5 text-emerald-50 text-xs shadow-lg space-y-2.5 leading-relaxed">
                  {/* Attachment Preview inside bubble */}
                  {config.attachment && (
                    <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-black/40">
                      {config.attachment.type === "image" ? (
                        <img
                          src={config.attachment.dataBase64}
                          alt="preview attachment"
                          className="w-full max-h-48 object-cover"
                        />
                      ) : (
                        <div className="p-3 flex items-center gap-2.5 bg-slate-900/90 text-white">
                          <FileText className="w-5 h-5 text-red-400 shrink-0" />
                          <div className="overflow-hidden">
                            <p className="font-semibold text-xs truncate">{config.attachment.fileName}</p>
                            <p className="text-[10px] text-slate-400">PDF Document</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap font-sans">
                    {aiPreviewResult || simpleInterpolated || (
                      <span className="text-slate-500 italic">
                        {isAr ? "اكتب نصاً في القالب لرؤية المعاينة هنا..." : "Type in template to preview here..."}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-400/80 font-mono">
                    <span>10:45 AM</span>
                    <span>✓✓</span>
                  </div>
                </div>
              </div>

              {/* Copy / Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">
                  {aiPreviewResult
                    ? isAr
                      ? "هذا نموذج مصاغ بذكاء بواسطة Gemini"
                      : "Tailored by Gemini 3.8 Flash"
                    : isAr
                    ? "معاينة استبدال المتغيرات والتوقيت"
                    : "Standard substitution & time preview"}
                </span>
                <button
                  onClick={() => copyToClipboard(aiPreviewResult || simpleInterpolated)}
                  className="flex items-center gap-1 text-slate-300 hover:text-white transition px-2 py-1 bg-slate-800 rounded-lg text-[11px]"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? (isAr ? "تم النسخ" : "Copied") : isAr ? "نسخ" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Template Prompt Generator Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? "توليد قالب رسالة بالذكاء الاصطناعي" : "Generate Campaign Template"}</span>
            </div>
            <p className="text-xs text-slate-400">
              {isAr
                ? "صف هدف حملتك وسيقوم نموذج Gemini بكتابة رسالة تسويقية احترافية تتضمن المتغيرات المناسبة."
                : "Describe your campaign goal and Gemini will write an engaging template."}
            </p>

            <textarea
              rows={3}
              value={templatePurpose}
              onChange={(e) => setTemplatePurpose(e.target.value)}
              placeholder={
                isAr
                  ? "مثال: عروض بمناسبة عيد الفطر لمتجر ملابس بخصم 25% مع رابط للموقع"
                  : "e.g. End of month flash sale reminder with 20% coupon"
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleGenerateTemplate}
                disabled={isGeneratingTemplate || !templatePurpose.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow transition"
              >
                {isGeneratingTemplate && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isAr ? "توليد واعتماد القالب" : "Generate & Apply"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Save Template with Name */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? "حفظ القالب والمرفق باسم في المكتبة" : "Save Template to Library"}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isAr ? "اسم القالب المحفوظ:" : "Template Name:"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    isAr
                      ? "مثال: عرض خصم 30% مع بروشور المعرض"
                      : "e.g. Summer Discount Offer with PDF"
                  }
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              {/* Attachment summary indicator */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <Paperclip className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isAr ? "المرفق المصاحب:" : "Attached Media:"}</span>
                  {config.attachment ? (
                    <span className="text-purple-300 font-semibold truncate">
                      {config.attachment.fileName} (
                      {config.attachment.type === "image" ? (isAr ? "صورة" : "Image") : "PDF"})
                    </span>
                  ) : (
                    <span className="text-slate-500">{isAr ? "بدون مرفق (نص فقط)" : "No media (text only)"}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {isAr ? "طول النص:" : "Text length:"} {config.template.length} {isAr ? "حرف" : "chars"}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={!templateNameInput.trim() || isSavingTemplate}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {isSavingTemplate
                      ? isAr
                        ? "جاري الحفظ..."
                        : "Saving..."
                      : isAr
                      ? "حفظ القالب الآن"
                      : "Save Now"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
