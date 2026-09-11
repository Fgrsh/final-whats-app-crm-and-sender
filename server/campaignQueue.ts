import fs from "fs";
import path from "path";
import { whatsappManager } from "./whatsappManager.ts";
import { personalizeMessage } from "./geminiService.ts";
import { normalizePhoneNumber, isSamePhoneNumber } from "./phoneUtils.ts";
import type { Contact, CampaignConfig, LogEntry, QueueProgress, CampaignBackup, CampaignItem } from "../src/types.ts";

export const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  template: "مرحباً {name}، نأمل أن تكون بأفضل حال. بخصوص {notes}، يسعدنا تواصلك معنا من شركة {company}.",
  useAI: true,
  aiInstruction: "صياغة ودودة واحترافية بدون مبالغة مع تنويع الكلمات",
  aiTone: "friendly",
  language: "ar",
  minDelay: 8,
  maxDelay: 20,
  enableBatchPause: true,
  batchSize: 10,
  batchPauseDuration: 200,
  sendMethod: "baileys",
  appendTimestampAndCode: true,
  enableDailyLimit: true,
  dailyLimit: 150,
  attachment: null,
};

export class CampaignInstance {
  public id: string;
  public name: string;
  public whatsappAccountId: string;
  public contacts: Contact[] = [];
  public config: CampaignConfig;
  public logs: LogEntry[] = [];
  public isRunning: boolean = false;
  public isPaused: boolean = false;
  public currentIndex: number = 0;
  public consecutiveErrors: number = 0;
  public sentToday: number = 0;
  public sentInCurrentBatch: number = 0;
  public currentDayDate: string = new Date().toISOString().slice(0, 10);
  public isWaitingForNextDay: boolean = false;
  public createdAt: string;
  public updatedAt: string;

  private timer: NodeJS.Timeout | null = null;
  private nextDayTimer: NodeJS.Timeout | null = null;
  private onStateChange?: () => void;

  constructor(
    data: {
      id: string;
      name: string;
      whatsappAccountId?: string;
      contacts?: Contact[];
      config?: CampaignConfig;
      logs?: LogEntry[];
      createdAt?: string;
      updatedAt?: string;
    },
    onStateChange?: () => void
  ) {
    this.id = data.id;
    this.name = data.name || "حملة تسويقية";
    this.whatsappAccountId = data.whatsappAccountId || "default";
    this.contacts = data.contacts || [];
    this.config = { ...DEFAULT_CAMPAIGN_CONFIG, ...(data.config || {}) };
    this.logs = data.logs || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.onStateChange = onStateChange;
  }

