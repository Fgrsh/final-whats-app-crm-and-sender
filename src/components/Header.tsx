import React from "react";
import { MessageSquare, QrCode, Sparkles, Smartphone, LogOut, Send, Globe, Layers, Database } from "lucide-react";
import type { WhatsAppStatus, WhatsAppAccountInfo } from "../types.ts";

interface HeaderProps {
  waStatus: WhatsAppStatus | null;
  accounts?: WhatsAppAccountInfo[];
  activeAccountId?: string;
  onOpenConnectModal: () => void;
  onOpenSingleSendModal: () => void;
  onOpenBackupModal?: () => void;
  onDisconnect: () => void;
  language: "ar" | "en";
  onToggleLanguage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  waStatus,
  accounts = [],
  activeAccountId,
  onOpenConnectModal,
  onOpenSingleSendModal,
  onOpenBackupModal,
  onDisconnect,
  language,
  onToggleLanguage,
}) => {
  const isAr = language === "ar";
  const connectedAccounts = accounts.filter((a) => a.status === "CONNECTED");
  const isConnected = waStatus?.status === "CONNECTED" || connectedAccounts.length > 0;
  const isConnecting = waStatus?.status === "CONNECTING";

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                {isAr ? "مرسل واتساب الذكي" : "WhatsApp AI Sender"}
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Gemini AI
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isAr
                ? "حملات ذكية • نظام CRM وسحب ليدز • متابعة فورية"
                : "Smart Campaigns • CRM & Lead Extraction • Real-time Follow-up"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Language Toggle */}
          <button
            id="lang-toggle-btn"
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition border border-slate-700/60"
            title="تبديل اللغة / Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{isAr ? "English" : "العربية"}</span>
          </button>

          {/* Single Test Send Button */}
          <button
            id="test-single-btn"
            onClick={onOpenSingleSendModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition border border-slate-700/60"
          >
            <Send className="w-3.5 h-3.5 text-teal-400" />
            <span>{isAr ? "تجربة إرسال رقم مفرد" : "Test Single Send"}</span>
          </button>

          {/* Full System Backup & Restore Button */}
          {onOpenBackupModal && (
            <button
              id="system-backup-btn"
              onClick={onOpenBackupModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/60 transition border border-indigo-700/50"
              title={isAr ? "النسخ الاحتياطي واستعادة البيانات بالكامل" : "Full System Backup & Restore"}
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isAr ? "نسخة احتياطية واستعادة" : "Backup & Restore"}</span>
            </button>
          )}

          {/* WhatsApp Connection Status Badge & Button */}
          {isConnected ? (
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs text-emerald-200">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <button
                onClick={onOpenConnectModal}
                className="font-semibold text-white hover:text-emerald-300 transition flex items-center gap-1.5"
                title={isAr ? "إدارة حسابات واتساب" : "Manage Accounts"}
              >
                <span>
                  {connectedAccounts.length > 1
                    ? isAr
                      ? `${connectedAccounts.length} أرقام واتساب متصلة`
                      : `${connectedAccounts.length} WhatsApp accounts`
                    : waStatus?.user?.name || waStatus?.user?.phone || (isAr ? "واتساب متصل" : "WhatsApp Connected")}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  {isAr ? "إدارة" : "Manage"}
                </span>
              </button>
              <button
                id="disconnect-wa-btn"
                onClick={onDisconnect}
                className="text-slate-400 hover:text-red-400 transition ml-1 p-0.5"
                title={isAr ? "فصل الاتصال" : "Disconnect"}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isConnecting ? (
            <button
              id="connecting-wa-btn"
              onClick={onOpenConnectModal}
              className="flex items-center gap-2 bg-amber-950/60 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/60 transition"
            >
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{isAr ? "جاري الاتصال... افتح الباركود" : "Connecting... Open QR"}</span>
            </button>
          ) : (
            <button
              id="connect-wa-btn"
              onClick={onOpenConnectModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm shadow-emerald-600/30 transition"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{isAr ? "ربط واتساب (QR Code)" : "Connect WhatsApp (QR)"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
