import React, { useState, useEffect } from "react";
import { X, Send, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Smartphone } from "lucide-react";
import type { WhatsAppStatus, WhatsAppAccountInfo } from "../types.ts";

interface SingleSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  waStatus: WhatsAppStatus | null;
  accounts?: WhatsAppAccountInfo[];
  defaultAccountId?: string;
  onSendSingle: (phone: string, message: string, accountId?: string) => Promise<{ success: boolean; error?: string }>;
  language: "ar" | "en";
}

export const SingleSendModal: React.FC<SingleSendModalProps> = ({
  isOpen,
  onClose,
  waStatus,
  accounts = [],
  defaultAccountId,
  onSendSingle,
  language,
}) => {
  const isAr = language === "ar";
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    isAr ? "مرحباً! هذه رسالة تجريبية من نظام مرسل واتساب الذكي." : "Hello! This is a test message from WhatsApp AI Sender."
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultAccountId || "default");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (defaultAccountId) {
      setSelectedAccountId(defaultAccountId);
    } else if (accounts.length > 0) {
      const connected = accounts.find((a) => a.status === "CONNECTED");
      if (connected) setSelectedAccountId(connected.id);
      else setSelectedAccountId(accounts[0].id);
    }
  }, [defaultAccountId, accounts]);

  const isConnected = accounts.length > 0
    ? accounts.some((a) => a.status === "CONNECTED")
    : waStatus?.status === "CONNECTED";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !message) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await onSendSingle(phone, message, selectedAccountId);
      if (res.success) {
        setResult({
          success: true,
          message: isAr ? "تم إرسال الرسالة بنجاح!" : "Message sent successfully!",
        });
      } else {
        setResult({
          success: false,
          message: res.error || (isAr ? "فشل الإرسال" : "Failed to send"),
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || "خطأ غير متوقع",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {isAr ? "تجربة إرسال رسالة لرقم واحد" : "Test Single Send"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="p-6 space-y-4">
          {/* Account Selector */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isAr ? "الإرسال من حساب واتساب:" : "Send from WhatsApp Account:"}</span>
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                    {acc.status === "CONNECTED" ? "🟢" : "⚪"} {acc.name} {acc.phone ? `(${acc.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isAr ? "رقم الهاتف مع كود الدولة (مثال: 201012345678):" : "Phone with Country Code (e.g. 14155552671):"}
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={isAr ? "201012345678" : "14155552671"}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isAr ? "نص الرسالة:" : "Message text:"}
            </label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                result.success
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-red-950/40 border-red-500/30 text-red-300"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            {phone && (
              <a
                href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isAr ? "فتح في واتساب ويب" : "Open in Web"}</span>
              </a>
            )}

            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isLoading || !phone || !message || !isConnected}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow transition"
              >
                {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isAr ? "إرسال الآن" : "Send Now"}</span>
              </button>
            </div>
          </div>

          {!isConnected && (
            <p className="text-[11px] text-amber-400/90 text-center pt-1">
              {isAr
                ? "⚠️ زر الإرسال التلقائي يتطلب ربط الحساب أولاً، أو يمكنك استخدام رابط 'فتح في واتساب ويب'."
                : "⚠️ Direct send requires linking device first, or use 'Open in Web' link."}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