  public notifyChange() {
    this.updatedAt = new Date().toISOString();
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  public addLog(type: LogEntry["type"], message: string, phone?: string) {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour12: true }),
      type,
      message,
      phone,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 200) {
      this.logs = this.logs.slice(0, 200);
    }
    this.notifyChange();
  }

  public getStatus(): {
    progress: QueueProgress;
    contacts: Contact[];
    config: CampaignConfig;
    logs: LogEntry[];
  } {
    const total = this.contacts.length;
    const sent = this.contacts.filter((c) => c.status === "sent").length;
    const failed = this.contacts.filter((c) => c.status === "failed").length;
    const pending = this.contacts.filter((c) => c.status === "pending" || c.status === "generating" || c.status === "sending").length;

    let estimatedSecondsLeft = 0;
    if (this.isRunning && pending > 0) {
      const avgDelay = (this.config.minDelay + this.config.maxDelay) / 2;
      estimatedSecondsLeft = Math.round(pending * avgDelay);
      if (this.config.enableBatchPause && this.config.batchSize > 0) {
        const batchesLeft = Math.floor(pending / this.config.batchSize);
        estimatedSecondsLeft += batchesLeft * (this.config.batchPauseDuration || 200);
      }
    }

    const currentContact = this.contacts[this.currentIndex];

    return {
      progress: {
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        total,
        sent,
        failed,
        pending,
        currentIndex: this.currentIndex,
        currentContactId: currentContact?.id,
        estimatedSecondsLeft,
        sentToday: this.sentToday,
        dailyLimit: this.config.dailyLimit,
        isWaitingForNextDay: this.isWaitingForNextDay,
        currentDayDate: this.currentDayDate,
      },
      contacts: this.contacts,
      config: this.config,
      logs: this.logs,
    };
  }

  public getItem(): CampaignItem {
    const status = this.getStatus();
    let currentStatus: CampaignItem["status"] = "idle";
    if (this.isRunning) currentStatus = "running";
    else if (this.isPaused) currentStatus = "paused";
    else if (status.progress.total > 0 && status.progress.pending === 0) currentStatus = "completed";

    return {
      id: this.id,
      name: this.name,
      whatsappAccountId: this.whatsappAccountId,
      status: currentStatus,
      contacts: this.contacts,
      config: this.config,
      progress: status.progress,
      logs: this.logs,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  public setContacts(contacts: Contact[]): void {
    const map = new Map<string, Contact>();
    for (const c of contacts) {
      const norm = normalizePhoneNumber(c.phone);
      if (!norm || norm.length < 7) continue;
      if (map.has(norm)) {
        const existing = map.get(norm)!;
        if (!existing.name && c.name) existing.name = c.name;
        if (!existing.company && c.company) existing.company = c.company;
        if (!existing.notes && c.notes) existing.notes = c.notes;
      } else {
        map.set(norm, {
          ...c,
          phone: norm,
          status: c.status || "pending",
          groupName: c.groupName || "افتراضية",
        });
      }
    }
    this.contacts = Array.from(map.values());
    this.currentIndex = 0;
    this.sentInCurrentBatch = 0;
    this.addLog("info", `تم تحديث جهات اتصال الحملة وتصفية أي تكرارات (${this.contacts.length} رقم فريد)`);
    this.notifyChange();
  }

  public addContact(contact: Contact): void {
    const norm = normalizePhoneNumber(contact.phone);
    if (!norm || norm.length < 7) return;

    const existing = this.contacts.find((c) => isSamePhoneNumber(c.phone, norm));
    if (existing) {
      Object.assign(existing, {
        ...contact,
        phone: norm,
      });
      this.addLog("info", `تم تحديث بيانات جهة الاتصال: ${contact.name || norm}`);
    } else {
      this.contacts.push({
        ...contact,
        phone: norm,
        status: "pending",
        groupName: contact.groupName || "افتراضية",
      });
      this.addLog("info", `تمت إضافة جهة اتصال فريدة: ${contact.name || norm}`);
    }
    this.notifyChange();
  }

  public addContacts(newContacts: Contact[], groupName?: string): { addedCount: number; duplicateCount: number } {
    const existingPhones = new Set<string>();
    this.contacts.forEach((c) => {
      const norm = normalizePhoneNumber(c.phone);
      if (norm) existingPhones.add(norm);
    });

    let addedCount = 0;
    let duplicateCount = 0;

    for (const c of newContacts) {
      const norm = normalizePhoneNumber(c.phone);
      if (!norm || norm.length < 7) continue;

      if (!existingPhones.has(norm)) {
        this.contacts.push({
          ...c,
          phone: norm,
          status: "pending",
          groupName: groupName || c.groupName || "افتراضية",
        });
        existingPhones.add(norm);
        addedCount++;
      } else {
        duplicateCount++;
      }
    }
    this.addLog("info", `تم استيراد ${addedCount} جهة اتصال جديدة للحملة (تم منع وتخطي ${duplicateCount} رقم مكرر)`);
    this.notifyChange();
    return { addedCount, duplicateCount };
  }

  public deduplicateContacts(): { removedCount: number; remainingCount: number } {
    const initialCount = this.contacts.length;
    const map = new Map<string, Contact>();
    for (const c of this.contacts) {
      const norm = normalizePhoneNumber(c.phone);
      if (!norm || norm.length < 7) continue;
      if (!map.has(norm)) {
        map.set(norm, { ...c, phone: norm });
      } else {
        const existing = map.get(norm)!;
        if (!existing.name && c.name) existing.name = c.name;
        if (!existing.company && c.company) existing.company = c.company;
        if (!existing.notes && c.notes) existing.notes = c.notes;
      }
    }
    this.contacts = Array.from(map.values());
    const removedCount = initialCount - this.contacts.length;
    if (removedCount > 0) {
      this.addLog("info", `تم فحص وتنظيف قائمة الأرقام: تم إزالة ${removedCount} رقم مكرر (${this.contacts.length} رقم متبقي)`);
      this.notifyChange();
    }
    return { removedCount, remainingCount: this.contacts.length };
  }

  public updateContact(id: string, updated: Partial<Contact>): void {
    const idx = this.contacts.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.contacts[idx] = { ...this.contacts[idx], ...updated };
      this.notifyChange();
    }
  }

  public deleteContact(id: string): void {
    this.contacts = this.contacts.filter((c) => c.id !== id);
    this.addLog("info", "تم حذف جهة الاتصال من الحملة");
    this.notifyChange();
  }

  public deleteGroup(groupName: string): number {
    const initialCount = this.contacts.length;
    this.contacts = this.contacts.filter((c) => (c.groupName || "افتراضية") !== groupName);
    const removed = initialCount - this.contacts.length;
    this.addLog("info", `تم حذف مجموعة "${groupName}" (${removed} رقم) من الحملة`);
    this.notifyChange();
    return removed;
  }

  public resetGroup(groupName: string): number {
    let count = 0;
    this.contacts.forEach((c) => {
      if ((c.groupName || "افتراضية") === groupName) {
        c.status = "pending";
        c.errorMessage = undefined;
        c.personalizedMessage = undefined;
        c.sentAt = undefined;
        count++;
      }
    });
    this.addLog("info", `تمت إعادة تعيين حالة ${count} جهة اتصال في مجموعة "${groupName}"`);
    this.notifyChange();
    return count;
  }

  public renameGroup(oldName: string, newName: string): number {
    let count = 0;
    this.contacts.forEach((c) => {
      if ((c.groupName || "افتراضية") === oldName) {
        c.groupName = newName;
        count++;
      }
    });
    this.addLog("info", `تمت إعادة تسمية المجموعة من "${oldName}" إلى "${newName}" (${count} رقم)`);
    this.notifyChange();
    return count;
  }

  public updateConfig(newConfig: Partial<CampaignConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.addLog("info", "تم تحديث إعدادات الحملة بنجاح");
    this.notifyChange();
  }

  public checkDayReset() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDayDate) {
      this.currentDayDate = today;
      this.sentToday = 0;
      this.isWaitingForNextDay = false;
      this.addLog("info", `يوم عمل جديد (${today}): تمت إعادة تصفير عداد الإرسال اليومي للحملة.`);
      this.notifyChange();
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    if (this.contacts.length === 0) {
      throw new Error("لا توجد جهات اتصال في قائمة هذه الحملة للبدء");
    }

    if (this.config.sendMethod === "baileys") {
      const isAccConnected = whatsappManager.isConnected(this.whatsappAccountId);
      if (!isAccConnected) {
        throw new Error(
          `حساب الواتساب المحدد لهذه الحملة (${this.whatsappAccountId}) غير متصل. يرجى ربطه أولاً.`
        );
      }
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isWaitingForNextDay = false;
    this.consecutiveErrors = 0;
    this.addLog("info", `بدء إرسال الحملة (${this.name}) لـ ${this.contacts.length} جهة اتصال...`);
    this.notifyChange();

    this.processNext();
  }

  public pause(): void {
    if (!this.isRunning) return;
    this.isPaused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.nextDayTimer) {
      clearTimeout(this.nextDayTimer);
      this.nextDayTimer = null;
    }
    this.addLog("warning", `تم إيقاف الحملة (${this.name}) مؤقتاً (Pause)`);
    this.notifyChange();
  }

  public resume(): void {
    if (!this.isRunning && !this.isPaused) return;
    this.isRunning = true;
    this.isPaused = false;
    this.isWaitingForNextDay = false;
    this.addLog("info", `تم استئناف إرسال الحملة (${this.name})`);
    this.notifyChange();
    this.processNext();
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.isWaitingForNextDay = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.nextDayTimer) {
      clearTimeout(this.nextDayTimer);
      this.nextDayTimer = null;
    }
    this.addLog("warning", `تم إيقاف الحملة (${this.name}) نهائياً`);
    this.notifyChange();
  }

  public clear(): void {
    this.stop();
    this.contacts = [];
    this.currentIndex = 0;
    this.sentInCurrentBatch = 0;
    this.addLog("warning", "تم مسح قائمة جهات الاتصال بالكامل");
    this.notifyChange();
  }

  public reset(): void {
    this.stop();
    this.contacts.forEach((c) => {
      c.status = "pending";
      c.errorMessage = undefined;
      c.personalizedMessage = undefined;
      c.sentAt = undefined;
    });
    this.currentIndex = 0;
    this.sentInCurrentBatch = 0;
    this.addLog("info", "تمت إعادة تعيين حالة جميع جهات الاتصال للبدء من جديد");
    this.notifyChange();
  }

  public overrideDailyLimit(): void {
    this.isWaitingForNextDay = false;
    if (this.nextDayTimer) {
      clearTimeout(this.nextDayTimer);
      this.nextDayTimer = null;
    }
    this.addLog("info", "تم تجاوز الحد اليومي يدوياً بطلب من المستخدم، والاستمرار في الإرسال...");
    if (this.isRunning && !this.isPaused) {
      this.processNext();
    } else {
      this.resume();
    }
  }

  private getRandomDelay(): number {
    const min = Math.max(1, this.config.minDelay);
    const max = Math.max(min, this.config.maxDelay);
    const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
    return seconds * 1000;
  }

  private appendUniqueFooter(message: string): string {
    if (!this.config.appendTimestampAndCode) {
      return message;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const refCode = Math.random().toString(36).substring(2, 7).toUpperCase();

    const isAr = this.config.language === "ar";
    const footer = isAr
      ? `\n\n────────────────\n🕒 ${dateStr} ${timeStr} • كود التحقق: #${refCode}`
      : `\n\n────────────────\n🕒 ${dateStr} ${timeStr} • Ref Code: #${refCode}`;

    return message + footer;
  }

  private async processNext(): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    this.checkDayReset();

    if (this.config.enableDailyLimit && this.config.dailyLimit > 0 && this.sentToday >= this.config.dailyLimit) {
      this.isWaitingForNextDay = true;
      this.addLog(
        "warning",
        `🛑 تم الوصول للحد اليومي المحدد (${this.sentToday} من ${this.config.dailyLimit} رسالة). سيتم التوقف مؤقتاً لحماية الحساب والاستكمال تلقائياً غداً.`
      );

      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);
      const msUntilTomorrow = Math.max(10000, tomorrow.getTime() - now.getTime());

      this.nextDayTimer = setTimeout(() => {
        this.addLog("info", "🌅 حل اليوم الجديد! جاري استئناف إرسال باقي أرقام الحملة تلقائياً...");
        this.sentToday = 0;
        this.isWaitingForNextDay = false;
        this.processNext();
      }, msUntilTomorrow);

      return;
    }

    const nextIdx = this.contacts.findIndex((c, idx) => idx >= this.currentIndex && c.status === "pending");

    if (nextIdx === -1) {
      this.isRunning = false;
      this.addLog("success", `🎉 اكتملت الحملة (${this.name}) بنجاح! تم إرسال جميع الرسائل.`);
      this.notifyChange();
      return;
    }

    this.currentIndex = nextIdx;
    const contact = this.contacts[nextIdx];
    contact.status = "generating";

    try {
      this.addLog("info", `تجهيز الرسالة لـ: ${contact.name || contact.phone}`, contact.phone);

      const recipientData = {
        name: contact.name || "",
        phone: contact.phone || "",
        company: contact.company || "",
        notes: contact.notes || "",
        ...contact.customFields,
      };

      let baseMessage = await personalizeMessage({
        template: this.config.template,
        contactData: recipientData,
        instruction: this.config.aiInstruction,
        tone: this.config.aiTone,
        language: this.config.language,
      });

      const finalMessage = this.appendUniqueFooter(baseMessage);
      contact.personalizedMessage = finalMessage;
      contact.status = "sending";

      if (this.config.sendMethod === "baileys") {
        const sendRes = await whatsappManager.sendMessage(
          this.whatsappAccountId,
          contact.phone,
          finalMessage,
          this.config.attachment
        );

        if (sendRes.success) {
          contact.status = "sent";
          contact.sentAt = new Date().toISOString();
          contact.messageId = sendRes.messageId;
          contact.deliveryStatus = "server_ack";
          this.consecutiveErrors = 0;
          this.sentToday++;
          this.sentInCurrentBatch++;
          this.addLog(
            "success",
            `تم إرسال الرسالة ${this.config.attachment ? "مع المرفق " : ""}بنجاح إلى: ${contact.name || contact.phone} (${this.sentToday}/${this.config.dailyLimit} اليوم)`,
            contact.phone
          );
        } else {
          contact.status = "failed";
          contact.errorMessage = sendRes.error;
          contact.deliveryStatus = "failed";
          this.consecutiveErrors++;
          this.addLog("error", `فشل الإرسال إلى ${contact.phone}: ${sendRes.error}`, contact.phone);
        }
      } else {
        contact.status = "sent";
        contact.sentAt = new Date().toISOString();
        this.sentToday++;
        this.sentInCurrentBatch++;
        this.addLog("info", `تم تجهيز رابط المحادثة المباشر لـ: ${contact.phone}`, contact.phone);
      }

      this.notifyChange();

      if (this.consecutiveErrors >= 5) {
        this.pause();
        this.addLog(
          "error",
          "⚠️ تم إيقاف الحملة مؤقتاً تلقائياً لوجود 5 أخطاء متتالية لحماية رقمك من قيود واتساب."
        );
        return;
      }
    } catch (err: any) {
      contact.status = "failed";
      contact.errorMessage = err?.message || "خطأ غير متوقع";
      this.consecutiveErrors++;
      this.addLog("error", `خطأ أثناء معالجة الرقم ${contact.phone}: ${err?.message}`, contact.phone);
      this.notifyChange();
    }

    this.currentIndex++;

    if (
      this.isRunning &&
      !this.isPaused &&
      !this.isWaitingForNextDay &&
      this.currentIndex < this.contacts.length &&
      this.config.enableBatchPause &&
      this.config.batchSize > 0 &&
      this.sentInCurrentBatch >= this.config.batchSize
    ) {
      this.sentInCurrentBatch = 0;
      const baseSec = Math.max(10, Number(this.config.batchPauseDuration) || 200);
      const jitter = Math.floor(Math.random() * 31) - 15;
      const actualPauseSec = Math.max(10, baseSec + jitter);
      const pauseMs = actualPauseSec * 1000;

      this.addLog(
        "warning",
        `🛡️ فصل أمان عشوائي بعد إرسال دفعة من ${this.config.batchSize} رسائل: توقف مؤقت لحماية الحساب مدته ${actualPauseSec} ثانية (~${(actualPauseSec / 60).toFixed(1)} دقيقة)...`
      );

      this.timer = setTimeout(() => {
        this.addLog("info", "▶️ انتهاء فترة الفصل الأمني، استئناف الإرسال تلقائياً...");
        this.processNext();
      }, pauseMs);
      return;
    }

    if (this.isRunning && !this.isPaused && !this.isWaitingForNextDay && this.currentIndex < this.contacts.length) {
      const delayMs = this.getRandomDelay();
      const delaySec = (delayMs / 1000).toFixed(1);
      this.addLog("info", `⏳ انتظار فاصل أمني عشوائي (${delaySec} ثوانٍ) قبل الرقم القادم...`);

      this.timer = setTimeout(() => {
        this.processNext();
      }, delayMs);
    } else if (this.currentIndex >= this.contacts.length) {
      this.isRunning = false;
      this.addLog("success", `تم الانتهاء من فحص وإرسال جميع أرقام الحملة (${this.name})!`);
      this.notifyChange();
    }
  }

  public async previewAIMessage(sampleContact?: Partial<Contact>): Promise<string> {
    const contactData = {
      name: sampleContact?.name || "أحمد محمد",
      company: sampleContact?.company || "التقنية الحديثة",
      notes: sampleContact?.notes || "تأكيد موعد الاستشارة غداً في تمام الساعة 5 مساءً",
      phone: sampleContact?.phone || "+201012345678",
      ...sampleContact?.customFields,
    };

    const base = await personalizeMessage({
      template: this.config.template,
      contactData,
      instruction: this.config.aiInstruction,
      tone: this.config.aiTone,
      language: this.config.language,
    });

    return this.appendUniqueFooter(base);
  }
}

