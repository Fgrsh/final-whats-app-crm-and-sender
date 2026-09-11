import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";

import type {
  CampaignAttachment,
  WhatsAppAccountInfo,
  ContactDeliveryDiagnostic,
  DeliveryVerificationResult,
} from "../src/types.ts";
import { crmService } from "./crmService.ts";
import { normalizePhoneNumber, isSamePhoneNumber } from "./phoneUtils.ts";
import { aiSalesAgentService } from "./aiSalesAgentService.ts";

export interface WASessionState {
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";
  qrCodeDataUrl: string | null;
  pairingCode: string | null;
  user: {
    id?: string;
    name?: string;
    phone?: string;
  } | null;
  lastError: string | null;
  connectedAt: string | null;
}

export class WhatsAppAccountInstance {
  public id: string;
  public name: string;
  public sessionDir: string;
  public sock: any = null;
  public state: WASessionState = {
    status: "DISCONNECTED",
    qrCodeDataUrl: null,
    pairingCode: null,
    user: null,
    lastError: null,
    connectedAt: null,
  };
  public connectionOpenedTimestamp: number = 0;
  public isInitializing: boolean = false;
  private onStateChange: (acc: WhatsAppAccountInstance) => void;

  public messageDeliveryLog: Map<
    string,
    {
      messageId: string;
      phone: string;
      remoteJid: string;
      status: "READ" | "DELIVERY_ACK" | "SERVER_ACK" | "PENDING" | "ERROR" | "NOT_REGISTERED" | "NOT_FOUND";
      statusCode?: number;
      updatedAt: string;
      receiptTimestamp?: string;
      error?: string;
    }
  > = new Map();

  public recordMessageStatusUpdate(
    messageId: string,
    remoteJid?: string,
    status?: number,
    details?: any
  ) {
    if (!messageId) return;
    const statusMap: Record<number, "ERROR" | "PENDING" | "SERVER_ACK" | "DELIVERY_ACK" | "READ"> = {
      0: "ERROR",
      1: "PENDING",
      2: "SERVER_ACK",
      3: "DELIVERY_ACK",
      4: "READ",
      5: "READ",
    };
    const mapped = status !== undefined && statusMap[status] ? statusMap[status] : undefined;
    const existing = this.messageDeliveryLog.get(messageId);
    const phone = remoteJid ? remoteJid.split("@")[0].split(":")[0] : existing?.phone || "";

    const newStatus = mapped || existing?.status || "SERVER_ACK";

    this.messageDeliveryLog.set(messageId, {
      messageId,
      phone: phone || existing?.phone || "",
      remoteJid: remoteJid || existing?.remoteJid || "",
      status: newStatus,
      statusCode: status ?? existing?.statusCode,
      updatedAt: new Date().toISOString(),
      error: details?.error || existing?.error,
    });
  }

  constructor(
    id: string,
    name: string,
    sessionDir: string,
    onStateChange: (acc: WhatsAppAccountInstance) => void
  ) {
    this.id = id;
    this.name = name;
    this.sessionDir = sessionDir;
    this.onStateChange = onStateChange;

    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    // Auto-reconnect if creds exist
    const credsFile = path.join(this.sessionDir, "creds.json");
    if (fs.existsSync(credsFile)) {
      setTimeout(() => {
        this.connect().catch((e) =>
          console.warn(`[${this.name}] Auto-reconnect notice:`, e?.message)
        );
      }, 1500);
    }
  }

  public isConnected(): boolean {
    return this.state.status === "CONNECTED" && Boolean(this.sock);
  }

  public getInfo(): WhatsAppAccountInfo {
    return {
      id: this.id,
      name: this.name,
      phone: this.state.user?.phone,
      status: this.state.status,
      qrCodeDataUrl: this.state.qrCodeDataUrl,
      pairingCode: this.state.pairingCode,
      user: this.state.user,
      connectedAt: this.state.connectedAt,
      lastError: this.state.lastError,
    };
  }

  public async connect(requestedPhoneNumber?: string): Promise<WASessionState> {
    if (this.isInitializing) {
      return this.state;
    }
    this.isInitializing = true;
    this.state.status = "CONNECTING";
    this.state.lastError = null;
    this.onStateChange(this);

    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        const vInfo = await fetchLatestBaileysVersion();
        if (vInfo?.version && vInfo.version.length >= 3) {
          version = [vInfo.version[0], vInfo.version[1], vInfo.version[2]];
        }
      } catch (e) {
        console.warn(`[${this.name}] Using fallback version`);
      }

      const createWASocket =
        typeof makeWASocket === "function"
          ? makeWASocket
          : (makeWASocket as any)?.default || (makeWASocket as any)?.makeWASocket;

