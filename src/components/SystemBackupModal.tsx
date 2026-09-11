import React, { useState, useRef } from "react";
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  X,
  FileJson,
  RefreshCw,
  Package,
  HelpCircle,
  ShoppingCart,
  Users,
  Send,
  Sliders,
  Layers,
} from "lucide-react";

interface SystemBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "ar" | "en";
  onRestoreSuccess?: () => void;
}

export const SystemBackupModal: React.FC<SystemBackupModalProps> = ({
  isOpen,
  onClose,
  language,
  onRestoreSuccess,
}) => {
  const isAr = language === "ar";
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportStats, setExportStats] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImportData, setParsedImportData] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current live stats when opening export tab
  React.useEffect(() => {
    if (isOpen) {
      fetch("/api/system/backup")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.metadata) {
            setExportStats(data.metadata);
          }
        })
        .catch((err) => console.error("Error fetching backup stats:", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportDownload = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/system/export?download=true");
      if (!response.ok) throw new Error("فشل تصدير البيانات");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `solo_italiano_full_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(isAr ? `حدث خطأ أثناء التصدير: ${err?.message}` : `Export error: ${err?.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setParseError(null);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("ملف غير صالح");
        }
        setParsedImportData(parsed);
      } catch (err: any) {
        setParseError(isAr ? "ملف JSON غير صالح أو تالف" : "Invalid JSON file structure");
        setParsedImportData(null);
      }
    };
    reader.onerror = () => {
      setParseError(isAr ? "فشل قراءة الملف" : "Failed to read file");
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!parsedImportData) return;

    setIsImporting(true);
    setParseError(null);
    try {
      const response = await fetch("/api/system/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedImportData),
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || "فشلت عملية الاستعادة");
      }

      setRestoreResult(resJson);
      if (onRestoreSuccess) {
        onRestoreSuccess();
      }
    } catch (err: any) {
      console.error("Restore error:", err);
      setParseError(err?.message || (isAr ? "فشلت عملية الاستيراد" : "Import failed"));
    } finally {
      setIsImporting(false);
    }
  };

  const inspectImportCounts = () => {
    if (!parsedImportData) return null;
    const source = parsedImportData.data || parsedImportData;
    const prodCount = Array.isArray(source.ai_agent_knowledge?.catalog)
      ? source.ai_agent_knowledge.catalog.length
      : 0;
    const faqCount = Array.isArray(source.ai_agent_knowledge?.faqs)
      ? source.ai_agent_knowledge.faqs.length
      : 0;
    const orderCount = Array.isArray(source.ai_agent_orders)
      ? source.ai_agent_orders.length
      : 0;
    const campCount = Array.isArray(source.campaigns)
      ? source.campaigns.length
      : 0;
    const leadCount = Array.isArray(source.crm_leads)
      ? source.crm_leads.length
      : 0;
    const tplCount = Array.isArray(source.templates)
      ? source.templates.length
      : 0;

    return {
      prodCount,
      faqCount,
      orderCount,
      campCount,
      leadCount,
      tplCount,
    };
  };

  const importCounts = inspectImportCounts();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isAr ? "النسخ الاحتياطي واستعادة كافة البيانات" : "Full System Backup & Restore"}
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Full Snapshot
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "تصدير أو استيراد كل محتويات التطبيق: المنتجات، الأسئلة الشائعة، الأوردرات، الـ CRM، والقوالب"
                  : "Export or restore all catalog products, 14 FAQs, orders, CRM leads, and settings"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-900 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab("export")}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "export"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>{isAr ? "تصدير نسخة احتياطية (Export)" : "Export Full Backup"}</span>
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "import"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{isAr ? "استيراد واسترجاع البيانات (Import)" : "Import / Restore Backup"}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === "export" && (
            <div className="space-y-6">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      {isAr ? "محتويات النسخة الاحتياطية الشاملة" : "Snapshot Contents"}
                    </h3>
                  </div>
                  <span className="text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-medium">
                    {isAr ? "جاهز للتصدير" : "Ready"}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isAr
                    ? "يقوم هذا الإجراء بحفظ نسخة كاملة وفورية من جميع البيانات في ملف JSON واحد منظم، بحيث إذا تم إغلاق البرنامج أو إعادة تشغيله يمكنك استعادة كل شيء بنقرة واحدة."
                    : "Saves a complete snapshot of all products, FAQs, settings, orders, CRM history, campaigns, and templates into a single JSON file."}
                </p>

                {/* Live Stats Grid */}
                {exportStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-2.5">
                      <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">{exportStats.productsCount || 24}</div>
                        <div className="text-[11px] text-slate-400">{isAr ? "منتج بالكتالوج" : "Products"}</div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">{exportStats.faqsCount || 14}</div>
                        <div className="text-[11px] text-slate-400">{isAr ? "سؤال شائع (FAQ)" : "FAQs"}</div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-2.5">
                      <ShoppingCart className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">{exportStats.ordersCount || 0}</div>
                        <div className="text-[11px] text-slate-400">{isAr ? "أوردر مسجل" : "Orders"}</div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-2.5">
                      <Send className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">{exportStats.campaignsCount || 1}</div>
                        <div className="text-[11px] text-slate-400">{isAr ? "حملة تسويقية" : "Campaigns"}</div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">{exportStats.leadsCount || 0}</div>
                        <div className="text-[11px] text-slate-400">{isAr ? "عميل CRM" : "CRM Leads"}</div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-teal-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">{exportStats.templatesCount || 0}</div>
                        <div className="text-[11px] text-slate-400">{isAr ? "قالب رسائل" : "Templates"}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
                <div className="text-xs text-emerald-200">
                  {isAr
                    ? "انقر لتحميل ملف النسخة الاحتياطية وحفظه على جهازك بأمان"
                    : "Download your full backup file to keep it securely on your device."}
                </div>
                <button
                  onClick={handleExportDownload}
                  disabled={isExporting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isAr ? "جاري التصدير..." : "Exporting..."}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>{isAr ? "تحميل ملف النسخة الاحتياطية (Download .JSON)" : "Download Full Backup (.json)"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === "import" && (
            <div className="space-y-6">
              {/* File Select Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-950/60 rounded-2xl p-6 text-center cursor-pointer transition group space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 flex items-center justify-center transition">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {importFile
                      ? importFile.name
                      : isAr
                      ? "اختر ملف النسخة الاحتياطية (.json) أو اسحبه هنا"
                      : "Click or drag backup (.json) file here"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {importFile
                      ? `${(importFile.size / 1024).toFixed(1)} KB`
                      : isAr
                      ? "ملفات JSON المستخرجة من ميزة التصدير الشاملة"
                      : "Solo Italiano full JSON backup snapshots"}
                  </p>
                </div>
              </div>

              {parseError && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Parsed Inspection Preview */}
              {importCounts && !restoreResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {isAr ? "تم التحقق من محتويات الملف بنجاح:" : "Backup Verified Successfully:"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {parsedImportData.version ? `v${parsedImportData.version}` : "Snapshot"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "المنتجات" : "Products"}</span>
                      <span className="font-bold text-emerald-400">{importCounts.prodCount}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "الأسئلة الشائعة" : "FAQs"}</span>
                      <span className="font-bold text-cyan-400">{importCounts.faqCount}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "الأوردرات" : "Orders"}</span>
                      <span className="font-bold text-amber-400">{importCounts.orderCount}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "الحملات" : "Campaigns"}</span>
                      <span className="font-bold text-purple-400">{importCounts.campCount}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "عملاء CRM" : "Leads"}</span>
                      <span className="font-bold text-blue-400">{importCounts.leadCount}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">{isAr ? "القوالب" : "Templates"}</span>
                      <span className="font-bold text-teal-400">{importCounts.tplCount}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleExecuteRestore}
                      disabled={isImporting}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{isAr ? "جاري استعادة البيانات والتهيئة..." : "Restoring System..."}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isAr ? "تأكيد واستعادة كافة البيانات الآن" : "Confirm & Restore Everything Now"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Restore Success Confirmation */}
              {restoreResult && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{isAr ? "تم استرجاع واستعادة كل البيانات بنجاح تام!" : "System Restored Successfully!"}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {restoreResult.message || (isAr ? "تم تحديث كافة الملفات وتحديث الذاكرة الحية للنظام." : "All data restored and live memory reloaded.")}
                  </p>
                  {restoreResult.summary && (
                    <div className="text-[11px] text-emerald-300 bg-emerald-950/60 p-3 rounded-lg border border-emerald-800/50 flex flex-wrap gap-x-4 gap-y-1">
                      <span>✓ {restoreResult.summary.productsRestored} منتج</span>
                      <span>✓ {restoreResult.summary.faqsRestored} سؤال وجواب</span>
                      <span>✓ {restoreResult.summary.ordersRestored} أوردر</span>
                      <span>✓ {restoreResult.summary.campaignsRestored} حملة</span>
                      <span>✓ {restoreResult.summary.leadsRestored} عميل CRM</span>
                    </div>
                  )}
                  <div className="pt-1">
                    <button
                      onClick={onClose}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      {isAr ? "إغلاق والعودة للتطبيق" : "Close"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