class CampaignManager {
  private dataDir: string = path.join(process.cwd(), "data");
  private campaignsFile: string = path.join(process.cwd(), "data", "campaigns.json");
  private legacyContactsFile: string = path.join(process.cwd(), "data", "campaign_contacts.json");
  private legacyConfigFile: string = path.join(process.cwd(), "data", "campaign_config.json");
  private legacyLogsFile: string = path.join(process.cwd(), "data", "campaign_logs.json");

  private campaigns: Map<string, CampaignInstance> = new Map();
  public activeCampaignId: string = "camp_default";

  constructor() {
    this.ensureDataDir();
    this.loadSavedData();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (e) {
      console.error("Error creating data dir:", e);
    }
  }

  private loadSavedData() {
    let loaded = false;

    // 1. Try loading from campaigns.json
    if (fs.existsSync(this.campaignsFile)) {
      try {
        const raw = fs.readFileSync(this.campaignsFile, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          for (const item of list) {
            const instance = new CampaignInstance(item, () => this.saveAll());
            this.campaigns.set(item.id, instance);
          }
          if (this.campaigns.has(list[0].id)) {
            this.activeCampaignId = list[0].id;
          }
          loaded = true;
          console.log(`Loaded ${this.campaigns.size} campaigns from campaigns.json`);
        }
      } catch (e) {
        console.error("Error reading campaigns.json:", e);
      }
    }

    // 2. Fallback to legacy single campaign files if campaigns.json didn't load
    if (!loaded) {
      let contacts: Contact[] = [];
      let config: CampaignConfig = { ...DEFAULT_CAMPAIGN_CONFIG };
      let logs: LogEntry[] = [];

      try {
        if (fs.existsSync(this.legacyContactsFile)) {
          const raw = JSON.parse(fs.readFileSync(this.legacyContactsFile, "utf-8"));
          if (Array.isArray(raw)) contacts = raw;
        }
      } catch {}

      try {
        if (fs.existsSync(this.legacyConfigFile)) {
          const raw = JSON.parse(fs.readFileSync(this.legacyConfigFile, "utf-8"));
          config = { ...config, ...raw };
        }
      } catch {}

      try {
        if (fs.existsSync(this.legacyLogsFile)) {
          const raw = JSON.parse(fs.readFileSync(this.legacyLogsFile, "utf-8"));
          if (Array.isArray(raw)) logs = raw.slice(0, 200);
        }
      } catch {}

      const defaultCamp = new CampaignInstance(
        {
          id: "camp_default",
          name: "الحملة التسويقية الرئيسية",
          whatsappAccountId: "default",
          contacts,
          config,
          logs,
        },
        () => this.saveAll()
      );
      this.campaigns.set(defaultCamp.id, defaultCamp);
      this.activeCampaignId = defaultCamp.id;
      this.saveAll();
    }
  }