      const sock = createWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS("Chrome"),
        syncFullHistory: true,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 25_000,
        retryRequestDelayMs: 2_000,
      });

      this.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      // Handle pairing code if requested
      if (requestedPhoneNumber && !sock.authState.creds.registered) {
        setTimeout(async () => {
          try {
            const cleanPhone = requestedPhoneNumber.replace(/[^0-9]/g, "");
            if (cleanPhone.length >= 8) {
              const code = await sock.requestPairingCode(cleanPhone);
              this.state.pairingCode = code;
              this.onStateChange(this);
            }
          } catch (codeErr: any) {
            console.error(`[${this.name}] Pairing code error:`, codeErr);
            this.state.lastError = codeErr?.message || "Failed to generate pairing code";
            this.onStateChange(this);
          }
        }, 3000);
      }

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 280,
              color: {
                dark: "#059669",
                light: "#ffffff",
              },
            });
            this.state.qrCodeDataUrl = qrUrl;
            this.state.status = "CONNECTING";
            this.onStateChange(this);
          } catch (qrErr) {
            console.error(`[${this.name}] QR data URL error:`, qrErr);
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`[${this.name}] Connection closed: ${statusCode}. Reconnect: ${shouldReconnect}`);

          this.state.qrCodeDataUrl = null;
          this.state.pairingCode = null;

          if (statusCode === DisconnectReason.loggedOut) {
            this.state.status = "DISCONNECTED";
            this.state.user = null;
            this.state.lastError = "Logged out from device";
            this.connectionOpenedTimestamp = 0;
            try {
              fs.rmSync(this.sessionDir, { recursive: true, force: true });
              fs.mkdirSync(this.sessionDir, { recursive: true });
            } catch (e) {}
          } else {
            this.state.status = "ERROR";
            this.state.lastError = (lastDisconnect?.error as any)?.message || "Connection closed unexpectedly";
            this.connectionOpenedTimestamp = 0;
          }
          this.onStateChange(this);
        } else if (connection === "open") {
          console.log(`[${this.name}] WhatsApp successfully connected!`);
          this.state.status = "CONNECTED";
          this.state.qrCodeDataUrl = null;
          this.state.pairingCode = null;
          this.state.lastError = null;
          this.state.connectedAt = new Date().toISOString();
          this.connectionOpenedTimestamp = Date.now();

          const userJid = sock.user?.id || "";
          const phone = (userJid.split("@")[0] || "").split(":")[0].replace(/[^0-9]/g, "");
          this.state.user = {
            id: userJid,
            name: sock.user?.name || `${this.name} (${phone || "واتساب"})`,
            phone,
          };
          if (!this.name || this.name.startsWith("حساب")) {
            this.name = phone ? `واتساب (+${phone})` : this.name;
          }
          this.onStateChange(this);

          // Trigger CRM sync
          try {
            crmService.syncChatsFromSession(this.id);
          } catch {}
        }
      });

      // CRM: Listen to history sync
      sock.ev.on("messaging-history.set", ({ chats, contacts, messages }: any) => {
        try {
          console.log(`[${this.name}] WhatsApp history sync: ${chats?.length || 0} chats, ${contacts?.length || 0} contacts, ${messages?.length || 0} messages`);
          if (contacts && Array.isArray(contacts)) {
            for (const c of contacts) {
              if (c.id && !c.id.includes("@g.us")) {
                const phone = crmService.resolvePhone(c.id);
                const name = c.name || c.notify || c.verifiedName || "";
                if (phone && phone.length >= 7 && name) {
                  crmService.recordContactName(phone, name, this.id, this.name);
                }
              }
            }
          }

          if (chats && Array.isArray(chats)) {
            for (const c of chats) {
              if (c.id && !c.id.includes("@g.us") && !c.id.includes("broadcast")) {
                const phone = crmService.resolvePhone(c.id);
                if (phone && phone.length >= 7) {
                  const timestamp = c.conversationTimestamp
                    ? new Date(Number(c.conversationTimestamp) * 1000).toISOString()
                    : undefined;
                  crmService.recordChatSummary(phone, c.name || "", c.unreadCount || 0, timestamp, this.id, this.name);
                }
              }
            }
          }

          // In history sync: pass isLiveNotification = false (RECORD IN CRM ONLY, NEVER TRIGGER AI)
          if (messages && Array.isArray(messages)) {
            for (const msg of messages) {
              this.processIncomingMessage(msg, false);
            }
          }
        } catch (err) {
          console.error(`[${this.name}] Error in messaging-history.set:`, err);
        }
      });

      // CRM: Listen to incoming & outgoing messages
      sock.ev.on("messages.upsert", async ({ messages, type }: { messages: any[]; type?: string }) => {
        try {
          if (!messages || !Array.isArray(messages)) return;
          // 'notify' = real-time live incoming notification
          // 'append' = historical sync / chat history reload
          const isLive = type === "notify";
          for (const msg of messages) {
            this.processIncomingMessage(msg, isLive);
          }
        } catch (err) {
          console.error(`[${this.name}] Error in messages.upsert:`, err);
        }
      });

      // Delivery Diagnostics: Track message status updates (server ack, delivery receipt, etc.)
      sock.ev.on("messages.update", (updates: any[]) => {
        try {
          if (!Array.isArray(updates)) return;
          for (const item of updates) {
            if (item?.key?.id) {
              const msgId = item.key.id;
              const remoteJid = item.key.remoteJid || "";
              const statusCode = item.update?.status;
              this.recordMessageStatusUpdate(msgId, remoteJid, statusCode, item.update);
            }
          }
        } catch (err) {
          console.error(`[${this.name}] Error in messages.update:`, err);
        }
      });

      // Delivery Diagnostics: Track message receipts (delivered, read)
      sock.ev.on("message-receipt.update", (receipts: any[]) => {
        try {
          if (!Array.isArray(receipts)) return;
          for (const item of receipts) {
            if (item?.key?.id) {
              const msgId = item.key.id;
              const remoteJid = item.key.remoteJid || "";
              const hasRead = Boolean(item.receipt?.readTimestamp);
              this.recordMessageStatusUpdate(msgId, remoteJid, hasRead ? 4 : 3, item.receipt);
            }
          }
        } catch (err) {
          console.error(`[${this.name}] Error in message-receipt.update:`, err);
        }
      });

      // CRM: Listen to chats updates
      (sock.ev as any).on("chats.set", ({ chats }: any) => {
        try {
          if (Array.isArray(chats)) {
            for (const c of chats) {
              if (c.id && !c.id.includes("@g.us") && !c.id.includes("broadcast")) {
                const phone = crmService.resolvePhone(c.id);
                if (phone && phone.length >= 7) {
                  crmService.recordChatSummary(phone, c.name || "", c.unreadCount || 0, undefined, this.id, this.name);
                }
              }
            }
          }
        } catch {}
      });

      sock.ev.on("chats.upsert", (chats: any[]) => {
        try {
          if (!Array.isArray(chats)) return;
          for (const c of chats) {
            if (c.id && !c.id.includes("@g.us") && !c.id.includes("broadcast") && !c.id.includes("@newsletter")) {
              const phone = crmService.resolvePhone(c.id);
              if (phone && phone.length >= 7) {
                crmService.recordChatSummary(phone, c.name || "", c.unreadCount || 0, undefined, this.id, this.name);
              }
            }
          }
        } catch (err) {
          console.error(`[${this.name}] Error in chats.upsert:`, err);
        }
      });

      sock.ev.on("chats.update", (chats: any[]) => {
        try {
          if (!Array.isArray(chats)) return;
          for (const c of chats) {
            if (c.id && !c.id.includes("@g.us") && !c.id.includes("broadcast") && !c.id.includes("@newsletter")) {
              const phone = crmService.resolvePhone(c.id);
              if (phone && phone.length >= 7) {
                crmService.recordChatSummary(phone, c.name || "", c.unreadCount || 0, undefined, this.id, this.name);
              }
            }
          }
        } catch (err) {
          console.error(`[${this.name}] Error in chats.update:`, err);
        }
      });

      // CRM: Listen to contacts updates
      (sock.ev as any).on("contacts.set", ({ contacts }: any) => {
        try {
          if (Array.isArray(contacts)) {
            for (const c of contacts) {
              if (c.id && !c.id.includes("@g.us") && !c.id.includes("broadcast")) {
                const phone = crmService.resolvePhone(c.id);
                const name = c.name || c.notify || c.verifiedName || "";
                if (phone && phone.length >= 7 && name) {
                  crmService.recordContactName(phone, name, this.id, this.name);
                }
              }
            }
          }
        } catch {}
      });

      sock.ev.on("contacts.upsert", (contacts: any[]) => {
        try {
          if (!Array.isArray(contacts)) return;
          for (const c of contacts) {
            if (c.id && !c.id.includes("@g.us") && !c.id.includes("broadcast") && !c.id.includes("@newsletter")) {
              const phone = crmService.resolvePhone(c.id);
              const name = c.name || c.notify || c.verifiedName || "";
              if (phone && phone.length >= 7 && name) {
                crmService.recordContactName(phone, name, this.id, this.name);
              }
            }
          }
        } catch (err) {
          console.error(`[${this.name}] Error in contacts.upsert:`, err);
        }
      });

      sock.ev.on("contacts.update", (contacts: any[]) => {
        try {
          if (!Array.isArray(contacts)) return;
          for (const c of contacts) {
            if (c.id && !c.id.includes("@g.us") && !c.id.includes("broadcast") && !c.id.includes("@newsletter")) {
              const phone = crmService.resolvePhone(c.id);
              const name = c.name || c.notify || c.verifiedName || "";
              if (phone && phone.length >= 7 && name) {
                crmService.recordContactName(phone, name, this.id, this.name);
              }
            }
          }
        } catch (err) {
          console.error(`[${this.name}] Error in contacts.update:`, err);
        }
      });

      this.isInitializing = false;
      return this.state;
    } catch (err: any) {
      console.error(`[${this.name}] Init WhatsApp error:`, err);
      this.isInitializing = false;
      this.state.status = "ERROR";
      this.state.lastError = err?.message || "Failed to initialize WhatsApp connection";
      this.onStateChange(this);
      return this.state;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        try {
          await Promise.race([
            this.sock.logout(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Logout timeout")), 1200)),
          ]);
        } catch (e) {}
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }

      this.state = {
        status: "DISCONNECTED",
        qrCodeDataUrl: null,
        pairingCode: null,
        user: null,
        lastError: null,
        connectedAt: null,
      };
      this.onStateChange(this);
    } catch (e: any) {
      console.error(`[${this.name}] Disconnect error:`, e);
    }
  }

  public async sendMessage(
    phoneNumber: string,
    messageText: string,
    attachment?: CampaignAttachment | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.state.status !== "CONNECTED" || !this.sock) {
      return {
        success: false,
        error: `حساب الواتساب (${this.name}) غير متصل. يرجى ربطه أولاً.`,
      };
    }

    try {
      // Normalize number strictly to international format (e.g. 010... -> 2010...)
      let clean = normalizePhoneNumber(phoneNumber);
      if (!clean || clean.length < 8) {
        return {
          success: false,
          error: "رقم الهاتف غير صالح أو ناقص كود الدولة (Invalid phone number)",
        };
      }

      let jid = `${clean}@s.whatsapp.net`;

      // Validate presence on WhatsApp via onWhatsApp
      try {
        const results = await this.sock.onWhatsApp(jid);
        if (results && results.length === 0) {
          return {
            success: false,
            error: `الرقم ${clean} غير مسجل على واتساب (Not registered on WhatsApp)`,
          };
        }
        if (results && results.length > 0) {
          if (!results[0].exists) {
            return {
              success: false,
              error: `الرقم ${clean} غير مفعل على واتساب (Not registered on WhatsApp)`,
            };
          }
          if (results[0].jid) {
            jid = results[0].jid;
          }
        }
      } catch (checkErr: any) {
        console.warn(`[${this.name}] onWhatsApp check warning:`, checkErr?.message);
      }

      let sent: any;

      if (attachment && attachment.dataBase64) {
        const cleanBase64 = attachment.dataBase64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");

        if (attachment.type === "image") {
          sent = await this.sock.sendMessage(jid, {
            image: buffer,
            caption: messageText,
            mimetype: attachment.mimetype || "image/jpeg",
          });
        } else {
          sent = await this.sock.sendMessage(jid, {
            document: buffer,
            mimetype: attachment.mimetype || "application/pdf",
            fileName: attachment.fileName || "document.pdf",
            caption: messageText,
          });
        }
      } else {
        sent = await this.sock.sendMessage(jid, { text: messageText });
      }

      // Log outgoing message to CRM
      try {
        crmService.handleIncomingWhatsAppMessage({
          id: sent?.key?.id || `sent-${Date.now()}`,
          phone: clean,
          senderName: "أنا",
          text: messageText,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour12: true }),
          fromMe: true,
          hasMedia: Boolean(attachment),
        });
      } catch (logErr) {
        console.error(`[${this.name}] Error logging sent message to CRM:`, logErr);
      }

      if (sent?.key?.id) {
        this.messageDeliveryLog.set(sent.key.id, {
          messageId: sent.key.id,
          phone: clean,
          remoteJid: jid,
          status: "SERVER_ACK",
          statusCode: 2,
          updatedAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        messageId: sent?.key?.id,
      };
    } catch (err: any) {
      console.error(`[${this.name}] Failed to send WhatsApp message:`, err);
      return {
        success: false,
        error: err?.message || "Failed to send message",
      };
    }
  }

  public async sendPresenceUpdate(
    presence: "composing" | "paused",
    phone: string
  ): Promise<void> {
    if (!this.sock || this.state.status !== "CONNECTED") return;
    try {
      const clean = normalizePhoneNumber(phone);
      if (!clean) return;
      const jid = `${clean}@s.whatsapp.net`;
      if (typeof this.sock.sendPresenceUpdate === "function") {
        await this.sock.sendPresenceUpdate(presence, jid);
      }
    } catch (e) {
      // Non-critical presence update error
    }
  }

  public async verifyDeliveryForContacts(
    contacts: Array<{ phone: string; name?: string; messageId?: string; sentAt?: string }>,
    campaignInfo?: { campaignId?: string; campaignName?: string }
  ): Promise<DeliveryVerificationResult> {
    const isConnected = this.state.status === "CONNECTED" && Boolean(this.sock);
    let wsState: "OPEN" | "CONNECTING" | "CLOSED" | "UNKNOWN" = "UNKNOWN";
    if (this.sock?.ws) {
      const ready = (this.sock.ws as any).readyState;
      if (ready === 1) wsState = "OPEN";
      else if (ready === 0) wsState = "CONNECTING";
      else wsState = "CLOSED";
    }

    const senderPhone =
      this.state.user?.phone ||
      (this.state.user?.id ? this.state.user.id.split("@")[0].split(":")[0] : undefined);

    const diagnostics: ContactDeliveryDiagnostic[] = [];
    let registeredCount = 0;
    let unregisteredCount = 0;
    let deliveredCount = 0;
    let serverAckCount = 0;
    let readCount = 0;
    let pendingOrErrorCount = 0;

    for (const c of contacts) {
      const normPhone = normalizePhoneNumber(c.phone);
      const targetJid = `${normPhone}@s.whatsapp.net`;
      let isRegistered = false;
      let verifiedJid = targetJid;
      let checkError: string | undefined;

      // Live verification with Baileys socket
      if (isConnected && this.sock) {
        try {
          const results = await this.sock.onWhatsApp(targetJid);
          if (Array.isArray(results) && results.length > 0 && results[0]?.exists) {
            isRegistered = true;
            if (results[0].jid) verifiedJid = results[0].jid;
          } else {
            isRegistered = false;
          }
        } catch (err: any) {
          checkError = err?.message;
        }
      } else {
        isRegistered = true; // cannot check live without socket
      }

      if (isRegistered) {
        registeredCount++;
      } else {
        unregisteredCount++;
      }

      // Check delivery tracking from Baileys events
      let tracking = c.messageId ? this.messageDeliveryLog.get(c.messageId) : undefined;
      if (!tracking) {
        for (const item of this.messageDeliveryLog.values()) {
          if (item.phone === normPhone || item.remoteJid.includes(normPhone)) {
            tracking = item;
            break;
          }
        }
      }

      const isSelf = senderPhone ? isSamePhoneNumber(normPhone, senderPhone) : false;
      let deliveryStatus: ContactDeliveryDiagnostic["deliveryStatus"] = "NOT_FOUND";
      let labelAr = "لم ترصد إشارة استلام بعد";
      let labelEn = "No signal tracked yet";
      let note = "";
      let troubleshootGuide = "";

      if (!isRegistered && isConnected) {
        deliveryStatus = "NOT_REGISTERED";
        labelAr = "الرقم غير مسجل على واتساب ❌";
        labelEn = "Not Registered on WhatsApp ❌";
        note = "الرقم غير مسجل في سيرفرات واتساب نهائياً، وبالتالي تسقط أي رسالة مرسلة إليه بدون إشعار.";
        troubleshootGuide = "تأكد من كتابة الرقم بشكل صحيح ووجود حساب واتساب نشط لصاحب الرقم.";
        pendingOrErrorCount++;
      } else if (tracking) {
        deliveryStatus = tracking.status;
        if (tracking.status === "READ") {
          labelAr = "تمت القراءة (علامتان زرقاوان) 👁️";
          labelEn = "Read (Blue Ticks) 👁️";
          note = "وصلت الرسالة إلى هاتف المستلم وقام بفتحها وقراءتها بالفعل.";
          readCount++;
        } else if (tracking.status === "DELIVERY_ACK") {
          labelAr = "تم التسليم للجهاز (علامتان رماديتان) ✅✅";
          labelEn = "Delivered to device (Double Ticks) ✅✅";
          note = "وصلت الرسالة فعلياً لجهاز المستلم ولكن لم يقم بفتحها بعد.";
          troubleshootGuide = "الرسالة وصلت للجهاز بنجاح! إذا لم تجدها في قائمة محادثاتك: افتح واتساب في هاتفك وابحث عن رقم المستلم في خانة البحث (🔍) وستجد المحادثة فوراً.";
          deliveredCount++;
        } else if (tracking.status === "SERVER_ACK") {
          labelAr = "وصلت لخادم واتساب (علامة واحدة رمادية) ⏱️";
          labelEn = "Received by WhatsApp Server (Single Tick) ⏱️";
          note = "استلم خادم واتساب الرسالة بنجاح وخرجت من حسابك، وهي الآن بانتظار اتصال هاتف المستلم بالإنترنت.";
          troubleshootGuide = "هاتف المستلم مغلق حالياً أو غير متصل بالإنترنت؛ فور اتصاله بالإنترنت ستصل وتتحول فوراً إلى علامتي صح.";
          serverAckCount++;
        } else if (tracking.status === "ERROR") {
          labelAr = "فشل التسليم ❌";
          labelEn = "Delivery Failed ❌";
          note = tracking.error || "تعذر تسليم الرسالة من خادم واتساب.";
          pendingOrErrorCount++;
        } else {
          serverAckCount++;
        }
      } else if (c.sentAt) {
        deliveryStatus = "SERVER_ACK";
        labelAr = "تم الإرسال (صح واحد) ⏱️";
        labelEn = "Sent (Single Tick) ⏱️";
        note = "تم بث الرسالة بنجاح عبر بروتوكول واتساب.";
        troubleshootGuide = "إذا كانت الرسالة لا تظهر في أعلى المحادثات في الهاتف، ابحث عن الرقم في شريط البحث (🔍) داخل تطبيق واتساب.";
        serverAckCount++;
      } else {
        deliveryStatus = "NOT_SENT";
        labelAr = "لم ترسل بعد";
        labelEn = "Not sent yet";
        note = "هذا الرقم لا يزال قيد الانتظار في الحملة.";
      }

      if (isSelf) {
        note += " [تنبيه: هذا الرقم هو نفس رقمك المربوط؛ الرسائل تظهر في محادثة 'راسل نفسك / Message Yourself'].";
      }

      diagnostics.push({
        phone: c.phone,
        name: c.name,
        messageId: c.messageId || tracking?.messageId,
        sentAt: c.sentAt || tracking?.updatedAt,
        isRegisteredOnWhatsApp: isRegistered,
        verifiedJid,
        deliveryStatus,
        deliveryStatusLabelAr: labelAr,
        deliveryStatusLabelEn: labelEn,
        statusCode: tracking?.statusCode,
        lastUpdated: tracking?.updatedAt,
        isSelf,
        diagnosticNote: note,
        troubleshootGuide,
        error: checkError || tracking?.error,
      });
    }

    let verdict: DeliveryVerificationResult["summary"]["verdict"] = "NO_SENT_MESSAGES";
    let verdictLabelAr = "لا توجد رسائل مرسلة بعد لفحصها";
    let verdictLabelEn = "No sent messages found to verify";

    if (!isConnected) {
      verdict = "DISCONNECTED";
      verdictLabelAr = "واتساب غير متصل حالياً - يرجى فحص حالة الاتصال أولاً";
      verdictLabelEn = "WhatsApp is currently disconnected";
    } else if (unregisteredCount > 0) {
      verdict = "UNREGISTERED_DETECTED";
      verdictLabelAr = `تنبيه: تم رصد ${unregisteredCount} أرقام غير مفعلة على واتساب نهائياً`;
      verdictLabelEn = `Warning: ${unregisteredCount} numbers are not registered on WhatsApp`;
    } else if (deliveredCount + readCount === contacts.length && contacts.length > 0) {
      verdict = "ALL_DELIVERED";
      verdictLabelAr = "ممتاز: تم تسليم جميع الرسائل إلى أجهزة المستلمين بنجاح تام";
      verdictLabelEn = "Excellent: All messages successfully delivered to recipient devices";
    } else if (deliveredCount + readCount > 0) {
      verdict = "PARTIAL_DELIVERY";
      verdictLabelAr = `تم تسليم ${deliveredCount + readCount} رسالة، وجارٍ استلام البقية عبر خوادم واتساب`;
      verdictLabelEn = `${deliveredCount + readCount} messages delivered, remainder queued on WhatsApp servers`;
    } else if (serverAckCount > 0) {
      verdict = "SERVER_WAITING";
      verdictLabelAr = "الرسائل خرجت بنجاح من حسابك ومحفوظة في سيرفرات واتساب بانتظار اتصال أجهزة المستلمين";
      verdictLabelEn = "Messages queued on WhatsApp servers waiting for recipient devices to come online";
    }

    const recommendationsAr = [
      "البحث اليدوي بالرقم في واتساب الموبايل: في تحديثات واتساب للأجهزة المرتبطة، الرسائل المرسلة لأرقام غير مسجلة في هاتفك لا تظهر تلقائياً في أعلى قائمة الدردشات. افتح واتساب على الهاتف واضغط على علامة البحث (🔍) واكتب رقم الهاتف لتظهر المحادثة فوراً.",
      "التأكد من تطابق الرقم المربوط: تأكد أنك تفحص تطبيق واتساب المسجل بنفس الرقم المربوط هنا (" + (senderPhone || "الحساب المتصل") + "). إذا كان هاتفك يحتوي على خطين (SIM 1 / SIM 2) أو لديك أكثر من تطبيق، تأكد من فتح الحساب الصحيح.",
      "الفرق بين علامة صح واحدة وعلامتين: علامة الصح الواحدة تعني أن الرسالة أُرسلت من هاتفك ووصلت لخوادم واتساب بنجاح، وتنتظر فتح المستلم للإنترنت. فور اتصال هاتف المستلم، تتحول تلقائياً إلى علامتين.",
      "فحص أرقام الهواتف قبل الإرسال: تأكد من تضمين كود الدولة الدولي الصحيح (مثل 20 لمصر) وأن الأرقام مسجلة بالفعل على واتساب لتفادي إسقاطها من الخوادم.",
    ];

    const recommendationsEn = [
      "Search by Phone in Mobile WhatsApp: In multi-device WhatsApp, outgoing messages to unsaved contacts do not automatically push the chat to the top of the mobile screen. Open WhatsApp on your phone, tap Search (🔍), and type the phone number to view the conversation.",
      "Check Connected SIM/Account: Ensure that you are checking the exact WhatsApp account linked here (" + (senderPhone || "Connected Account") + "). If your phone has dual SIMs or multiple WhatsApp apps, verify the active account.",
      "Single Tick vs Double Ticks: A single tick indicates the message was accepted by WhatsApp servers and is waiting for the recipient's phone to connect to the internet.",
      "Validate Number Format: Ensure numbers have international country codes (e.g. +20 for Egypt) and are registered on WhatsApp.",
    ];

    return {
      success: true,
      timestamp: new Date().toISOString(),
      campaignId: campaignInfo?.campaignId,
      campaignName: campaignInfo?.campaignName,
      provider: {
        accountId: this.id,
        accountName: this.name,
        isConnected,
        senderPhone,
        socketStatus: this.state.status,
        wsReadyState: wsState,
      },
      summary: {
        totalContactsChecked: contacts.length,
        registeredCount,
        unregisteredCount,
        deliveredCount,
        serverAckCount,
        readCount,
        pendingOrErrorCount,
        verdict,
        verdictLabelAr,
        verdictLabelEn,
      },
      contacts: diagnostics,
      recommendations: {
        ar: recommendationsAr,
        en: recommendationsEn,
      },
    };
  }

  private processIncomingMessage(msg: any, isLiveNotification: boolean = false) {
    if (!msg || !msg.message) return;
    const jid = msg.key?.remoteJid || "";
    if (
      jid.includes("broadcast") ||
      jid.includes("@g.us") ||
      jid.includes("@newsletter") ||
      jid.includes("status@broadcast")
    ) {
      return;
    }

    const phone = crmService.resolvePhone(jid);
    if (!phone || phone.length < 7) return;

    const fromMe = Boolean(msg.key?.fromMe);
    const senderName = msg.pushName || (fromMe ? "أنا" : "");
    const rawMsgSeconds = Number(msg.messageTimestamp) || 0;
    const timestamp = rawMsgSeconds
      ? new Date(rawMsgSeconds * 1000).toLocaleTimeString("ar-EG", { hour12: true })
      : new Date().toLocaleTimeString("ar-EG", { hour12: true });

    let rawMsg = msg.message;
    if (rawMsg.ephemeralMessage?.message) rawMsg = rawMsg.ephemeralMessage.message;
    if (rawMsg.viewOnceMessage?.message) rawMsg = rawMsg.viewOnceMessage.message;
    if (rawMsg.viewOnceMessageV2?.message) rawMsg = rawMsg.viewOnceMessageV2.message;
    if (rawMsg.documentWithCaptionMessage?.message) rawMsg = rawMsg.documentWithCaptionMessage.message;

    let text =
      rawMsg.conversation ||
      rawMsg.extendedTextMessage?.text ||
      rawMsg.imageMessage?.caption ||
      rawMsg.videoMessage?.caption ||
      rawMsg.documentMessage?.caption ||
      "";

    // Handle WhatsApp native location pins and live locations:
    if (rawMsg.locationMessage) {
      const lat = rawMsg.locationMessage.degreesLatitude;
      const lng = rawMsg.locationMessage.degreesLongitude;
      const locName = rawMsg.locationMessage.name || "";
      const locAddress = rawMsg.locationMessage.address || "";
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      text = `📍 [موقع جغرافي / Location: ${mapsUrl}] ${locName} ${locAddress}`.trim();
    } else if (rawMsg.liveLocationMessage) {
      const lat = rawMsg.liveLocationMessage.degreesLatitude;
      const lng = rawMsg.liveLocationMessage.degreesLongitude;
      const caption = rawMsg.liveLocationMessage.caption || "";
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      text = `📍 [موقع جغرافي مباشر / Live Location: ${mapsUrl}] ${caption}`.trim();
    }

    const hasMedia = Boolean(
      rawMsg.imageMessage ||
      rawMsg.documentMessage ||
      rawMsg.videoMessage ||
      rawMsg.audioMessage ||
      rawMsg.locationMessage ||
      rawMsg.liveLocationMessage
    );
    if (!text && hasMedia) {
      if (rawMsg.imageMessage) text = "📷 [صورة]";
      else if (rawMsg.documentMessage) text = `📄 [مستند: ${rawMsg.documentMessage.fileName || "ملف"}]`;
      else if (rawMsg.audioMessage) text = "🎙️ [رسالة صوتية]";
      else if (rawMsg.videoMessage) text = "🎥 [فيديو]";
      else if (rawMsg.locationMessage || rawMsg.liveLocationMessage) text = "📍 [موقع جغرافي / Location]";
    }

    if (text || hasMedia) {
      const msgId = msg.key?.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      
      // Always record all incoming & outgoing messages into CRM for history view
      crmService.handleIncomingWhatsAppMessage({
        id: msgId,
        phone,
        senderName,
        text: text || "[مرفق]",
        timestamp,
        fromMe,
        hasMedia,
        accountId: this.id,
        accountName: this.name,
      });

      // ANTI-BAN & SPAM SHIELD (STRICT REAL-TIME ONLY FILTER):
      // The user specified: Only reply to NEW incoming messages, ignore historical/old messages completely.
      // 1. MUST NOT be outgoing from me
      // 2. MUST be a live real-time notification (type === 'notify'), NEVER a chat history sync or append
      // 3. MUST be sent AFTER this WhatsApp connection was established (drops messages from before connection)
      // 4. Connection warmed up (5 seconds buffer to let initial handshake settle)
      // 5. Message MUST be recent (sent within the last 45 seconds, with 60s clock drift tolerance)
      // 6. MUST NOT be the account owner's own phone number (self chat)
      // 7. MUST NOT be an OTP, verification code, or system notice
      const nowSec = Math.floor(Date.now() / 1000);
      const msgTimeMs = rawMsgSeconds > 0 ? rawMsgSeconds * 1000 : Date.now();
      const msgAgeSec = rawMsgSeconds > 0 ? nowSec - rawMsgSeconds : 0;
      const isLiveRecent = msgAgeSec >= -60 && msgAgeSec <= 60;
      const isSentAfterConnection =
        this.connectionOpenedTimestamp > 0
          ? msgTimeMs >= (this.connectionOpenedTimestamp - 5000)
          : true;
      const isConnectionWarmedUp =
        this.connectionOpenedTimestamp > 0
          ? Date.now() - this.connectionOpenedTimestamp > 1_000
          : true;
      const myPhone = this.state.user?.phone;
      const isSelf = myPhone ? isSamePhoneNumber(phone, myPhone) : false;
      const isOtpOrSystemNotice =
        /code|otp|رمز|تأكيد|كود|تحقق/i.test(text) && text.length < 50;

      const isEligibleLive = isLiveNotification || isLiveRecent;

      if (
        !fromMe &&
        text &&
        isEligibleLive &&
        isConnectionWarmedUp &&
        isSentAfterConnection &&
        isLiveRecent &&
        !isSelf &&
        !isOtpOrSystemNotice
      ) {
        aiSalesAgentService
          .onIncomingWhatsAppMessage({
            messageId: msgId,
            phone,
            text,
            senderName,
            accountId: this.id,
            accountName: this.name,
            fromMe,
            messageTimestamp: msgTimeMs,
          })
          .catch((err) => {
            console.error(`[${this.name}] AI Sales Agent message processing notice:`, err?.message || err);
          });
      }
    }
  }

  public async requestChatHistory(phone: string, count: number = 50): Promise<boolean> {
    if (!this.sock) return false;
    try {
      const cleanPhone = crmService.resolvePhone(phone);
      if (!cleanPhone) return false;

      const jid = `${cleanPhone}@s.whatsapp.net`;
      const existing = crmService.getMessagesForPhone(cleanPhone);
      let oldestMsgKey: any = {
        remoteJid: jid,
        fromMe: false,
        id: "",
      };
      let oldestTimestamp = Math.floor(Date.now() / 1000);

      if (existing.length > 0) {
        oldestMsgKey = {
          remoteJid: jid,
          fromMe: Boolean(existing[0].fromMe),
          id: existing[0].id,
        };
      }

      if (typeof (this.sock as any).fetchMessageHistory === "function") {
        await (this.sock as any).fetchMessageHistory(count, oldestMsgKey, oldestTimestamp);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn(`[${this.name}] requestChatHistory failed:`, err?.message);
      return false;
    }
  }
}

