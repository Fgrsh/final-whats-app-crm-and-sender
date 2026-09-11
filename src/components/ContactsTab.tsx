import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Trash2,
  Search,
  Users,
  CheckCircle2,
  ExternalLink,
  ClipboardList,
  AlertTriangle,
  UserPlus,
  Edit2,
  Check,
  X,
  Folder,
  FolderPlus,
  RotateCcw,
  Tag,
  Layers,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Sparkles,
} from "lucide-react";
import type { Contact, CampaignItem, CRMLead } from "../types.ts";
import { parseFile, parsePastedNumbers, generateSampleCSV, cleanPhoneNumber } from "../utils/fileParser.ts";
import {
  normalizePhoneNumber,
  isSamePhoneNumber,
  analyzeImportDuplicates,
  deduplicateContactList,
  DuplicateAnalysisResult,
} from "../utils/phoneUtils.ts";

interface ContactsTabProps {
  contacts: Contact[];
  onSetContacts: (contacts: Contact[]) => void;
  onAddBatchContacts?: (contacts: Contact[], groupName: string) => void;
  onDeleteGroup?: (groupName: string) => void;
  onResetGroup?: (groupName: string) => void;
  onRenameGroup?: (oldName: string, newName: string) => void;
  campaigns?: CampaignItem[];
  language: "ar" | "en";
}