  public saveAll() {
    try {
      this.ensureDataDir();
      const list: any[] = [];
      this.campaigns.forEach((camp) => {
        list.push({
          id: camp.id,
          name: camp.name,
          whatsappAccountId: camp.whatsappAccountId,
          contacts: camp.contacts,
          config: camp.config,
          logs: camp.logs.slice(0, 150),
          createdAt: camp.createdAt,
          updatedAt: camp.updatedAt,
        });
      });

      fs.writeFileSync(this.campaignsFile, JSON.stringify(list, null, 2), "utf-8");

      // Also maintain legacy contacts and config for backward compatibility
      const active = this.getActiveCampaign();
      if (active) {
        fs.writeFileSync(this.legacyContactsFile, JSON.stringify(active.contacts, null, 2), "utf-8");
        fs.writeFileSync(this.legacyConfigFile, JSON.stringify(active.config, null, 2), "utf-8");
      }
    } catch (e) {
      console.error("Error saving campaigns:", e);
    }
  }

  public getCampaigns(): CampaignItem[] {
    return Array.from(this.campaigns.values()).map((c) => c.getItem());
  }

  public getCampaign(id: string): CampaignInstance | undefined {
    return this.campaigns.get(id);
  }

  public getActiveCampaign(): CampaignInstance {
    let camp = this.campaigns.get(this.activeCampaignId);
    if (!camp) {
      camp = Array.from(this.campaigns.values())[0];
    }
    if (!camp) {
      camp = new CampaignInstance(
        {
          id: "camp_default",
          name: "الحملة التسويقية الرئيسية",
          whatsappAccountId: "default",
          contacts: [],
          config: { ...DEFAULT_CAMPAIGN_CONFIG },
        },
        () => this.saveAll()
      );
      this.campaigns.set(camp.id, camp);
      this.activeCampaignId = camp.id;
      this.saveAll();
    }
    return camp;
  }