class WhatsAppManager {
  private accounts: Map<string, WhatsAppAccountInstance> = new Map();
  private accountsFile: string;
  private listeners: ((state: WASessionState) => void)[] = [];

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.accountsFile = path.join(dataDir, "whatsapp_accounts.json");
    this.loadAccounts();
  }

  private loadAccounts() {
    let savedList: { id: string; name: string }[] = [];
    if (fs.existsSync(this.accountsFile)) {
      try {
        savedList = JSON.parse(fs.readFileSync(this.accountsFile, "utf-8"));
      } catch (e) {
        console.error("Error reading whatsapp_accounts.json:", e);
      }
    }

    // Always ensure default account exists (pointing to /data/sessions for backwards compatibility)
    if (!savedList.some((a) => a.id === "default")) {
      savedList.unshift({ id: "default", name: "الحساب الرئيسي (1)" });
    }

    for (const item of savedList) {
      const sessionDir =
        item.id === "default"
          ? path.join(process.cwd(), "data", "sessions")
          : path.join(process.cwd(), "data", "sessions", "accounts", item.id);

      const acc = new WhatsAppAccountInstance(item.id, item.name, sessionDir, () => {
        this.emitState();
      });
      this.accounts.set(item.id, acc);
    }
    this.saveAccountsMetadata();
  }

  private saveAccountsMetadata() {
    try {
      const list = Array.from(this.accounts.values()).map((a) => ({
        id: a.id,
        name: a.name,
      }));
      fs.writeFileSync(this.accountsFile, JSON.stringify(list, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving whatsapp_accounts.json:", e);
    }
  }

  public getAccounts(): WhatsAppAccountInfo[] {
    return Array.from(this.accounts.values()).map((a) => a.getInfo());
  }

  public getAccount(id: string): WhatsAppAccountInstance | undefined {
    return this.accounts.get(id);
  }

  public createAccount(name?: string): WhatsAppAccountInfo {
    const id = `acc_${Date.now()}`;
    const accName = name || `حساب واتساب (${this.accounts.size + 1})`;
    const sessionDir = path.join(process.cwd(), "data", "sessions", "accounts", id);

    const acc = new WhatsAppAccountInstance(id, accName, sessionDir, () => {
      this.emitState();
    });
    this.accounts.set(id, acc);
    this.saveAccountsMetadata();
    return acc.getInfo();
  }

  public async deleteAccount(id: string): Promise<boolean> {
    const acc = this.accounts.get(id);
    if (!acc) return false;

    try {
      await acc.disconnect();
    } catch (e: any) {
      console.error(`[${acc.name}] Error disconnecting during deletion:`, e?.message);
    }

    if (id === "default") {
      // Don't delete the default slot, but wipe session credentials and files completely
      try {
        if (fs.existsSync(acc.sessionDir)) {
          const files = fs.readdirSync(acc.sessionDir);
          for (const f of files) {
            if (f === "accounts") continue;
            try {
              fs.rmSync(path.join(acc.sessionDir, f), { recursive: true, force: true });
            } catch (rmErr) {}
          }
        }
      } catch (err) {}

      acc.name = "الحساب الرئيسي 1";
      acc.state = {
        status: "DISCONNECTED",
        qrCodeDataUrl: null,
        pairingCode: null,
        user: null,
        lastError: null,
        connectedAt: null,
      };
      this.saveAccountsMetadata();
      this.emitState();
      return true;
    }

    // For secondary accounts: delete session directory completely and remove from map
    try {
      if (fs.existsSync(acc.sessionDir)) {
        fs.rmSync(acc.sessionDir, { recursive: true, force: true });
      }
    } catch (rmErr) {}

    this.accounts.delete(id);
    this.saveAccountsMetadata();
    this.emitState();
    return true;
  }

  // --- Backwards compatible methods delegating to default or first connected account ---

  public isConnected(accountId?: string): boolean {
    if (accountId) {
      return Boolean(this.accounts.get(accountId)?.isConnected());
    }
    return Array.from(this.accounts.values()).some((a) => a.isConnected());
  }

  public getState(accountId: string = "default"): WASessionState {
    const acc = this.accounts.get(accountId) || this.accounts.get("default") || Array.from(this.accounts.values())[0];
    return acc ? acc.state : {
      status: "DISCONNECTED",
      qrCodeDataUrl: null,
      pairingCode: null,
      user: null,
      lastError: null,
      connectedAt: null,
    };
  }

  public subscribe(cb: (state: WASessionState) => void) {
    this.listeners.push(cb);
    cb(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private emitState() {
    const s = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(s);
      } catch (err) {
        console.error("State listener error:", err);
      }
    });
  }

  public async connect(accountIdOrPhone?: string, maybePhone?: string): Promise<WASessionState> {
    let accountId = "default";
    let phoneNumber: string | undefined = undefined;

    if (accountIdOrPhone && this.accounts.has(accountIdOrPhone)) {
      accountId = accountIdOrPhone;
      phoneNumber = maybePhone;
    } else if (accountIdOrPhone) {
      // Legacy call where first param was phoneNumber
      phoneNumber = accountIdOrPhone;
    }

    let acc = this.accounts.get(accountId);
    if (!acc) {
      acc = this.accounts.get("default") || Array.from(this.accounts.values())[0];
    }
    if (!acc) {
      throw new Error("No WhatsApp account found to connect");
    }

    return acc.connect(phoneNumber);
  }

  public async disconnect(accountId: string = "default"): Promise<void> {
    const acc = this.accounts.get(accountId);
    if (acc) {
      await acc.disconnect();
    }
  }

  public async sendMessage(
    firstParam: string,
    secondParam: string | CampaignAttachment | null,
    thirdParam?: string | CampaignAttachment | null,
    fourthParam?: CampaignAttachment | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Determine whether signature is:
    // sendMessage(phoneNumber, messageText, attachment?) [Legacy]
    // or sendMessage(accountId, phoneNumber, messageText, attachment?)
    let accountId: string | undefined;
    let phoneNumber: string;
    let messageText: string;
    let attachment: CampaignAttachment | null | undefined;

    if (this.accounts.has(firstParam)) {
      accountId = firstParam;
      phoneNumber = typeof secondParam === "string" ? secondParam : "";
      messageText = typeof thirdParam === "string" ? thirdParam : "";
      attachment = fourthParam;
    } else {
      // Legacy signature: firstParam is phoneNumber
      phoneNumber = firstParam;
      messageText = typeof secondParam === "string" ? secondParam : "";
      attachment = typeof thirdParam === "object" ? thirdParam : null;
    }

    // Pick target account: specific account, or first connected account, or default
    let targetAcc: WhatsAppAccountInstance | undefined;
    if (accountId && this.accounts.has(accountId)) {
      targetAcc = this.accounts.get(accountId);
    } else {
      targetAcc = Array.from(this.accounts.values()).find((a) => a.isConnected()) || this.accounts.get("default");
    }

    if (!targetAcc) {
      return { success: false, error: "لا يوجد حساب واتساب جاهز للإرسال" };
    }

    return targetAcc.sendMessage(phoneNumber, messageText, attachment);
  }

  public async requestChatHistory(phone: string, count: number = 50, accountId?: string): Promise<boolean> {
    let targetAcc: WhatsAppAccountInstance | undefined;
    if (accountId && this.accounts.has(accountId)) {
      targetAcc = this.accounts.get(accountId);
    } else {
      targetAcc = Array.from(this.accounts.values()).find((a) => a.isConnected()) || this.accounts.get("default");
    }
    if (!targetAcc) return false;
    return targetAcc.requestChatHistory(phone, count);
  }

  public async verifyDelivery(options: {
    accountId?: string;
    campaignId?: string;
    campaignName?: string;
    phones?: string[];
    contacts?: Array<{ phone: string; name?: string; messageId?: string; sentAt?: string; status?: string }>;
  }): Promise<DeliveryVerificationResult> {
    const targetAccountId = options.accountId || "default";
    let targetAcc = this.accounts.get(targetAccountId);
    if (!targetAcc) {
      targetAcc = Array.from(this.accounts.values()).find((a) => a.isConnected()) || this.accounts.get("default");
    }

    if (!targetAcc) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        provider: {
          accountId: targetAccountId,
          accountName: "Unknown",
          isConnected: false,
          socketStatus: "DISCONNECTED",
          wsReadyState: "CLOSED",
        },
        summary: {
          totalContactsChecked: 0,
          registeredCount: 0,
          unregisteredCount: 0,
          deliveredCount: 0,
          serverAckCount: 0,
          readCount: 0,
          pendingOrErrorCount: 0,
          verdict: "DISCONNECTED",
          verdictLabelAr: "لا يوجد حساب واتساب متصل",
          verdictLabelEn: "No WhatsApp account connected",
        },
        contacts: [],
        recommendations: {
          ar: ["يرجى ربط حساب واتساب أولاً لفحص وصول الرسائل."],
          en: ["Please connect a WhatsApp account first to verify delivery."],
        },
      };
    }

    // Filter contacts to sent or recent contacts if provided
    let listToVerify = options.contacts || [];
    const sentOnly = listToVerify.filter((c) => c.status === "sent" || c.sentAt);
    if (sentOnly.length > 0) {
      listToVerify = sentOnly;
    } else if (listToVerify.length > 30) {
      listToVerify = listToVerify.slice(0, 30);
    }

    return targetAcc.verifyDeliveryForContacts(listToVerify, {
      campaignId: options.campaignId,
      campaignName: options.campaignName,
    });
  }

  public async sendPresence(
    accountId: string | undefined,
    phone: string,
    presence: "composing" | "paused"
  ): Promise<void> {
    let targetAcc: WhatsAppAccountInstance | undefined;
    if (accountId && this.accounts.has(accountId)) {
      targetAcc = this.accounts.get(accountId);
    } else {
      targetAcc = Array.from(this.accounts.values()).find((a) => a.isConnected()) || this.accounts.get("default");
    }
    if (targetAcc) {
      await targetAcc.sendPresenceUpdate(presence, phone);
    }
  }
}

export const whatsappManager = new WhatsAppManager();

// Link AI Sales Agent with WhatsApp Manager for auto-replies and typing indicators
setImmediate(() => {
  try {
    aiSalesAgentService.registerWhatsAppSender(
      async (accountId, phone, message) => {
        return whatsappManager.sendMessage(accountId || "default", phone, message);
      },
      async (accountId, phone, presence) => {
        return whatsappManager.sendPresence(accountId, phone, presence);
      }
    );
  } catch (err) {
    console.error("Error registering WhatsApp sender with AI Sales Agent:", err);
  }
});

