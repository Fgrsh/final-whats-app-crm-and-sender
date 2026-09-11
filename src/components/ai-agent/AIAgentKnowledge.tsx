import React, { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  HelpCircle,
  Clock,
  Shield,
  CreditCard,
  Truck,
  CheckCircle2,
  Save,
  Loader2,
  Info,
  Search,
  RotateCcw,
  AlertTriangle,
  Filter,
  Upload,
  FileUp,
  FileText,
  Check,
} from "lucide-react";
import type { AIKnowledgeBase, AIProduct, AIFaqItem } from "../../types.ts";

interface AIAgentKnowledgeProps {
  knowledge: AIKnowledgeBase;
  language: "ar" | "en";
  onSaveKnowledge: (updated: Partial<AIKnowledgeBase>) => Promise<void>;
}

export const AIAgentKnowledge: React.FC<AIAgentKnowledgeProps> = ({
  knowledge,
  language,
  onSaveKnowledge,
}) => {
  const isAr = language === "ar";
  const [activeSubTab, setActiveSubTab] = useState<"products" | "faqs" | "policies">("products");

  // Local state for saving
  const [kb, setKb] = useState<AIKnowledgeBase>(knowledge);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Search & Category filters for catalog
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // In-App Deletion Modal State (immune to iframe window.confirm restrictions)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: "product" | "faq" | "all_products" | "reset_solo";
    id?: string;
    name?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import / Replace from File State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedImportProducts, setParsedImportProducts] = useState<AIProduct[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Sync if prop updates only when not dirty
  React.useEffect(() => {
    if (!isDirty) {
      setKb(knowledge);
    }
  }, [knowledge, isDirty]);

  // Update helper that marks dirty
  const updateKbField = <K extends keyof AIKnowledgeBase>(
    key: K,
    val: AIKnowledgeBase[K]
  ) => {
    setIsDirty(true);
    setKb((prev) => ({ ...prev, [key]: val }));
  };

  // Product Add / Edit Modal
  const [editingProduct, setEditingProduct] = useState<AIProduct | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // FAQ Add / Edit Modal
  const [editingFaq, setEditingFaq] = useState<AIFaqItem | null>(null);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

  const handleSaveAll = async (overrideKb?: AIKnowledgeBase) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveKnowledge(overrideKb || kb);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Error saving knowledge base:", e);
    } finally {
      setSaving(false);
    }
  };

  // Product Handlers
  const handleOpenAddProduct = () => {
    setEditingProduct({
      id: `prod-${Date.now()}`,
      name: "",
      category: isAr ? "Mozzarella & Cheese" : "Mozzarella & Cheese",
      price: 0,
      currency: kb.currency || "EGP",
      description: "",
      features: [],
      inStock: true,
      sku: "",
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProductModal = () => {
    if (!editingProduct || !editingProduct.name.trim()) return;

    let updatedProducts = [...kb.products];
    const idx = updatedProducts.findIndex((p) => p.id === editingProduct.id);
    if (idx >= 0) {
      updatedProducts[idx] = editingProduct;
    } else {
      updatedProducts.push(editingProduct);
    }

    const updatedKb = { ...kb, products: updatedProducts };
    setKb(updatedKb);
    setIsProductModalOpen(false);
    handleSaveAll(updatedKb);
  };

  const handleDeleteProductPrompt = (prod: AIProduct) => {
    setDeleteConfirmTarget({
      type: "product",
      id: prod.id,
      name: prod.name,
    });
  };

  const handleClearAllProductsPrompt = () => {
    setDeleteConfirmTarget({
      type: "all_products",
    });
  };

  const handleResetSoloItalianoPrompt = () => {
    setDeleteConfirmTarget({
      type: "reset_solo",
    });
  };

  // FAQ Handlers
  const handleOpenAddFaq = () => {
    setEditingFaq({
      id: `faq-${Date.now()}`,
      question: "",
      answer: "",
      category: isAr ? "الطلبات والتوريد" : "Orders & Supply",
    });
    setIsFaqModalOpen(true);
  };

  const handleSaveFaqModal = () => {
    if (!editingFaq || !editingFaq.question.trim() || !editingFaq.answer.trim()) return;

    let updatedFaqs = [...kb.faqs];
    const idx = updatedFaqs.findIndex((f) => f.id === editingFaq.id);
    if (idx >= 0) {
      updatedFaqs[idx] = editingFaq;
    } else {
      updatedFaqs.push(editingFaq);
    }

    const updatedKb = { ...kb, faqs: updatedFaqs };
    setKb(updatedKb);
    setIsFaqModalOpen(false);
    handleSaveAll(updatedKb);
  };

  const handleDeleteFaqPrompt = (faq: AIFaqItem) => {
    setDeleteConfirmTarget({
      type: "faq",
      id: faq.id,
      name: faq.question,
    });
  };

  // Execute deletion confirmed by in-app modal
  const executeDeleteTarget = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeleting(true);

    try {
      if (deleteConfirmTarget.type === "product" && deleteConfirmTarget.id) {
        // Try server endpoint first, fallback to state sync
        try {
          const res = await fetch(`/api/ai-agent/knowledge/products/${encodeURIComponent(deleteConfirmTarget.id)}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success && data.knowledge) {
            setKb(data.knowledge);
            await onSaveKnowledge(data.knowledge);
            setIsDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            return;
          }
        } catch (_) {}

        // Fallback local state sync
        const updatedProducts = kb.products.filter((p) => p.id !== deleteConfirmTarget.id);
        const updatedKb = { ...kb, products: updatedProducts };
        setKb(updatedKb);
        await handleSaveAll(updatedKb);
      } else if (deleteConfirmTarget.type === "all_products") {
        try {
          const res = await fetch("/api/ai-agent/knowledge/products", { method: "DELETE" });
          const data = await res.json();
          if (data.success && data.knowledge) {
            setKb(data.knowledge);
            await onSaveKnowledge(data.knowledge);
            setIsDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            return;
          }
        } catch (_) {}

        const updatedKb = { ...kb, products: [] };
        setKb(updatedKb);
        await handleSaveAll(updatedKb);
      } else if (deleteConfirmTarget.type === "reset_solo") {
        try {
          const res = await fetch("/api/ai-agent/knowledge/reset-solo-italiano", {
            method: "POST",
          });
          const data = await res.json();
          if (data.success && data.knowledge) {
            setKb(data.knowledge);
            await onSaveKnowledge(data.knowledge);
            setIsDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            return;
          }
        } catch (_) {}
      } else if (deleteConfirmTarget.type === "faq" && deleteConfirmTarget.id) {
        const updatedFaqs = kb.faqs.filter((f) => f.id !== deleteConfirmTarget.id);
        const updatedKb = { ...kb, faqs: updatedFaqs };
        setKb(updatedKb);
        await handleSaveAll(updatedKb);
      }
    } finally {
      setIsDeleting(false);
      setDeleteConfirmTarget(null);
    }
  };

  // --- Catalog Import / File Upload Handlers ---
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || "";
        if (!text.trim()) throw new Error(isAr ? "الملف المرفق فارغ" : "Selected file is empty");

        let items: AIProduct[] = [];

        // Attempt 1: JSON
        if (file.name.endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{")) {
          const parsed = JSON.parse(text);
          let rawList: any[] = [];
          if (Array.isArray(parsed)) {
            rawList = parsed;
          } else if (Array.isArray(parsed.products)) {
            rawList = parsed.products;
          } else if (parsed.knowledge && Array.isArray(parsed.knowledge.products)) {
            rawList = parsed.knowledge.products;
          } else {
            throw new Error(isAr ? "لم يتم العثور على مصفوفة منتجات في ملف JSON" : "No products array found in JSON");
          }

          items = rawList.map((p, idx) => ({
            id: p.id || `imp-${Date.now()}-${idx}`,
            name: String(p.name || p.title || p["اسم المنتج"] || p["الصنف"] || `منتج ${idx + 1}`).trim(),
            category: String(p.category || p["الفئة"] || p["التصنيف"] || p["القسم"] || "عام").trim(),
            price: typeof p.price === "number" ? p.price : Number(p.price || p["السعر"] || p["price"]) || 0,
            currency: p.currency || kb.currency || "EGP",
            sku: String(p.sku || p.code || p["الكود"] || p["الرمز"] || "").trim(),
            inStock: p.inStock !== false && p["الحالة"] !== "غير متوفر",
            description: String(p.description || p["الوصف"] || p["المواصفات"] || "").trim(),
            features: Array.isArray(p.features)
              ? p.features
              : (p["المميزات"] ? String(p["المميزات"]).split(/[,،]/).map((s: string) => s.trim()) : []),
          }));
        } else {
          // Attempt 2: CSV or TSV
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            throw new Error(isAr ? "الملف يجب أن يحتوي على صف عناوين وبيانات للمنتجات" : "File must have headers and data rows");
          }

          const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
          const headers = lines[0].split(delimiter).map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

          const findIdx = (keywords: string[]) =>
            headers.findIndex((h) => keywords.some((k) => h.includes(k.toLowerCase())));

          const nameIdx = findIdx(["name", "اسم", "المنتج", "صنف", "item", "product"]);
          const priceIdx = findIdx(["price", "سعر", "السعر", "cost"]);
          const catIdx = findIdx(["category", "فئة", "فئه", "قسم", "تصنيف"]);
          const descIdx = findIdx(["description", "وصف", "تفاصيل", "مواصفات", "details"]);
          const skuIdx = findIdx(["sku", "code", "كود", "رمز"]);

          for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(delimiter).map((col) => col.replace(/^["']|["']$/g, "").trim());
            if (!row || row.length === 0) continue;

            const name = (nameIdx >= 0 ? row[nameIdx] : row[0]) || "";
            if (!name) continue;

            const price = priceIdx >= 0 ? parseFloat(row[priceIdx].replace(/[^\d.]/g, "")) || 0 : 0;
            const category = catIdx >= 0 && row[catIdx] ? row[catIdx] : "عام";
            const description = descIdx >= 0 && row[descIdx] ? row[descIdx] : "";
            const sku = skuIdx >= 0 && row[skuIdx] ? row[skuIdx] : "";

            items.push({
              id: `csv-${Date.now()}-${i}`,
              name,
              category,
              price,
              currency: kb.currency || "EGP",
              sku,
              inStock: true,
              description,
              features: [],
            });
          }
        }

        if (items.length === 0) {
          throw new Error(isAr ? "تعذر قراءة أو استخراج منتجات من الملف المرفوع" : "No products could be extracted");
        }

        setParsedImportProducts(items);
      } catch (err: any) {
        console.error("Import error:", err);
        setImportError(err?.message || (isAr ? "حدث خطأ أثناء قراءة الملف" : "Failed to parse file"));
      }
    };
    reader.readAsText(file);
  };

  const executeImportProducts = async () => {
    if (parsedImportProducts.length === 0) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const finalProducts =
        importMode === "replace"
          ? parsedImportProducts
          : [...kb.products, ...parsedImportProducts];

      const res = await fetch("/api/ai-agent/knowledge/products/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: finalProducts }),
      });

      const data = await res.json();
      if (data.success && data.knowledge) {
        setKb(data.knowledge);
        await onSaveKnowledge(data.knowledge);
        setIsDirty(false);
        setSaveSuccess(true);
        setIsImportModalOpen(false);
        setParsedImportProducts([]);
        setImportFileName("");
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error(data.error || (isAr ? "فشل حفظ المنتجات" : "Failed to save products"));
      }
    } catch (e: any) {
      setImportError(e?.message || (isAr ? "حدث خطأ أثناء حفظ الكتالوج" : "Error saving catalog"));
    } finally {
      setIsImporting(false);
    }
  };

  // Categories list derived from current products
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    kb.products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [kb.products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return kb.products.filter((p) => {
      const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  }, [kb.products, selectedCategory, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-400" />
            <span>{isAr ? "قاعدة معرفة وكتالوج الذكاء الاصطناعي (Grounding)" : "AI Grounding & Knowledge Base"}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? "البيانات والأسعار والسياسات الرسمية التي يلتزم بها الوكيل بنسبة 100% دون تأليف أو هلوسة."
              : "Official data, catalog, and policies the AI strictly adheres to with zero hallucinations."}
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
            id="save-knowledge-btn"
            onClick={() => handleSaveAll()}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isAr ? "حفظ التغييرات" : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: "products", label: isAr ? `المنتجات والخدمات (${kb.products.length})` : `Products & Services (${kb.products.length})`, icon: Package },
          { id: "faqs", label: isAr ? `الأسئلة الشائعة (${kb.faqs.length})` : `FAQs (${kb.faqs.length})`, icon: HelpCircle },
          { id: "policies", label: isAr ? "السياسات وساعات العمل" : "Policies & Hours", icon: Shield },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                  : "bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-tab 1: Products & Services */}
      {activeSubTab === "products" && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {isAr ? "كتالوج منتجات وأسعار سولو ايطاليانو" : "Solo Italiano Product Catalog"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono font-semibold">
                  {filteredProducts.length} / {kb.products.length} {isAr ? "منتج" : "items"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAr
                  ? "يستشهد الوكيل بالأسعار والأصناف والمواصفات من هذه القائمة بدقة 100%."
                  : "The AI quotes exact prices and specifications directly from this catalog."}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                id="reset-catalog-btn"
                onClick={handleResetSoloItalianoPrompt}
                title={isAr ? "استعادة قائمة أسعار سولو ايطاليانو 2026 الكاملة (24 صنف)" : "Restore official Solo Italiano 2026 Price List (24 items)"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 text-xs font-semibold rounded-xl border border-teal-500/20 transition shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                <span>{isAr ? "استعادة كتالوج سولو ايطاليانو" : "Reset to Solo Italiano"}</span>
              </button>

              {kb.products.length > 0 && (
                <button
                  id="clear-all-products-btn"
                  onClick={handleClearAllProductsPrompt}
                  title={isAr ? "مسح جميع المنتجات من الكتالوج دفعة واحدة" : "Clear all products"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-semibold rounded-xl border border-slate-700/60 hover:border-rose-500/30 transition shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isAr ? "مسح الكل" : "Clear All"}</span>
                </button>
              )}

              <button
                id="import-products-btn"
                onClick={() => {
                  setImportError(null);
                  setParsedImportProducts([]);
                  setImportFileName("");
                  setIsImportModalOpen(true);
                }}
                title={isAr ? "استيراد أو استبدال الكتالوج بملف JSON أو CSV جديد" : "Import or replace catalog from JSON/CSV file"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold rounded-xl border border-amber-500/30 transition shadow-sm"
              >
                <FileUp className="w-3.5 h-3.5 text-amber-400" />
                <span>{isAr ? "استيراد / استبدال بملف" : "Import / Replace File"}</span>
              </button>

              <button
                id="add-product-btn"
                onClick={handleOpenAddProduct}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-teal-600/20 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? "إضافة منتج" : "Add Product"}</span>
              </button>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 rtl:right-3 ltr:left-3 ltr:right-auto" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "بحث بالاسم، الكود (SKU)، التصنيف أو الوصف..." : "Search product name, SKU, category..."}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 ltr:pl-9 ltr:pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            {productCategories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    selectedCategory === "all"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {isAr ? "الكل" : "All"} ({kb.products.length})
                </button>
                {productCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? "bg-teal-600 text-white"
                        : "bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Empty State */}
          {filteredProducts.length === 0 && (
            <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-2xl p-8 text-center space-y-3">
              <Package className="w-10 h-10 text-slate-500 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isAr ? "لا توجد منتجات مطابقة" : "No matching products"}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {kb.products.length === 0
                    ? isAr
                      ? "كتالوج المنتجات فارغ حالياً. يمكنك استعادة كتالوج سولو ايطاليانو الأصلي (24 صنف) بضغطة واحدة."
                      : "The catalog is currently empty. You can restore all 24 Solo Italiano items with one click."
                    : isAr
                    ? "لا توجد نتائج تطابق بحثك. جرّب تغيير كلمة البحث أو التصنيف."
                    : "No products matched your search. Try adjusting the query or category."}
                </p>
              </div>
              {kb.products.length === 0 && (
                <button
                  onClick={handleResetSoloItalianoPrompt}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isAr ? "استعادة كتالوج سولو ايطاليانو الآن" : "Restore Solo Italiano Now"}</span>
                </button>
              )}
            </div>
          )}

          {/* Product Cards Grid */}
          {filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition space-y-2.5 relative flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm leading-snug">
                          {prod.name}
                        </h4>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {prod.category} {prod.sku ? `• SKU: ${prod.sku}` : ""}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                          prod.inStock
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {prod.inStock ? (isAr ? "متوفر" : "In Stock") : (isAr ? "غير متوفر" : "Out of stock")}
                      </span>
                    </div>

                    <div className="text-base font-bold text-teal-400 font-mono">
                      {prod.price > 0 ? (
                        `${prod.price} ${prod.currency || kb.currency || "EGP"}`
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-300 rounded-md">
                          {isAr ? "السعر عند الطلب" : "Price on request"}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {prod.description}
                    </p>

                    {prod.features && prod.features.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        {prod.features.map((feat, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60"
                          >
                            ✓ {feat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {prod.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingProduct({ ...prod });
                          setIsProductModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title={isAr ? "تعديل بيانات المنتج" : "Edit product"}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProductPrompt(prod)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                        title={isAr ? "حذف هذا المنتج" : "Delete product"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: FAQs */}
      {activeSubTab === "faqs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {isAr
                ? "إجابات الأسئلة المتكررة للعملاء. يعتمد عليها الوكيل للرد بسرعة وبشكل دقيق."
                : "Frequently asked questions and answers used by the AI to reply accurately."}
            </span>
            <button
              id="add-faq-btn"
              onClick={handleOpenAddFaq}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/90 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? "إضافة سؤال شائع" : "Add FAQ"}</span>
            </button>
          </div>

          <div className="space-y-3">
            {kb.faqs.map((faq) => (
              <div
                key={faq.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-slate-700/80 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xs font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 shrink-0">
                      Q
                    </span>
                    <h4 className="font-bold text-white text-xs sm:text-sm">
                      {faq.question}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {faq.category && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                        {faq.category}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditingFaq({ ...faq });
                        setIsFaqModalOpen(true);
                      }}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteFaqPrompt(faq)}
                      className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300"
                      title={isAr ? "حذف السؤال" : "Delete FAQ"}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed pl-7 whitespace-pre-wrap bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                  {faq.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 3: Policies & Hours */}
      {activeSubTab === "policies" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Shipping Policy */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-teal-400" />
              <span>{isAr ? "سياسة وأسعار الشحن والتوصيل:" : "Shipping & Delivery Policy:"}</span>
            </label>
            <textarea
              rows={3}
              value={kb.shippingPolicy}
              onChange={(e) => updateKbField("shippingPolicy", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed"
            />
          </div>

          {/* Return & Warranty Policy */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-teal-400" />
              <span>{isAr ? "سياسة الاسترجاع والاستبدال والضمان:" : "Return & Warranty Policy:"}</span>
            </label>
            <textarea
              rows={3}
              value={kb.returnPolicy}
              onChange={(e) => updateKbField("returnPolicy", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed"
            />
          </div>

          {/* Payment Methods */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-teal-400" />
              <span>{isAr ? "طرق الدفع المقبولة:" : "Accepted Payment Methods:"}</span>
            </label>
            <textarea
              rows={3}
              value={kb.paymentMethods}
              onChange={(e) => updateKbField("paymentMethods", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed"
            />
          </div>

          {/* Working Hours & Out-of-Hours Message */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>{isAr ? "ساعات العمل الرسمية:" : "Working Hours:"}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kb.workingHours.enabled}
                  onChange={(e) =>
                    updateKbField("workingHours", {
                      ...kb.workingHours,
                      enabled: e.target.checked,
                    })
                  }
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-300">
                  {isAr ? "تفعيل تنبيه خارج الدوام" : "Out of hours notice"}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? "من الساعة:" : "From:"}
                </span>
                <input
                  type="text"
                  value={kb.workingHours.start}
                  onChange={(e) =>
                    setKb({
                      ...kb,
                      workingHours: { ...kb.workingHours, start: e.target.value },
                    })
                  }
                  placeholder="09:00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">
                  {isAr ? "إلى الساعة:" : "To:"}
                </span>
                <input
                  type="text"
                  value={kb.workingHours.end}
                  onChange={(e) =>
                    setKb({
                      ...kb,
                      workingHours: { ...kb.workingHours, end: e.target.value },
                    })
                  }
                  placeholder="23:00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">
                {isAr ? "رسالة خارج أوقات العمل:" : "Out of hours message:"}
              </span>
              <textarea
                rows={2}
                value={kb.workingHours.outsideHoursMessage}
                onChange={(e) =>
                  setKb({
                    ...kb,
                    workingHours: {
                      ...kb.workingHours,
                      outsideHoursMessage: e.target.value,
                    },
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Product Edit / Add Modal */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">
              {editingProduct.id.includes(Date.now().toString().slice(0, 5))
                ? isAr ? "إضافة منتج جديد للكتالوج" : "Add New Product"
                : isAr ? "تعديل بيانات المنتج" : "Edit Product"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">
                  {isAr ? "اسم المنتج:" : "Product Name:"}
                </label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  placeholder={isAr ? "مثال: ساعة الترا الذكية" : "e.g. Smart Watch Ultra"}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">
                    {isAr ? "الفئة:" : "Category:"}
                  </label>
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    placeholder={isAr ? "إلكترونيات" : "Electronics"}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">
                    {isAr ? "السعر:" : "Price:"}
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={editingProduct.price}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          price: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                    <span className="px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 text-[11px] flex items-center">
                      {kb.currency}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  {isAr ? "الوصف والمواصفات:" : "Description:"}
                </label>
                <textarea
                  rows={3}
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      description: e.target.value,
                    })
                  }
                  placeholder={isAr ? "اكتب تفاصيل ومواصفات المنتج..." : "Product specs and details..."}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  {isAr ? "المميزات البارزة (مفصولة بفاصلة):" : "Key Features (comma separated):"}
                </label>
                <input
                  type="text"
                  value={editingProduct.features?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      features: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder={isAr ? "شاشة AMOLED، بطارية 7 أيام، مقاوم للماء" : "AMOLED screen, 7 days battery"}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="instock-checkbox"
                  checked={editingProduct.inStock}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, inStock: e.target.checked })
                  }
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="instock-checkbox" className="text-slate-300 cursor-pointer">
                  {isAr ? "متوفر حالياً بالمخزن وجاهز للشحن الفوري" : "In Stock and ready for delivery"}
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleSaveProductModal}
                disabled={!editingProduct.name.trim()}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
              >
                {isAr ? "حفظ المنتج" : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Edit / Add Modal */}
      {isFaqModalOpen && editingFaq && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">
              {editingFaq.id.includes(Date.now().toString().slice(0, 5))
                ? isAr ? "إضافة سؤال شائع جديد" : "Add New FAQ"
                : isAr ? "تعديل السؤال الشائع" : "Edit FAQ"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">
                  {isAr ? "السؤال:" : "Question:"}
                </label>
                <input
                  type="text"
                  value={editingFaq.question}
                  onChange={(e) =>
                    setEditingFaq({ ...editingFaq, question: e.target.value })
                  }
                  placeholder={isAr ? "مثال: ما هي طرق الدفع المتاحة؟" : "e.g. What payment methods are accepted?"}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  {isAr ? "الإجابة النموذجية:" : "Answer:"}
                </label>
                <textarea
                  rows={3}
                  value={editingFaq.answer}
                  onChange={(e) =>
                    setEditingFaq({ ...editingFaq, answer: e.target.value })
                  }
                  placeholder={isAr ? "اكتب الإجابة التي سيعتمد عليها الذكاء الاصطناعي..." : "Type the official answer..."}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  {isAr ? "التصنيف:" : "Category:"}
                </label>
                <input
                  type="text"
                  value={editingFaq.category || ""}
                  onChange={(e) =>
                    setEditingFaq({ ...editingFaq, category: e.target.value })
                  }
                  placeholder={isAr ? "الشحن / الدفع / الضمان" : "Shipping / Payment"}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsFaqModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleSaveFaqModal}
                disabled={!editingFaq.question.trim() || !editingFaq.answer.trim()}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
              >
                {isAr ? "حفظ السؤال" : "Save FAQ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Action Confirmation Modal (No window.confirm, safe for all iframes) */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  deleteConfirmTarget.type === "reset_solo"
                    ? "bg-teal-500/10 border border-teal-500/20 text-teal-400"
                    : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                }`}
              >
                {deleteConfirmTarget.type === "reset_solo" ? (
                  <RotateCcw className="w-5 h-5 text-teal-400" />
                ) : (
                  <Trash2 className="w-5 h-5 text-rose-400" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  {deleteConfirmTarget.type === "all_products"
                    ? isAr ? "تأكيد مسح جميع المنتجات" : "Clear All Products"
                    : deleteConfirmTarget.type === "reset_solo"
                    ? isAr ? "استعادة كتالوج سولو ايطاليانو الأصلي (24 صنف)" : "Restore Solo Italiano Catalog (24 items)"
                    : deleteConfirmTarget.type === "faq"
                    ? isAr ? "تأكيد حذف السؤال الشائع" : "Delete FAQ"
                    : isAr ? "تأكيد حذف المنتج" : "Confirm Product Deletion"}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {deleteConfirmTarget.type === "all_products"
                    ? isAr
                      ? "هل تريد بالتأكيد إفراغ الكتالوج ومسح جميع المنتجات المسجلة؟ لن يستطيع الوكيل عرضها للعملاء."
                      : "Are you sure you want to clear all products from the catalog?"
                    : deleteConfirmTarget.type === "reset_solo"
                    ? isAr
                      ? "سيتم استبدال الكتالوج الحالي بجميع منتجات سولو ايطاليانو الـ 24 المعتمدة لعام 2026 مع كافة الأسعار والسياسات الرسمية."
                      : "This will restore all 24 official Solo Italiano products and policies for 2026."
                    : deleteConfirmTarget.type === "faq"
                    ? isAr
                      ? `هل تريد بالتأكيد حذف السؤال: "${deleteConfirmTarget.name || ""}"؟`
                      : `Are you sure you want to delete this FAQ: "${deleteConfirmTarget.name || ""}"?`
                    : isAr
                    ? `هل أنت متأكد من حذف المنتج: "${deleteConfirmTarget.name || ""}" نهائياً من الكتالوج؟`
                    : `Are you sure you want to permanently delete "${deleteConfirmTarget.name || ""}"?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                id="confirm-action-modal-btn"
                onClick={executeDeleteTarget}
                disabled={isDeleting}
                className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-xl transition shadow-md ${
                  deleteConfirmTarget.type === "reset_solo"
                    ? "bg-teal-600 hover:bg-teal-500 shadow-teal-600/20"
                    : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                }`}
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : deleteConfirmTarget.type === "reset_solo" ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {deleteConfirmTarget.type === "reset_solo"
                    ? isAr ? "استعادة الكتالوج" : "Confirm Restore"
                    : isAr ? "تأكيد الحذف" : "Confirm Delete"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Import / Replace from File Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isAr ? "استيراد واستبدال كتالوج المنتجات من ملف" : "Import & Replace Catalog from File"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isAr
                      ? "يدعم ملفات JSON أو CSV لاستبدال المنتجات الحالية أو الإضافة إليها."
                      : "Supports JSON or CSV files to replace current products or append to them."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {importError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{importError}</div>
              </div>
            )}

            {/* Upload Area */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {isAr ? "اختر أو اسحب ملف المنتجات (JSON أو CSV):" : "Select or drag product file (JSON or CSV):"}
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-850/50 hover:bg-slate-850/80 rounded-2xl p-6 cursor-pointer transition text-center group">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-amber-400 mb-2 transition" />
                <span className="text-xs font-semibold text-white">
                  {importFileName || (isAr ? "اضغط هنا لاختيار ملف أو اسحبه إلى هنا" : "Click to select file or drag & drop")}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  JSON (Array / Products) • CSV (Name, Price, Category, SKU, Description)
                </span>
                <input
                  type="file"
                  accept=".json,.csv,.txt,.tsv"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </label>
            </div>

            {/* Parsed Items Summary & Mode Selection */}
            {parsedImportProducts.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 bg-slate-850 rounded-xl border border-slate-750 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300 font-medium">{importFileName}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono">
                    {parsedImportProducts.length} {isAr ? "صنف جاهز للاستيراد" : "items parsed"}
                  </span>
                </div>

                {/* Import Mode: Replace vs Append */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {isAr ? "طريقة التطبيق على الكتالوج:" : "Application Method:"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode("replace")}
                      className={`flex flex-col text-right rtl:text-right ltr:text-left p-3 rounded-xl border transition ${
                        importMode === "replace"
                          ? "bg-amber-500/10 border-amber-500 text-amber-300"
                          : "bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-xs text-white">
                          {isAr ? "استبدال الكتالوج بالكامل" : "Replace entire catalog"}
                        </span>
                        {importMode === "replace" && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {isAr
                          ? "مسح جميع المنتجات الحالية واعتماد منتجات هذا الملف فقط."
                          : "Wipes all current items and installs only these items."}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode("append")}
                      className={`flex flex-col text-right rtl:text-right ltr:text-left p-3 rounded-xl border transition ${
                        importMode === "append"
                          ? "bg-teal-500/10 border-teal-500 text-teal-300"
                          : "bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-xs text-white">
                          {isAr ? "دمج وإضافة للكتالوج الحالي" : "Append to current"}
                        </span>
                        {importMode === "append" && <Check className="w-4 h-4 text-teal-400" />}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {isAr
                          ? `إبقاء المنتجات الحالية (${kb.products.length}) وإضافة ${parsedImportProducts.length} منتج جديد.`
                          : `Keep existing (${kb.products.length}) and add ${parsedImportProducts.length} new items.`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Preview of first 4 items */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    {isAr ? "معاينة أولية لبعض الأصناف في الملف:" : "Preview of detected items:"}
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                    {parsedImportProducts.slice(0, 5).map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/60 border border-slate-800/80"
                      >
                        <div className="truncate max-w-[280px]">
                          <span className="font-semibold text-white">{p.name}</span>
                          <span className="text-[10px] text-slate-400 block">{p.category}</span>
                        </div>
                        <span className="font-mono font-bold text-teal-400 shrink-0">
                          {p.price > 0 ? `${p.price} ${p.currency || "EGP"}` : (isAr ? "سعر عند الطلب" : "On request")}
                        </span>
                      </div>
                    ))}
                    {parsedImportProducts.length > 5 && (
                      <div className="text-center text-[10px] text-slate-500 py-1">
                        {isAr ? `... و ${parsedImportProducts.length - 5} صنف آخر` : `... and ${parsedImportProducts.length - 5} more items`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                id="confirm-import-products-btn"
                onClick={executeImportProducts}
                disabled={isImporting || parsedImportProducts.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-xl transition shadow-md disabled:opacity-50 ${
                  importMode === "replace"
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
                    : "bg-teal-600 hover:bg-teal-500 shadow-teal-600/20"
                }`}
              >
                {isImporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>
                  {importMode === "replace"
                    ? isAr
                      ? `استبدال الكتالوج بـ (${parsedImportProducts.length} صنف)`
                      : `Replace with (${parsedImportProducts.length} items)`
                    : isAr
                    ? `إضافة (${parsedImportProducts.length} صنف)`
                    : `Add (${parsedImportProducts.length} items)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