  public setActiveCampaign(id: string) {
    if (this.campaigns.has(id)) {
      this.activeCampaignId = id;
    }
  }

  public createCampaign(
    name?: string,
    whatsappAccountId?: string,
    contacts?: Contact[],
    config?: CampaignConfig
  ): CampaignItem {
    const id = `camp_${Date.now()}`;
    const campName = name || `حملة تسويقية (${this.campaigns.size + 1})`;
    const instance = new CampaignInstance(
      {
        id,
        name: campName,
        whatsappAccountId: whatsappAccountId || "default",
        contacts: contacts || [],
        config: config || { ...DEFAULT_CAMPAIGN_CONFIG },
      },
      () => this.saveAll()
    );

    this.campaigns.set(id, instance);
    this.saveAll();
    return instance.getItem();
  }

  public deleteCampaign(id: string): boolean {
    if (this.campaigns.size <= 1) {
      // Don't delete the last campaign, just clear it
      const camp = this.campaigns.get(id);
      if (camp) {
        camp.clear();
      }
      return true;
    }

    const camp = this.campaigns.get(id);
    if (camp) {
      camp.stop();
      this.campaigns.delete(id);
      if (this.activeCampaignId === id) {
        this.activeCampaignId = Array.from(this.campaigns.keys())[0];
      }
      this.saveAll();
      return true;
    }
    return false;
  }

