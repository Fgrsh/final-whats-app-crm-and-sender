import React, { useState, useEffect } from "react";
import {
  X,
  QrCode,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Info,
  Plus,
  Trash2,
  LogOut,
  Layers,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import type { WhatsAppStatus, WhatsAppAccountInfo } from "../types.ts";

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  waStatus: WhatsAppStatus | null;
  accounts?: WhatsAppAccountInfo[];
  activeAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onConnectAccount?: (accountId: string, phone?: string) => Promise<void>;
  onDisconnectAccount?: (accountId: string) => Promise<void>;
  onCreateAccount?: (name: string, phone?: string, autoConnect?: boolean) => Promise<any>;
  onDeleteAccount?: (accountId: string) => Promise<void>;
  onConnect: (phone?: string) => void;
  onDisconnect: () => void;
  language: "ar" | "en";
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  waStatus,
  accounts = [],
  activeAccountId = "default",
  onSelectAccount,
  onConnectAccount,
  onDisconnectAccount,
  onCreateAccount,
  onDeleteAccount,
  onConnect,
  onDisconnect,
  language,
}) => {
  const isAr = language === "ar";
  const [selectedAccId, setSelectedAccId] = useState<string>(activeAccountId || "default");
  const [activeTab, setActiveTab] = useState<"connect" | "accounts" | "add_new">("connect");

  // Linking state
  const [method, setMethod] = useState<"qr" | "code">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New account form state
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountMethod, setNewAccountMethod] = useState<"qr" | "code">("qr");
  const [newAccountPhone, setNewAccountPhone] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Keep selected account in sync
  useEffect(() => {
    if (activeAccountId && accounts.some((a) => a.id === activeAccountId)) {
      setSelectedAccId(activeAccountId);
    } else if (accounts.length > 0 && !accounts.some((a) => a.id === selectedAccId)) {
      setSelectedAccId(accounts[0].id);
    }
  }, [activeAccountId, accounts]);

  // Find currently selected account data
  const selectedAccount = accounts.find((a) => a.id === selectedAccId) || {
    id: "default",
    name: isAr ? "الحساب الرئيسي 1" : "Main Account 1",
    status: waStatus?.status || "DISCONNECTED",
    qrCodeDataUrl: waStatus?.qrCode || null,
    pairingCode: waStatus?.pairingCode || null,
    user: waStatus?.user || null,
    lastError: waStatus?.lastError || null,
  };

  const isConnected = selectedAccount.status === "CONNECTED";
  const isConnecting = selectedAccount.status === "CONNECTING";

  // Actions for selected account
  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;
    setIsSubmitting(true);
    try {
      if (onConnectAccount) {
        await onConnectAccount(selectedAccId, phoneNumber.trim());
      } else {
        await onConnect(phoneNumber.trim());
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectSelected = async () => {
    setIsSubmitting(true);
    try {
      if (onConnectAccount) {
        await onConnectAccount(selectedAccId);
      } else {
        await onConnect();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnectSelected = async () => {
    if (onDisconnectAccount) {
      await onDisconnectAccount(selectedAccId);
    } else {
      await onDisconnect();
    }
  };

  // Action: Create and immediately connect a new account
  const handleCreateAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName =
      newAccountName.trim() ||
      (isAr ? `حساب واتساب (${accounts.length + 1})` : `WhatsApp Account (${accounts.length + 1})`);

    setIsCreating(true);
    try {
      if (onCreateAccount) {
        const phone = newAccountMethod === "code" ? newAccountPhone.trim() : undefined;
        const newAcc = await onCreateAccount(finalName, phone, true);
        if (newAcc && newAcc.id) {
          setSelectedAccId(newAcc.id);
          if (onSelectAccount) onSelectAccount(newAcc.id);
        }
      }
      setNewAccountName("");
      setNewAccountPhone("");
      setActiveTab("connect");
    } catch (err) {
      console.error("Failed to create and connect account:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // Delete Confirmation state (no window.confirm to avoid iframe blocking)
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Action: Request delete/wipe account
  const handleRequestDelete = (accId: string, accName?: string) => {
    const acc = accounts.find((a) => a.id === accId);
    setAccountToDelete({
      id: accId,
      name: accName || acc?.name || (accId === "default" ? (isAr ? "الحساب الرئيسي 1" : "Main Account 1") : accId),
    });
  };

  const handleExecuteDelete = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    const accId = accountToDelete.id;
    const accName = accountToDelete.name;
    try {
      if (onDeleteAccount) {
        await onDeleteAccount(accId);
      } else {
        await fetch(`/api/whatsapp/accounts/${accId}`, { method: "DELETE" });
      }
      setDeleteNotice(
        accId === "default"
          ? (isAr ? "تم مسح جلسة الرقم الرئيسي وإعادة التهيئة بنجاح" : "Main session reset successfully")
          : (isAr ? `تم حذف الحساب "${accName}" ومسح جلسته بنجاح` : `Account "${accName}" deleted successfully`)
      );
      setTimeout(() => setDeleteNotice(null), 3500);

      if (selectedAccId === accId) {
        const remaining = accounts.filter((a) => a.id !== accId);
        const nextId = remaining[0]?.id || "default";
        setSelectedAccId(nextId);
        if (onSelectAccount) onSelectAccount(nextId);
      }
      setAccountToDelete(null);
    } catch (err) {
      console.error("Failed to delete account:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Delete Confirmation Overlay Dialog */}
        {accountToDelete && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {accountToDelete.id === "default"
                    ? (isAr ? "مسح جلسة الرقم الرئيسي؟" : "Reset Main Account Session?")
                    : (isAr ? "تأكيد حذف الحساب نهائياً؟" : "Confirm Account Deletion?")}
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {accountToDelete.id === "default"
                    ? (isAr
                        ? `سيتم تسجيل الخروج ومسح ملفات جلسة الواتساب للحساب "${accountToDelete.name}" بالكامل لتتمكن من ربط رقم جديد.`
                        : `This will disconnect and wipe session files for "${accountToDelete.name}" so you can link a fresh number.`)
                    : (isAr
                        ? `هل أنت متأكد من حذف "${accountToDelete.name}" ومسح الجلسة وكافة بيانات الربط نهائياً؟`
                        : `Are you sure you want to permanently delete "${accountToDelete.name}" and remove its WhatsApp session?`)}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  id="confirm-delete-account-btn"
                  onClick={handleExecuteDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30"
                >
                  {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>{isAr ? "نعم، مسح وحذف" : "Yes, Delete & Wipe"}</span>
                </button>
                <button
                  id="cancel-delete-account-btn"
                  onClick={() => setAccountToDelete(null)}
                  disabled={isDeleting}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{isAr ? "إدارة حسابات وأرقام واتساب" : "WhatsApp Accounts Hub"}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  {accounts.length || 1} {isAr ? "أرقام" : "Numbers"}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "ربط وتشغيل أكثر من رقم واتساب في نفس الوقت لإرسال حملات متعددة"
                  : "Connect multiple numbers and run concurrent campaigns"}
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

        {/* Navigation Tabs between Linking, Accounts List, and Add New */}
        <div className="px-6 pt-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
            {/* Tab: Link current */}
            <button
              onClick={() => setActiveTab("connect")}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === "connect"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{isAr ? "ربط الحساب الحالي" : "Link Account"}</span>
              {isConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
              )}
            </button>

            {/* Tab: Accounts list */}
            <button
              onClick={() => setActiveTab("accounts")}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === "accounts"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? `قائمة الحسابات (${accounts.length || 1})`
                  : `All Accounts (${accounts.length || 1})`}
              </span>
            </button>

            {/* Tab: Add new number */}
            <button
              onClick={() => setActiveTab("add_new")}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === "add_new"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? "+ إضافة رقم جديد" : "+ Add New Number"}</span>
            </button>
          </div>
        </div>

        {/* Delete notification banner */}
        {deleteNotice && (
          <div className="mx-6 mt-3 p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{deleteNotice}</span>
            </div>
            <button onClick={() => setDeleteNotice(null)} className="text-emerald-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: ADD NEW NUMBER / ACCOUNT FORM (EXACTLY LIKE MAIN ACCOUNT) */}
          {activeTab === "add_new" && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="border-b border-slate-800 pb-3">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>{isAr ? "إضافة وربط رقم واتساب جديد" : "Add & Link New WhatsApp Number"}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {isAr
                      ? "أدخل اسم الحساب واختر طريقة الربط (مسح باركود QR أو كود الربط المباشر برقم الهاتف) لربطه فوراً بجهازك الثاني."
                      : "Choose connection method (QR code scan or direct Pairing Code with phone) to link immediately."}
                  </p>
                </div>

                <form onSubmit={handleCreateAndConnect} className="space-y-4">
                  {/* Account Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {isAr ? "اسم الحساب / التسمية التوضيحية:" : "Account Name / Label:"}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        isAr
                          ? `مثال: حساب المبيعات ${accounts.length + 1}`
                          : `e.g. Sales WhatsApp #${accounts.length + 1}`
                      }
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                    />
                  </div>

                  {/* Method Choice */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {isAr ? "طريقة الربط المطلوبة:" : "Connection Method:"}
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setNewAccountMethod("qr")}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg transition ${
                          newAccountMethod === "qr"
                            ? "bg-emerald-600 text-white shadow font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>{isAr ? "مسح رمز QR" : "Scan QR"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewAccountMethod("code")}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg transition ${
                          newAccountMethod === "code"
                            ? "bg-emerald-600 text-white shadow font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>{isAr ? "كود الربط برقم الهاتف" : "Pairing Code"}</span>
                      </button>
                    </div>
                  </div>

                  {/* If Pairing Code: Phone input */}
                  {newAccountMethod === "code" && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <label className="block text-xs font-medium text-slate-300">
                        {isAr
                          ? "رقم الهاتف الدولي (بدون + أو أصفار):"
                          : "International Phone Number (no +):"}
                      </label>
                      <input
                        type="text"
                        placeholder={isAr ? "مثال: 201012345678" : "e.g. 201279953345"}
                        value={newAccountPhone}
                        onChange={(e) => setNewAccountPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        required={newAccountMethod === "code"}
                      />
                      <p className="text-[11px] text-slate-400">
                        {isAr
                          ? "سيتم إرسال كود من 8 خانات لتأكيده في تطبيق واتساب بالهاتف الثاني."
                          : "An 8-digit code will be generated to enter in WhatsApp on your second phone."}
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("accounts")}
                      className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                    >
                      {isAr ? "إلغاء" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating || (newAccountMethod === "code" && !newAccountPhone.trim())}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
                    >
                      {isCreating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{isAr ? "جاري تهيئة الحساب..." : "Initializing..."}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {newAccountMethod === "qr"
                              ? isAr
                                ? "إنشاء وتوليد رمز QR"
                                : "Create & Generate QR"
                              : isAr
                              ? "إنشاء وطلب كود الربط"
                              : "Create & Get Pairing Code"}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: ACCOUNTS LIST */}
          {activeTab === "accounts" && (
            <div className="space-y-4">
              {/* Header inside accounts list */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {isAr ? "الأرقام والحسابات المضافة:" : "Configured WhatsApp Accounts:"}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? "يمكنك ربط أي رقم، التبديل بينها، أو تعيين كل رقم لحملة معينة."
                      : "Manage sessions, connect/disconnect, and assign to campaigns."}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("add_new")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? "إضافة رقم جديد" : "Add Number"}</span>
                </button>
              </div>

              {/* Accounts cards */}
              <div className="space-y-2.5">
                {(accounts.length > 0
                  ? accounts
                  : [
                      {
                        id: "default",
                        name: isAr ? "الحساب الرئيسي 1" : "Main Account 1",
                        status: waStatus?.status || "DISCONNECTED",
                        user: waStatus?.user,
                      } as WhatsAppAccountInfo,
                    ]
                ).map((acc) => {
                  const isAccConn = acc.status === "CONNECTED";
                  const isAccConnecting = acc.status === "CONNECTING";
                  const isSelected = acc.id === selectedAccId;

                  return (
                    <div
                      key={acc.id}
                      className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-slate-800/80 border-emerald-500/50 shadow-md shadow-emerald-500/5"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isAccConn
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isAccConnecting
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{acc.name}</span>
                            {isAccConn ? (
                              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {isAr ? "متصل" : "Connected"}
                              </span>
                            ) : isAccConnecting ? (
                              <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                {isAr ? "جاري الاتصال..." : "Connecting..."}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                                {isAr ? "غير متصل" : "Disconnected"}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {acc.user?.name || acc.user?.phone || acc.phone || (isAr ? "لم يتم الربط بعد" : "Not linked")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedAccId(acc.id);
                            if (onSelectAccount) onSelectAccount(acc.id);
                            setActiveTab("connect");
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow"
                              : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                          }`}
                        >
                          <span>{isAccConn ? (isAr ? "عرض التفاصيل" : "View") : (isAr ? "ربط هذا الرقم" : "Link")}</span>
                          <ArrowRight className="w-3 h-3 rotate-180" />
                        </button>

                        <button
                          id={`delete-acc-btn-${acc.id}`}
                          onClick={() => handleRequestDelete(acc.id, acc.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 transition cursor-pointer"
                          title={
                            acc.id === "default"
                              ? (isAr ? "مسح جلسة الرقم وإعادة تهيئة الحساب الرئيسي" : "Reset & wipe main session")
                              : (isAr ? "حذف هذا الحساب نهائياً" : "Delete this account")
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CONNECT / LINK CURRENT SELECTED ACCOUNT */}
          {activeTab === "connect" && (
            <div className="space-y-4">
              {/* Account Selector Strip */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-xs text-slate-400 whitespace-nowrap pl-1">
                    {isAr ? "الرقم المختار:" : "Active Number:"}
                  </span>
                  {(accounts.length > 0
                    ? accounts
                    : [
                        {
                          id: "default",
                          name: isAr ? "الحساب الرئيسي 1" : "Main Account 1",
                          status: waStatus?.status || "DISCONNECTED",
                        } as any,
                      ]
                  ).map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccId(acc.id);
                        if (onSelectAccount) onSelectAccount(acc.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                        acc.id === selectedAccId
                          ? "bg-emerald-600 text-white font-bold shadow-sm"
                          : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          acc.status === "CONNECTED" ? "bg-emerald-300" : "bg-slate-500"
                        }`}
                      />
                      <span>{acc.name}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setActiveTab("add_new")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-500/10 transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isAr ? "+ رقم إضافي" : "+ New"}</span>
                </button>
              </div>

              {isConnected ? (
                <div className="text-center py-6 space-y-4 bg-slate-950/40 rounded-2xl border border-emerald-500/30 p-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 animate-pulse">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">
                      {selectedAccount.name}: {isAr ? "متصل وجاهز للإرسال!" : "Connected & Ready!"}
                    </h4>
                    <p className="text-sm text-slate-300 mt-1 flex items-center justify-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>{selectedAccount.user?.name || (isAr ? "مستخدم واتساب" : "WhatsApp User")}</span>
                      {selectedAccount.user?.phone ? (
                        <span className="font-mono text-emerald-300">({selectedAccount.user.phone})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {isAr
                        ? "جلسة هذا الرقم محفوظة ومسجلة بالسيرفر، ويمكنك استخدامه في إرسال أي حملة تسويقية."
                        : "Session is active and saved. You can use it to send campaigns."}
                    </p>
                  </div>

                  <div className="pt-3 flex justify-center gap-2.5 flex-wrap">
                    <button
                      onClick={handleDisconnectSelected}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isAr ? "فصل مؤقت" : "Disconnect"}</span>
                    </button>
                    <button
                      id="wipe-session-connected-btn"
                      onClick={() => handleRequestDelete(selectedAccount.id, selectedAccount.name)}
                      className="px-3.5 py-2 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-xl hover:bg-rose-900/50 transition flex items-center gap-1.5"
                      title={
                        selectedAccount.id === "default"
                          ? (isAr ? "مسح الجلسة والبدء من جديد" : "Reset session")
                          : (isAr ? "حذف الحساب نهائياً" : "Delete Account")
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {selectedAccount.id === "default"
                          ? (isAr ? "مسح الجلسة وإعادة التهيئة" : "Reset Session")
                          : (isAr ? "مسح وحذف الحساب" : "Delete Account")}
                      </span>
                    </button>
                    <button
                      onClick={onClose}
                      className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 transition shadow-md shadow-emerald-600/30"
                    >
                      {isAr ? "إغلاق النافذة" : "Done"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Method Switcher */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setMethod("qr")}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg transition ${
                        method === "qr" ? "bg-emerald-600 text-white shadow font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>{isAr ? "مسح رمز QR" : "Scan QR Code"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("code")}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg transition ${
                        method === "code" ? "bg-emerald-600 text-white shadow font-bold" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{isAr ? "كود الربط برقم الهاتف" : "Pairing Code"}</span>
                    </button>
                  </div>

                  {/* QR Mode */}
                  {method === "qr" && (
                    <div className="flex flex-col items-center justify-center space-y-4">
                      {selectedAccount.qrCodeDataUrl ? (
                        <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-emerald-500/40 relative group">
                          <img
                            src={selectedAccount.qrCodeDataUrl}
                            alt="WhatsApp QR Code"
                            className="w-56 h-56 object-contain rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="w-56 h-56 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center p-4">
                          {isConnecting ? (
                            <>
                              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                              <p className="text-xs text-slate-300 font-medium">
                                {isAr ? "جاري توليد رمز الباركود..." : "Generating QR code..."}
                              </p>
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-8 h-8 text-slate-500 mb-3" />
                              <p className="text-xs text-slate-400 mb-3">
                                {isAr
                                  ? `اضغط أدناه لبدء الاتصال وتوليد رمز QR لـ: ${selectedAccount.name}`
                                  : "Click below to initialize QR connection"}
                              </p>
                              <button
                                onClick={handleConnectSelected}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5"
                              >
                                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>{isAr ? "توليد الرمز الآن" : "Generate QR"}</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {selectedAccount.qrCodeDataUrl && (
                        <button
                          onClick={handleConnectSelected}
                          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{isAr ? "تحديث رمز QR" : "Refresh QR Code"}</span>
                        </button>
                      )}

                      {/* Instructions */}
                      <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
                        <div className="font-semibold text-white flex items-center gap-1.5 mb-1 text-emerald-400">
                          <Info className="w-3.5 h-3.5" />
                          <span>{isAr ? "طريقة المسح من هاتفك:" : "How to link:"}</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
                          <li>{isAr ? "افتح تطبيق WhatsApp على هاتفك" : "Open WhatsApp on your phone"}</li>
                          <li>
                            {isAr
                              ? "توجه إلى الإعدادات > الأجهزة المرتبطة (Linked Devices)"
                              : "Tap Settings > Linked Devices"}
                          </li>
                          <li>
                            {isAr
                              ? "اضغط على 'ربط جهاز' ووجه كاميرا الهاتف نحو الرمز أعلاه"
                              : "Tap 'Link a Device' and point camera at QR"}
                          </li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* Pairing Code Mode */}
                  {method === "code" && (
                    <div className="space-y-4">
                      <form onSubmit={handleRequestPairing} className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1.5">
                            {isAr
                              ? "رقم هاتفك مع كود الدولة (بدون + أو أصفار):"
                              : "Your WhatsApp Phone with Country Code (no +):"}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder={isAr ? "مثال: 201012345678" : "e.g. 14155552671"}
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                            />
                            <button
                              type="submit"
                              disabled={isSubmitting || !phoneNumber.trim()}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                            >
                              {isSubmitting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : isAr ? (
                                "طلب الكود"
                              ) : (
                                "Get Code"
                              )}
                            </button>
                          </div>
                        </div>
                      </form>

                      {selectedAccount.pairingCode && (
                        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center space-y-2">
                          <p className="text-xs text-emerald-300">
                            {isAr ? "أدخل هذا الكود في تطبيق واتساب بهاتفك:" : "Enter this pairing code in WhatsApp:"}
                          </p>
                          <div className="text-2xl font-mono font-bold tracking-widest text-emerald-400 bg-slate-950 py-2.5 px-4 rounded-lg border border-emerald-500/30 select-all">
                            {selectedAccount.pairingCode}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {isAr
                              ? "الأجهزة المرتبطة > ربط برقم الهاتف بدلاً من ذلك"
                              : "Linked Devices > Link with phone number instead"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Message display if any */}
                  {selectedAccount.lastError && (
                    <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-300">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{isAr ? "ملاحظة الاتصال:" : "Notice:"} </span>
                        {selectedAccount.lastError}
                      </div>
                    </div>
                  )}

                  {/* Clean reset / wipe option */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs">
                    <button
                      type="button"
                      id="wipe-session-disconnected-btn"
                      onClick={() => handleRequestDelete(selectedAccount.id, selectedAccount.name)}
                      className="text-rose-400/80 hover:text-rose-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-rose-950/40 border border-transparent hover:border-rose-500/30 transition text-[11px] cursor-pointer"
                      title={
                        selectedAccount.id === "default"
                          ? (isAr ? "مسح ملفات الجلسة وإعادة التهيئة" : "Reset session files")
                          : (isAr ? "حذف الحساب نهائياً" : "Delete Account")
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {selectedAccount.id === "default"
                          ? (isAr ? "مسح ملفات الجلسة والبدء من جديد" : "Reset & wipe session")
                          : (isAr ? "حذف هذا الحساب نهائياً" : "Delete this account")}
                      </span>
                    </button>
                    <span className="text-[11px] text-slate-500">
                      {isAr ? "حالة الرقم: غير متصل" : "Status: Disconnected"}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