export const ContactsTab: React.FC<ContactsTabProps> = ({
  contacts,
  onSetContacts,
  onAddBatchContacts,
  onDeleteGroup,
  onResetGroup,
  onRenameGroup,
  campaigns = [],
  language,
}) => {
  const isAr = language === "ar";
  const [pasteText, setPasteText] = useState("");
  const [pasteGroupName, setPasteGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>("all");
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CRM Leads for cross-system duplicate checking
  const [crmLeads, setCrmLeads] = useState<CRMLead[]>([]);

  useEffect(() => {
    fetch("/api/crm/leads")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.leads)) {
          setCrmLeads(data.leads);
        }
      })
      .catch(() => {});
  }, []);

  // Upload Batch Confirmation Modal with Automated Duplicate Detection
  const [pendingUpload, setPendingUpload] = useState<{
    contacts: Contact[];
    suggestedGroupName: string;
    replaceExisting: boolean;
    duplicateAnalysis: DuplicateAnalysisResult;
    duplicateAction: "skip" | "update";
    showDetails: boolean;
  } | null>(null);

  // Deduplicate Current Campaign Contacts Modal
  const [deduplicateModalState, setDeduplicateModalState] = useState<{
    duplicates: Array<{ phone: string; count: number; names: string[]; groups: string[] }>;
    totalDuplicateRows: number;
  } | null>(null);

  // Rename Group Modal
  const [renameGroupState, setRenameGroupState] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);

  // Group Action Confirmation (Reset or Delete)
  const [confirmGroupAction, setConfirmGroupAction] = useState<{
    type: "reset" | "delete";
    groupName: string;
  } | null>(null);

  // Edit Contact Modal State
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    company: "",
    notes: "",
    groupName: "",
  });

  // Add Contact Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    phone: "",
    company: "",
    notes: "",
    groupName: "",
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Distinct groups computed from contacts
  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      const g = (c.groupName || (isAr ? "عام" : "General")).trim();
      if (g) set.add(g);
    });
    return Array.from(set);
  }, [contacts, isAr]);

  const handleFileUpload = async (file: File) => {
    setErrorMessage(null);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        setErrorMessage(
          isAr
            ? "لم يتم العثور على أرقام هواتف صالحة داخل هذا الملف."
            : "No valid phone numbers found in this file."
        );
        return;
      }
      const rawBaseName = file.name.replace(/\.[^/.]+$/, "").trim();
      const suggestedGroupName = rawBaseName || (isAr ? `ملف ${new Date().toLocaleDateString("ar-EG")}` : `Import ${new Date().toLocaleDateString()}`);

      // Fetch fresh CRM leads for cross-system duplicate checking
      let currentLeads = crmLeads;
      try {
        const crmRes = await fetch("/api/crm/leads");
        const crmData = await crmRes.json();
        if (crmData && Array.isArray(crmData.leads)) {
          currentLeads = crmData.leads;
          setCrmLeads(crmData.leads);
        }
      } catch {}

      const analysis = analyzeImportDuplicates(parsed, contacts, campaigns, currentLeads);

      // Open confirmation modal with duplicate analysis
      setPendingUpload({
        contacts: parsed,
        suggestedGroupName,
        replaceExisting: false,
        duplicateAnalysis: analysis,
        duplicateAction: "skip",
        showDetails: analysis.hasDuplicates,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "خطأ أثناء معالجة الملف");
    }
  };

  const handleConfirmUpload = () => {
    if (!pendingUpload) return;
    const finalGroupName = (pendingUpload.suggestedGroupName || (isAr ? "مجموعة مستوردة" : "Imported Group")).trim();
    const { duplicateAnalysis, duplicateAction } = pendingUpload;

    let contactsToImport: Contact[] = [];

    if (duplicateAction === "skip") {
      // Import only clean unique contacts
      contactsToImport = duplicateAnalysis.cleanContacts.map((c) => ({
        ...c,
        groupName: finalGroupName,
      }));
    } else {
      // Update existing & append new
      contactsToImport = pendingUpload.contacts.map((c) => ({
        ...c,
        groupName: finalGroupName,
      }));
    }

    if (pendingUpload.replaceExisting) {
      onSetContacts(contactsToImport);
    } else if (onAddBatchContacts) {
      onAddBatchContacts(contactsToImport, finalGroupName);
    } else {
      // Fallback
      onSetContacts([...contacts, ...contactsToImport]);
    }

    setSelectedGroupTab(finalGroupName);
    const importedCount = contactsToImport.length;
    const skippedCount = pendingUpload.contacts.length - importedCount;
    setPendingUpload(null);

    setSuccessToast(
      isAr
        ? `تم استيراد ${importedCount} جهة اتصال بنجاح في مجموعة "${finalGroupName}"${
            skippedCount > 0 ? ` (تم استبعاد ${skippedCount} رقم مكرر)` : ""
          }!`
        : `Successfully imported ${importedCount} contacts into "${finalGroupName}"${
            skippedCount > 0 ? ` (${skippedCount} duplicates excluded)` : ""
          }!`
    );
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return;
    const parsed = parsePastedNumbers(pasteText);
    if (parsed.length === 0) {
      setErrorMessage(
        isAr ? "لم نتمكن من استخراج أرقام صحيحة من النص الملصق." : "Could not extract valid phone numbers."
      );
      return;
    }
    const finalGroupName = (pasteGroupName || (isAr ? `لصق ${new Date().toLocaleDateString("ar-EG")}` : `Paste ${new Date().toLocaleDateString()}`)).trim();

    // Fetch fresh CRM leads for cross-system duplicate checking
    let currentLeads = crmLeads;
    try {
      const crmRes = await fetch("/api/crm/leads");
      const crmData = await crmRes.json();
      if (crmData && Array.isArray(crmData.leads)) {
        currentLeads = crmData.leads;
        setCrmLeads(crmData.leads);
      }
    } catch {}

    const analysis = analyzeImportDuplicates(parsed, contacts, campaigns, currentLeads);

    setPendingUpload({
      contacts: parsed,
      suggestedGroupName: finalGroupName,
      replaceExisting: false,
      duplicateAnalysis: analysis,
      duplicateAction: "skip",
      showDetails: analysis.hasDuplicates,
    });

    setPasteText("");
    setPasteGroupName("");
    setShowPasteArea(false);
  };

  const handleScanCurrentContactsForDuplicates = () => {
    // Group contacts by normalized phone
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      const norm = normalizePhoneNumber(c.phone);
      if (!map.has(norm)) map.set(norm, []);
      map.get(norm)!.push(c);
    }

    const duplicates: Array<{ phone: string; count: number; names: string[]; groups: string[] }> = [];
    let totalDuplicateRows = 0;

    for (const [phone, list] of map.entries()) {
      if (list.length > 1) {
        duplicates.push({
          phone,
          count: list.length,
          names: Array.from(new Set(list.map((c) => c.name).filter(Boolean) as string[])),
          groups: Array.from(new Set(list.map((c) => c.groupName || (isAr ? "عام" : "General")))),
        });
        totalDuplicateRows += list.length - 1;
      }
    }

    if (duplicates.length === 0) {
      setSuccessToast(
        isAr
          ? `قائمة أرقام الحملة نظيفة تماماً ولا تحتوي على أي أرقام مكررة (تم فحص ${contacts.length} جهة اتصال بنجاح)!`
          : `Campaign contacts list is 100% clean with zero duplicates (${contacts.length} contacts checked)!`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    } else {
      setDeduplicateModalState({
        duplicates,
        totalDuplicateRows,
      });
    }
  };

  const handleConfirmDeduplicateContacts = async () => {
    try {
      const res = await fetch("/api/campaign/contacts/deduplicate", { method: "POST" });
      const data = await res.json();
      if (data.success && data.contacts) {
        onSetContacts(data.contacts);
        setSuccessToast(
          isAr
            ? `تم دمج وتنظيف جهات اتصال الحملة بنجاح: تم إزالة ${data.removedCount} رقم مكرر، والمتبقي ${data.remainingCount} رقم فريد!`
            : `Deduplication complete: removed ${data.removedCount} duplicate contacts, remaining ${data.remainingCount} unique contacts!`
        );
      } else {
        const result = deduplicateContactList(contacts);
        onSetContacts(result.cleaned);
        setSuccessToast(
          isAr
            ? `تم تنظيف جهات اتصال الحملة وتوحيد ${result.removedCount} رقم مكرر بنجاح!`
            : `Cleaned campaign contacts, removed ${result.removedCount} duplicates successfully!`
        );
      }
    } catch (e) {
      const result = deduplicateContactList(contacts);
      onSetContacts(result.cleaned);
    } finally {
      setDeduplicateModalState(null);
      setTimeout(() => setSuccessToast(null), 5000);
    }
  };

  const handleDownloadSample = () => {
    const csvContent = generateSampleCSV();
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "whatsapp_contacts_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteContact = (id: string) => {
    onSetContacts(contacts.filter((c) => c.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    onSetContacts(contacts.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({
      name: contact.name || "",
      phone: contact.phone,
      company: contact.company || "",
      notes: contact.notes || "",
      groupName: contact.groupName || (isAr ? "عام" : "General"),
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;

    const cleaned = cleanPhoneNumber(editForm.phone);
    if (cleaned.length < 7) {
      setErrorMessage(isAr ? "رقم الهاتف غير صالح" : "Invalid phone number");
      return;
    }

    // Check duplicate against other contacts in this campaign
    const duplicateAnother = contacts.find(
      (c) => c.id !== editingContact.id && isSamePhoneNumber(c.phone, cleaned)
    );
    if (duplicateAnother) {
      setErrorMessage(
        isAr
          ? `لا يمكن حفظ التعديل: رقم الهاتف ينتمي لجهة اتصال أخرى (${duplicateAnother.name || duplicateAnother.phone}) في مجموعة "${duplicateAnother.groupName || "عام"}"!`
          : `Cannot save: phone belongs to another contact (${duplicateAnother.name || duplicateAnother.phone})!`
      );
      return;
    }

    const updatedList = contacts.map((c) => {
      if (c.id === editingContact.id) {
        return {
          ...c,
          name: editForm.name.trim() || undefined,
          phone: cleaned,
          rawPhone: editForm.phone.trim(),
          company: editForm.company.trim() || undefined,
          notes: editForm.notes.trim() || undefined,
          groupName: editForm.groupName.trim() || (isAr ? "عام" : "General"),
        };
      }
      return c;
    });

    onSetContacts(updatedList);
    setEditingContact(null);
    setErrorMessage(null);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanPhoneNumber(addForm.phone);
    if (cleaned.length < 7) {
      setErrorMessage(isAr ? "رقم الهاتف غير صالح" : "Invalid phone number");
      return;
    }

    // Check duplicate in current campaign
    const existingInCampaign = contacts.find((c) => isSamePhoneNumber(c.phone, cleaned));
    if (existingInCampaign) {
      setErrorMessage(
        isAr
          ? `رقم الهاتف مسجل بالفعل في هذه الحملة لـ (${existingInCampaign.name || existingInCampaign.phone}) في مجموعة "${existingInCampaign.groupName || "افتراضي"}"!`
          : `Phone number is already registered in this campaign in group "${existingInCampaign.groupName || "General"}"!`
      );
      return;
    }

    // Check duplicate in CRM
    const existingInCrm = crmLeads.find((l) => isSamePhoneNumber(l.phone, cleaned));

    const targetGroup = addForm.groupName.trim() || (isAr ? "عام" : "General");
    const newContact: Contact = {
      id: `c-${Date.now().toString(36)}`,
      phone: cleaned,
      rawPhone: addForm.phone.trim(),
      name: addForm.name.trim() || (existingInCrm ? existingInCrm.name : undefined),
      company: addForm.company.trim() || (existingInCrm ? existingInCrm.company : undefined),
      notes: addForm.notes.trim() || (existingInCrm ? `عميل CRM: ${existingInCrm.stage}` : undefined),
      groupName: targetGroup,
      status: "pending",
    };

    onSetContacts([newContact, ...contacts]);
    setAddForm({ name: "", phone: "", company: "", notes: "", groupName: "" });
    setShowAddModal(false);
    setErrorMessage(null);

    if (existingInCrm) {
      setSuccessToast(
        isAr
          ? `تمت إضافة جهة الاتصال بنجاح (تم ربط بيانات العميل من الـ CRM: ${existingInCrm.name || existingInCrm.phone})!`
          : `Contact added (linked CRM lead: ${existingInCrm.name || existingInCrm.phone})!`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    }
  };

  // Pagination state for responsive high-performance rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Memoized filter calculation to avoid re-evaluating on every keystroke or checkbox click
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedGroupTab !== "all") {
        const g = (c.groupName || (isAr ? "عام" : "General")).trim();
        if (g !== selectedGroupTab) return false;
      }
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        c.phone.includes(query) ||
        c.name?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query) ||
        c.notes?.toLowerCase().includes(query) ||
        c.groupName?.toLowerCase().includes(query)
      );
    });
  }, [contacts, selectedGroupTab, searchQuery, isAr]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedGroupTab, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));

  // Slice contacts for current active page
  const paginatedContacts = useMemo(() => {
    if (pageSize >= 10000) return filteredContacts;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredContacts.slice(startIndex, startIndex + pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  // Check if all contacts on the CURRENT visible page are selected
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedContacts.length === 0) return false;
    return paginatedContacts.every((c) => selectedIds.has(c.id));
  }, [paginatedContacts, selectedIds]);

  const toggleSelectCurrentPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedContacts.forEach((c) => next.delete(c.id));
      } else {
        paginatedContacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Import Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Drag & Drop Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
            isDragging
              ? "border-emerald-500 bg-emerald-950/20"
              : "border-slate-800 hover:border-emerald-500/50 bg-slate-900/50 hover:bg-slate-900"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
            }}
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">
              {isAr ? "اسحب وأفلت ملف CSV أو Excel هنا" : "Drop CSV or Excel (.xlsx) file here"}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              {isAr
                ? "أو اضغط لاختيار الملف من جهازك (يدعم إكسل وشيتس مباشرة)"
                : "or click to browse your spreadsheets"}
            </p>
          </div>
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            CSV, XLSX, XLS
          </span>
        </div>

        {/* Quick Actions & Manual Paste */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                {isAr ? "إضافة سريعة أو نموذج" : "Quick Add & Sample"}
              </h4>
              <button
                onClick={handleDownloadSample}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isAr ? "نموذج CSV جاهز" : "Download Sample"}</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {isAr
                ? "يمكنك لصق قائمة أرقام دفعة واحدة، أو إضافة أرقام مفردة وتعديل بيانات أي جهة اتصال مباشرة."
                : "Paste phone numbers in bulk or add single contacts manually and edit them anytime."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAr ? "إضافة رقم يدوياً" : "Add Single Contact"}</span>
            </button>
            <button
              onClick={() => setShowPasteArea(!showPasteArea)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              {showPasteArea
                ? isAr
                  ? "إغلاق اللصق"
                  : "Close Paste"
                : isAr
                ? "لصق أرقام متعددة"
                : "Paste Numbers"}
            </button>
            {contacts.length > 0 && (
              <>
                <button
                  onClick={handleScanCurrentContactsForDuplicates}
                  className="py-2 px-3 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  title={isAr ? "فحص وتنظيف الأرقام المكررة في الحملة" : "Scan and clean duplicates"}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isAr ? "فحص وتنظيف المكررات" : "Clean Duplicates"}</span>
                </button>
                <button
                  onClick={() => onSetContacts([])}
                  className="py-2 px-3 text-red-400 hover:bg-red-950/40 border border-red-500/20 text-xs font-semibold rounded-xl transition flex items-center gap-1"
                  title={isAr ? "مسح القائمة الحالية" : "Clear list"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? "مسح الكل" : "Clear All"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Manual Paste Textarea Drawer */}
      {showPasteArea && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              {isAr
                ? "الصق الأرقام هنا (رقم في كل سطر، أو: رقم,الاسم,الشركة,ملاحظة):"
                : "Paste numbers here (one per line, or: phone,name,company,notes):"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-300 font-semibold shrink-0">
              {isAr ? "اسم المجموعة:" : "Group Name:"}
            </label>
            <input
              type="text"
              value={pasteGroupName}
              onChange={(e) => setPasteGroupName(e.target.value)}
              placeholder={isAr ? "مثال: عملاء المعرض أو مهتمين نوفمبر" : "e.g. November Leads"}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              isAr
                ? "201012345678,أحمد حسام,شركة الأمل,تفاصيل الطلب\n966501234567,سارة العتيبي\n971501234567"
                : "14155552671,John Doe,Acme Corp,Urgent meeting\n447123456789,Jane Smith"
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowPasteArea(false)}
              className="px-4 py-1.5 text-xs text-slate-400 hover:text-white transition"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              onClick={handlePasteSubmit}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isAr ? "فحص واستيراد الأرقام" : "Verify & Import"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-300 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-400/70 hover:text-emerald-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Table & List Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? "قائمة جهات الاتصال المستهدفة" : "Target Contacts"}
            </h3>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
              {contacts.length} {isAr ? "رقم" : "contacts"}
            </span>

            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="text-xs font-semibold text-red-400 bg-red-950/40 border border-red-500/30 px-2.5 py-1 rounded-xl hover:bg-red-900/50 transition flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>
                  {isAr ? `حذف المحدد (${selectedIds.size})` : `Delete selected (${selectedIds.size})`}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "بحث بالاسم أو الرقم أو المجموعة..." : "Search name, phone, or group..."}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Groups Filter & Management Bar */}
        {existingGroups.length > 0 && (
          <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isAr ? "مجموعات الأرقام:" : "Groups:"}</span>
              </span>

              {/* All contacts tab */}
              <button
                onClick={() => setSelectedGroupTab("all")}
                className={`text-xs px-3 py-1 rounded-xl font-medium transition cursor-pointer shrink-0 ${
                  selectedGroupTab === "all"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {isAr ? "جميع الأرقام" : "All Contacts"} ({contacts.length})
              </button>

              {/* Individual group tabs */}
              {existingGroups.map((grp) => {
                const count = contacts.filter((c) => (c.groupName || (isAr ? "عام" : "General")).trim() === grp).length;
                const isSelected = selectedGroupTab === grp;
                return (
                  <button
                    key={grp}
                    onClick={() => setSelectedGroupTab(grp)}
                    className={`text-xs px-3 py-1 rounded-xl font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <Tag className="w-3 h-3 opacity-70" />
                    <span>{grp}</span>
                    <span className="text-[10px] bg-black/25 px-1.5 py-0.2 rounded-full font-mono">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Group Actions Bar */}
            {selectedGroupTab !== "all" && (
              <div className="flex items-center gap-1.5 shrink-0 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-400 px-2 flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5" />
                  <span>{selectedGroupTab}</span>
                </span>

                {/* Reset group */}
                {onResetGroup && (
                  <button
                    onClick={() => setConfirmGroupAction({ type: "reset", groupName: selectedGroupTab })}
                    className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer font-medium"
                    title={isAr ? "إعادة تعيين حالة أرقام المجموعة" : "Reset group numbers"}
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>{isAr ? "إعادة تعيين" : "Reset"}</span>
                  </button>
                )}

                {/* Rename group */}
                {onRenameGroup && (
                  <button
                    onClick={() => setRenameGroupState({ oldName: selectedGroupTab, newName: selectedGroupTab })}
                    className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer font-medium"
                    title={isAr ? "تعديل اسم هذه المجموعة" : "Rename group"}
                  >
                    <Edit2 className="w-3 h-3 text-cyan-400" />
                    <span>{isAr ? "تعديل الاسم" : "Rename"}</span>
                  </button>
                )}

                {/* Delete group */}
                {onDeleteGroup && (
                  <button
                    onClick={() => setConfirmGroupAction({ type: "delete", groupName: selectedGroupTab })}
                    className="flex items-center gap-1 text-[11px] bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/20 px-2.5 py-1 rounded-lg transition cursor-pointer font-medium"
                    title={isAr ? "حذف هذه المجموعة والأرقام التابعة لها" : "Delete group and its contacts"}
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                    <span>{isAr ? "حذف المجموعة" : "Delete"}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Contacts Table */}
        {contacts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-400">
              {isAr ? "لم تقم بإضافة أي جهات اتصال بعد." : "No contacts added yet."}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {isAr
                ? "ارفع ملف CSV أو إكسل، أو اضغط على 'إضافة رقم يدوياً' لإدراج جهات الاتصال."
                : "Upload CSV/Excel or click 'Add Single Contact' to populate your list."}
            </p>
          </div>
        ) : (
          <div>
            {/* Selection Banner for mass actions */}
            {selectedIds.size > 0 && (
              <div className="px-4 py-2.5 bg-emerald-950/50 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">
                    {isAr
                      ? `تم تحديد ${selectedIds.size} من أصل ${filteredContacts.length} جهة اتصال`
                      : `Selected ${selectedIds.size} of ${filteredContacts.length} contacts`}
                  </span>
                  {selectedIds.size < filteredContacts.length && (
                    <button
                      onClick={selectAllFiltered}
                      className="text-white underline hover:text-emerald-200 font-bold ml-2 transition cursor-pointer"
                    >
                      {isAr
                        ? `(تحديد كل الـ ${filteredContacts.length} جهة اتصال)`
                        : `(Select all ${filteredContacts.length} contacts)`}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={deselectAll}
                    className="text-slate-400 hover:text-white underline transition cursor-pointer"
                  >
                    {isAr ? "إلغاء التحديد" : "Deselect all"}
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAr ? `حذف المحدد (${selectedIds.size})` : `Delete (${selectedIds.size})`}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllCurrentPageSelected}
                        onChange={toggleSelectCurrentPage}
                        className="accent-emerald-500 rounded cursor-pointer"
                        title={isAr ? "تحديد الصفحة الحالية" : "Select current page"}
                      />
                    </th>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">{isAr ? "المجموعة" : "Group"}</th>
                    <th className="py-3 px-4">{isAr ? "رقم الهاتف" : "Phone"}</th>
                    <th className="py-3 px-4">{isAr ? "الاسم" : "Name"}</th>
                    <th className="py-3 px-4">{isAr ? "الشركة / المتجر" : "Company"}</th>
                    <th className="py-3 px-4">{isAr ? "ملاحظة / تفاصيل" : "Note / Info"}</th>
                    <th className="py-3 px-4">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-3 px-4 text-center">{isAr ? "تعديل وإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {paginatedContacts.map((contact, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    const isSelected = selectedIds.has(contact.id);
                    return (
                      <tr
                        key={contact.id}
                        className={`transition ${isSelected ? "bg-emerald-950/20 hover:bg-emerald-950/30" : "hover:bg-slate-800/40"}`}
                      >
                        <td className="py-2.5 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(contact.id)}
                            className="accent-emerald-500 rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{rowNumber}</td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                            <Tag className="w-2.5 h-2.5 opacity-70" />
                            <span>{contact.groupName || (isAr ? "عام" : "General")}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-emerald-400 select-all">
                          +{contact.phone}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-white">
                          {contact.name || <span className="text-slate-500 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-4">
                          {contact.company || <span className="text-slate-500 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-4 max-w-xs truncate text-slate-400">
                          {contact.notes || <span className="text-slate-500 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-4">
                          {contact.status === "sent" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              {isAr ? "تم الإرسال" : "Sent"}
                            </span>
                          ) : contact.status === "failed" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                              {isAr ? "فشل" : "Failed"}
                            </span>
                          ) : contact.status === "sending" || contact.status === "generating" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                              {isAr ? "جاري الإرسال" : "Sending..."}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                              {isAr ? "قيد الانتظار" : "Pending"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Contact Button */}
                            <button
                              onClick={() => handleOpenEdit(contact)}
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                              title={isAr ? "تعديل بيانات جهة الاتصال" : "Edit contact details"}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={`https://wa.me/${contact.phone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                              title={isAr ? "فتح محادثة واتساب ويب" : "Open WhatsApp Web"}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleDeleteContact(contact.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                              title={isAr ? "حذف من القائمة" : "Delete"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination & Summary Footer */}
            {filteredContacts.length > 0 && (
              <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Left: Summary and Row Limit buttons */}
                <div className="flex items-center gap-3 text-slate-400">
                  <span>
                    {isAr
                      ? `عرض ${Math.min((currentPage - 1) * pageSize + 1, filteredContacts.length)} - ${Math.min(
                          currentPage * pageSize,
                          filteredContacts.length
                        )} من أصل ${filteredContacts.length} جهة اتصال`
                      : `Showing ${Math.min((currentPage - 1) * pageSize + 1, filteredContacts.length)}-${Math.min(
                          currentPage * pageSize,
                          filteredContacts.length
                        )} of ${filteredContacts.length} contacts`}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">{isAr ? "صفوف الصفحة:" : "Page size:"}</span>
                    {[25, 50, 100, 250].map((size) => (
                      <button
                        key={size}
                        onClick={() => setPageSize(size)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                          pageSize === size
                            ? "bg-emerald-600 text-white font-bold"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Page Navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
                      title={isAr ? "الصفحة الأولى" : "First page"}
                    >
                      {isAr ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
                      title={isAr ? "الصفحة السابقة" : "Previous page"}
                    >
                      {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                    </button>

                    <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-slate-300">
                      {isAr ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                    </span>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
                      title={isAr ? "الصفحة التالية" : "Next page"}
                    >
                      {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
                      title={isAr ? "الصفحة الأخيرة" : "Last page"}
                    >
                      {isAr ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? "تعديل بيانات جهة الاتصال" : "Edit Contact"}</span>
              </h4>
              <button
                onClick={() => setEditingContact(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "رقم الهاتف (مع كود الدولة):" : "Phone Number (with Country Code):"}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="201012345678"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "الاسم:" : "Name:"}
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder={isAr ? "أحمد محمد" : "John Doe"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "الشركة / المتجر:" : "Company:"}
                </label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  placeholder={isAr ? "شركة الأمل" : "Acme Corp"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "المجموعة:" : "Group:"}
                </label>
                <input
                  type="text"
                  list="groups-list"
                  value={editForm.groupName}
                  onChange={(e) => setEditForm({ ...editForm, groupName: e.target.value })}
                  placeholder={isAr ? "اسم المجموعة (مثل: عملاء دائمين)" : "Group Name"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "الملاحظات أو تفاصيل العميل:" : "Notes / Details:"}
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder={isAr ? "تفاصيل الطلب أو الموعد" : "Order note or meeting info"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingContact(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isAr ? "حفظ التعديلات" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? "إضافة جهة اتصال جديدة" : "Add New Contact"}</span>
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "رقم الهاتف (مع كود الدولة):" : "Phone Number (with Country Code):"} *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="201012345678"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "الاسم:" : "Name:"}
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder={isAr ? "أحمد محمد" : "John Doe"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "الشركة / المتجر:" : "Company:"}
                </label>
                <input
                  type="text"
                  value={addForm.company}
                  onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                  placeholder={isAr ? "شركة الأمل" : "Acme Corp"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "مجموعة الأرقام:" : "Group Name:"}
                </label>
                <input
                  type="text"
                  list="groups-list"
                  value={addForm.groupName}
                  onChange={(e) => setAddForm({ ...addForm, groupName: e.target.value })}
                  placeholder={isAr ? "مثال: عملاء VIP أو عام" : "e.g. VIP Leads"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isAr ? "الملاحظات أو التفاصيل:" : "Notes / Details:"}
                </label>
                <textarea
                  rows={2}
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder={isAr ? "تفاصيل الطلب أو الموعد" : "Order note or meeting info"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAr ? "إضافة للقائمة" : "Add to List"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Datalist for existing groups */}
      <datalist id="groups-list">
        {existingGroups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {/* Upload Batch Confirmation & Automated Duplicate Inspection Modal */}
      {pendingUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr ? "فحص وتأكيد استيراد جهات الاتصال" : "Verify & Import Contacts"}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? "فحص آلي شامل لمنع تكرار الأرقام في الحملات والـ CRM"
                      : "Automated duplicate detection across campaigns & CRM"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingUpload(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* Automated Duplicate Checker Result Banner */}
              {!pendingUpload.duplicateAnalysis.hasDuplicates ? (
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-1 text-xs text-emerald-300">
                  <div className="flex items-center gap-2 font-semibold text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {isAr
                        ? "تم الفحص الآلي بنجاح: الملف نظيف 100% ولا يحتوي على أي أرقام مكررة"
                        : "Automated check passed: No duplicates found (100% clean)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                    {isAr
                      ? `تم فحص جميع الأرقام (${pendingUpload.contacts.length} رقم) ومطابقتها مع الحملة الحالية وعملاء الـ CRM. جميع الأرقام فريدة وجاهزة للإضافة بأمان.`
                      : `All ${pendingUpload.contacts.length} numbers checked against current campaign and CRM. All records are unique and safe to add.`}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-amber-200">
                        {isAr
                          ? `تنبيه: تم اكتشاف ${pendingUpload.duplicateAnalysis.totalDuplicatesFound} رقم مكرر في الملف!`
                          : `Warning: Detected ${pendingUpload.duplicateAnalysis.totalDuplicatesFound} duplicate numbers!`}
                      </h5>
                      <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                        {isAr
                          ? "لحماية حملتك من إرسال رسائل مكررة لنفس الشخص، قام نظام الفحص باعتراض الأرقام المكررة وحمايتها من التكرار."
                          : "To protect your campaign from sending duplicate messages, existing numbers have been intercepted."}
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-slate-950/70 border border-emerald-500/30 rounded-lg p-2 text-center">
                      <span className="block text-emerald-400 text-base font-bold">
                        {pendingUpload.duplicateAnalysis.uniqueNewCount}
                      </span>
                      <span className="text-[10px] text-emerald-300">
                        {isAr ? "أرقام جديدة فريدة" : "New Unique Numbers"}
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-amber-500/30 rounded-lg p-2 text-center">
                      <span className="block text-amber-400 text-base font-bold">
                        {pendingUpload.duplicateAnalysis.currentCampaignDuplicatesCount}
                      </span>
                      <span className="text-[10px] text-amber-300">
                        {isAr ? "في الحملة الحالية" : "In Current Campaign"}
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-blue-500/30 rounded-lg p-2 text-center">
                      <span className="block text-blue-400 text-base font-bold">
                        {pendingUpload.duplicateAnalysis.selfDuplicatesCount}
                      </span>
                      <span className="text-[10px] text-blue-300">
                        {isAr ? "مكرر داخل الملف" : "Duplicate In File"}
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-purple-500/30 rounded-lg p-2 text-center">
                      <span className="block text-purple-400 text-base font-bold">
                        {pendingUpload.duplicateAnalysis.crmDuplicatesCount +
                          pendingUpload.duplicateAnalysis.otherCampaignDuplicatesCount}
                      </span>
                      <span className="text-[10px] text-purple-300">
                        {isAr ? "في الـ CRM / حملات" : "In CRM / Campaigns"}
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Handling Options */}
                  <div className="space-y-2 pt-2 border-t border-amber-500/20">
                    <span className="block text-[11px] font-semibold text-slate-300">
                      {isAr ? "خيارات التعامل مع الأرقام المكررة:" : "Duplicate Handling Mode:"}
                    </span>

                    <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 hover:border-emerald-500/40 transition">
                      <input
                        type="radio"
                        name="dup-action"
                        checked={pendingUpload.duplicateAction === "skip"}
                        onChange={() =>
                          setPendingUpload({ ...pendingUpload, duplicateAction: "skip" })
                        }
                        className="accent-emerald-500 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-emerald-400 block">
                          {isAr
                            ? `تخطي الأرقام المكررة وحظر التكرار (إضافة الـ ${pendingUpload.duplicateAnalysis.uniqueNewCount} رقم الجديدة فقط - مستحسن)`
                            : `Skip duplicates & add only ${pendingUpload.duplicateAnalysis.uniqueNewCount} new unique numbers (Recommended)`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isAr
                            ? "يمنع تماماً إضافة أي رقم موجود مسبقاً لضمان عدم وصول رسائل مكررة لنفس العميل."
                            : "Prevents adding duplicate records to avoid sending repeated messages."}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 hover:border-emerald-500/40 transition">
                      <input
                        type="radio"
                        name="dup-action"
                        checked={pendingUpload.duplicateAction === "update"}
                        onChange={() =>
                          setPendingUpload({ ...pendingUpload, duplicateAction: "update" })
                        }
                        className="accent-emerald-500 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-slate-300 block">
                          {isAr
                            ? "تحديث بيانات الأرقام الموجودة (دون مضاعفة السجلات)"
                            : "Update existing contacts data without duplicating records"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isAr
                            ? "تحديث أسماء وملاحظات جهات الاتصال المسجلة وإضافة الأرقام الجديدة."
                            : "Updates names/notes for existing contacts and appends new ones."}
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Collapsible Duplicate Details Drawer */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingUpload({
                          ...pendingUpload,
                          showDetails: !pendingUpload.showDetails,
                        })
                      }
                      className="w-full flex items-center justify-between text-xs text-amber-300 hover:text-amber-200 py-1 font-medium transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        <span>
                          {isAr
                            ? `معاينة قائمة الأرقام المكررة وأسباب الاستبعاد (${pendingUpload.duplicateAnalysis.duplicateDetails.length})`
                            : `View duplicate details (${pendingUpload.duplicateAnalysis.duplicateDetails.length})`}
                        </span>
                      </span>
                      {pendingUpload.showDetails ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {pendingUpload.showDetails && (
                      <div className="mt-2 max-h-44 overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 p-2 space-y-1.5 text-xs">
                        {pendingUpload.duplicateAnalysis.duplicateDetails.map((dup, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px]"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-white dir-ltr">
                                  +{dup.normalizedPhone}
                                </span>
                                {dup.incomingContact.name && (
                                  <span className="text-slate-300">
                                    ({dup.incomingContact.name})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-amber-400/90 block">
                                {isAr ? dup.reasonAr : dup.reasonEn}
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-red-950/60 text-red-400 border border-red-500/30">
                              {pendingUpload.duplicateAction === "skip"
                                ? isAr
                                  ? "مستبعد"
                                  : "Skipped"
                                : isAr
                                ? "تحديث"
                                : "Update"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Group Configuration */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAr ? "اسم المجموعة (لتنظيم وإدارة الأرقام):" : "Group Name:"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={pendingUpload.suggestedGroupName}
                    onChange={(e) =>
                      setPendingUpload({ ...pendingUpload, suggestedGroupName: e.target.value })
                    }
                    placeholder={isAr ? "مثال: عملاء معرض القاهرة" : "e.g. Cairo Exhibition"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="upload-mode"
                      checked={!pendingUpload.replaceExisting}
                      onChange={() =>
                        setPendingUpload({ ...pendingUpload, replaceExisting: false })
                      }
                      className="accent-emerald-500"
                    />
                    <span>
                      {isAr
                        ? "إضافة كمجموعة جديدة (الحفاظ على الأرقام السابقة)"
                        : "Append as new group (Keep existing contacts)"}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="upload-mode"
                      checked={pendingUpload.replaceExisting}
                      onChange={() =>
                        setPendingUpload({ ...pendingUpload, replaceExisting: true })
                      }
                      className="accent-emerald-500"
                    />
                    <span>
                      {isAr
                        ? "استبدال جميع الأرقام الحالية بهذه المجموعة فقط"
                        : "Replace all existing contacts with this group"}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400">
                {isAr
                  ? `الإجمالي المطلوب إضافته: ${
                      pendingUpload.duplicateAction === "skip"
                        ? pendingUpload.duplicateAnalysis.uniqueNewCount
                        : pendingUpload.contacts.length
                    } رقم`
                  : `Total to import: ${
                      pendingUpload.duplicateAction === "skip"
                        ? pendingUpload.duplicateAnalysis.uniqueNewCount
                        : pendingUpload.contacts.length
                    } numbers`}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingUpload(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  disabled={
                    pendingUpload.duplicateAction === "skip" &&
                    pendingUpload.duplicateAnalysis.uniqueNewCount === 0
                  }
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {isAr
                      ? `تأكيد واستيراد (${
                          pendingUpload.duplicateAction === "skip"
                            ? pendingUpload.duplicateAnalysis.uniqueNewCount
                            : pendingUpload.contacts.length
                        } رقم)`
                      : `Confirm & Import (${
                          pendingUpload.duplicateAction === "skip"
                            ? pendingUpload.duplicateAnalysis.uniqueNewCount
                            : pendingUpload.contacts.length
                        })`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deduplicate Existing Campaign Contacts Modal */}
      {deduplicateModalState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr ? "تنظيف الأرقام المكررة في الحملة" : "Clean Duplicate Campaign Contacts"}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? `تم العثور على ${deduplicateModalState.totalDuplicateRows} تكرار عبر ${deduplicateModalState.duplicates.length} رقم مختلف`
                      : `Found ${deduplicateModalState.totalDuplicateRows} duplicates across ${deduplicateModalState.duplicates.length} numbers`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeduplicateModalState(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200">
              {isAr
                ? "سيتم دمج الأرقام المكررة في جهة اتصال واحدة فريدة، وتوحيد الملاحظات، وإزالة السجلات الزائدة لمنع إرسال رسائل مكررة."
                : "Duplicate records will be merged into a single unique contact, removing duplicates to prevent repeated messages."}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {deduplicateModalState.duplicates.map((dup, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-white dir-ltr">
                        +{dup.phone}
                      </span>
                      {dup.names.length > 0 && (
                        <span className="text-slate-300">({dup.names.join(", ")})</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isAr ? "المجموعات:" : "Groups:"} {dup.groups.join("، ")}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                    {isAr ? `مكرر ${dup.count} مرات` : `${dup.count} entries`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                {isAr
                  ? `سيتم إزالة ${deduplicateModalState.totalDuplicateRows} سجل زائد`
                  : `Will remove ${deduplicateModalState.totalDuplicateRows} redundant rows`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeduplicateModalState(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeduplicateContacts}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {isAr
                      ? `دمج وإزالة ${deduplicateModalState.totalDuplicateRows} تكرار الآن`
                      : `Merge & Clean Duplicates Now`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Group Modal */}
      {renameGroupState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                <span>{isAr ? "تعديل اسم المجموعة" : "Rename Group"}</span>
              </h4>
              <button
                onClick={() => setRenameGroupState(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isAr ? "الاسم الجديد للمجموعة:" : "New Group Name:"}
              </label>
              <input
                type="text"
                value={renameGroupState.newName}
                onChange={(e) =>
                  setRenameGroupState({ ...renameGroupState, newName: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenameGroupState(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onRenameGroup && renameGroupState.newName.trim()) {
                    onRenameGroup(renameGroupState.oldName, renameGroupState.newName.trim());
                    if (selectedGroupTab === renameGroupState.oldName) {
                      setSelectedGroupTab(renameGroupState.newName.trim());
                    }
                  }
                  setRenameGroupState(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isAr ? "حفظ الاسم" : "Save"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Action Confirmation Modal (Reset or Delete) */}
      {confirmGroupAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
              confirmGroupAction.type === "delete"
                ? "bg-red-500/10 border border-red-500/30 text-red-400"
                : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
            }`}>
              {confirmGroupAction.type === "delete" ? <Trash2 className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {confirmGroupAction.type === "delete"
                  ? (isAr ? `حذف مجموعة "${confirmGroupAction.groupName}"؟` : `Delete group "${confirmGroupAction.groupName}"?`)
                  : (isAr ? `إعادة تعيين أرقام مجموعة "${confirmGroupAction.groupName}"؟` : `Reset contacts in "${confirmGroupAction.groupName}"?`)}
              </h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {confirmGroupAction.type === "delete"
                  ? (isAr ? "سيتم حذف هذه المجموعة وجميع الأرقام التابعة لها بالكامل." : "All contacts in this group will be permanently removed.")
                  : (isAr ? "سيتم إعادة تعيين حالة جميع أرقام المجموعة إلى قيد الانتظار." : "All contacts in this group will be marked as pending.")}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (confirmGroupAction.type === "delete" && onDeleteGroup) {
                    onDeleteGroup(confirmGroupAction.groupName);
                    setSelectedGroupTab("all");
                  } else if (confirmGroupAction.type === "reset" && onResetGroup) {
                    onResetGroup(confirmGroupAction.groupName);
                  }
                  setConfirmGroupAction(null);
                }}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  confirmGroupAction.type === "delete"
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
                    : "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30"
                }`}
              >
                {confirmGroupAction.type === "delete" ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>{confirmGroupAction.type === "delete" ? (isAr ? "نعم، حذف المجموعة" : "Yes, Delete") : (isAr ? "نعم، إعادة التعيين" : "Yes, Reset")}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmGroupAction(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