  public restoreBackupCampaigns(backupList: any[]): { restoredCount: number } {
    if (!Array.isArray(backupList) || backupList.length === 0) {
      return { restoredCount: 0 };
    }

    let restoredCount = 0;
    for (const item of backupList) {
      if (!item || !item.id) continue;
      const existing = this.campaigns.get(item.id);
      if (existing) {
        if (Array.isArray(item.contacts)) existing.setContacts(item.contacts);
        if (item.config) existing.updateConfig(item.config);
        if (item.name) existing.name = item.name;
        if (item.whatsappAccountId) existing.whatsappAccountId = item.whatsappAccountId;
      } else {
        const instance = new CampaignInstance(item, () => this.saveAll());
        this.campaigns.set(item.id, instance);
        restoredCount++;
      }
    }
    this.saveAll();
    return { restoredCount };
  }

  public reloadAll() {
    this.campaigns.clear();
    this.loadSavedData();
  }

  // --- Delegators to Active Campaign for 100% Backward Compatibility ---

  public getStatus() {
    return this.getActiveCampaign().getStatus();
  }

  public setContacts(contacts: Contact[]) {
    this.getActiveCampaign().setContacts(contacts);
  }

  public addContact(contact: Contact) {
    this.getActiveCampaign().addContact(contact);
  }

  public addContacts(newContacts: Contact[], groupName?: string) {
    return this.getActiveCampaign().addContacts(newContacts, groupName);
  }

  public deduplicateContacts(campaignId?: string) {
    if (campaignId && this.campaigns.has(campaignId)) {
      return this.campaigns.get(campaignId)!.deduplicateContacts();
    }
    return this.getActiveCampaign().deduplicateContacts();
  }

  public updateContact(id: string, updated: Partial<Contact>) {
    this.getActiveCampaign().updateContact(id, updated);
  }

  public deleteContact(id: string) {
    this.getActiveCampaign().deleteContact(id);
  }

  public deleteGroup(groupName: string) {
    return this.getActiveCampaign().deleteGroup(groupName);
  }

  public resetGroup(groupName: string) {
    return this.getActiveCampaign().resetGroup(groupName);
  }

  public renameGroup(oldName: string, newName: string) {
    return this.getActiveCampaign().renameGroup(oldName, newName);
  }

  public updateConfig(newConfig: Partial<CampaignConfig>) {
    this.getActiveCampaign().updateConfig(newConfig);
  }

  public async start() {
    return this.getActiveCampaign().start();
  }

  public pause() {
    this.getActiveCampaign().pause();
  }

  public resume() {
    this.getActiveCampaign().resume();
  }

  public stop() {
    this.getActiveCampaign().stop();
  }

  public clear() {
    this.getActiveCampaign().clear();
  }

  public reset() {
    this.getActiveCampaign().reset();
  }

  public overrideDailyLimit() {
    this.getActiveCampaign().overrideDailyLimit();
  }

  public async previewAIMessage(sampleContact?: Partial<Contact>) {
    return this.getActiveCampaign().previewAIMessage(sampleContact);
  }

  public addLog(type: LogEntry["type"], message: string, phone?: string) {
    this.getActiveCampaign().addLog(type, message, phone);
  }

  public saveContacts() {
    this.saveAll();
  }

  public exportBackup(): CampaignBackup {
    const active = this.getActiveCampaign();
    const status = active.getStatus();
    return {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      appName: "WhatsApp AI Bulk Sender",
      summary: {
        totalContacts: status.progress.total,
        sentContacts: status.progress.sent,
        pendingContacts: status.progress.pending,
        failedContacts: status.progress.failed,
        totalLogs: active.logs.length,
      },
      config: active.config,
      contacts: active.contacts,
      logs: active.logs,
    };
  }

  public importBackup(backupData: any, mode: "overwrite" | "merge" = "overwrite") {
    if (!backupData || !Array.isArray(backupData.contacts)) {
      throw new Error("تنسيق ملف النسخة الاحتياطية غير صالح (contacts array missing)");
    }

    const active = this.getActiveCampaign();
    if (mode === "overwrite") {
      active.contacts = backupData.contacts;
      if (backupData.config) {
        active.config = { ...DEFAULT_CAMPAIGN_CONFIG, ...backupData.config };
      }
      if (Array.isArray(backupData.logs)) {
        active.logs = backupData.logs.slice(0, 200);
      }
      active.currentIndex = 0;
      active.sentInCurrentBatch = 0;
    } else {
      active.addContacts(backupData.contacts);
      if (Array.isArray(backupData.logs)) {
        active.logs = [...backupData.logs.slice(0, 50), ...active.logs].slice(0, 200);
      }
    }

    this.saveAll();
    return {
      importedContactsCount: backupData.contacts.length,
      mode,
    };
  }
}

export const campaignQueue = new CampaignManager();
