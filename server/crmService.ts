import fs from "fs";
import path from "path";
import type { CRMLead, ExtractedMessage, ExtractedChatSummary, FollowUpActivity, Contact } from "../src/types.ts";
import { analyzeLeadWithGemini } from "./geminiService.ts";
import { campaignQueue } from "./campaignQueue.ts";
import { normalizePhoneNumber, isSamePhoneNumber } from "./phoneUtils.ts";

class CRMService {
  private dataDir: string;
  private leadsFile: string;
  private messagesFile: string;
  private chatsFile: string;
  private contactsFile: string;
  private sessionDir: string;
  private leads: CRMLead[] = [];
  private messagesByPhone: Map<string, ExtractedMessage[]> = new Map();
  private chatSummaries: Map<
    string,
    {
      name: string;
      unreadCount: number;
      lastActive: string;
      lastMessage?: string;
      accountId?: string;
      accountName?: string;
    }
  > = new Map();
  private contactNames: Map<string, string> = new Map();
  private lidToPhoneMap: Map<string, string> = new Map();
  private phoneToLidMap: Map<string, string> = new Map();

  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
    this.leadsFile = path.join(this.dataDir, "crm_leads.json");
    this.messagesFile = path.join(this.dataDir, "crm_messages.json");
    this.chatsFile = path.join(this.dataDir, "crm_chats.json");
    this.contactsFile = path.join(this.dataDir, "crm_contacts.json");
    this.sessionDir = path.join(this.dataDir, "sessions");

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.precomputeLidMappings();
    this.loadData();
    this.syncChatsFromSession();
  }

  public precomputeLidMappings() {
    if (!fs.existsSync(this.sessionDir)) return;
    try {
      const files = fs.readdirSync(this.sessionDir);
      const lidFiles = files.filter((f) => f.startsWith("lid-mapping-") && f.endsWith("_reverse.json"));
      for (const f of lidFiles) {
        const lid = f.replace("lid-mapping-", "").replace("_reverse.json", "");
        try {
          const raw = fs.readFileSync(path.join(this.sessionDir, f), "utf-8");
          const phone = String(JSON.parse(raw) || "").replace(/[^0-9]/g, "");
          if (lid && phone && phone.length >= 7) {
            this.lidToPhoneMap.set(lid, phone);
            this.phoneToLidMap.set(phone, lid);
          }
        } catch {}
      }
    } catch (e) {
      console.error("Error precomputing LID mappings:", e);
    }
  }

  public resolvePhone(rawJidOrPhone: string): string {
    if (!rawJidOrPhone) return "";
    const base = rawJidOrPhone.split("@")[0] || "";
    const cleanId = base.split(":")[0].replace(/[^0-9]/g, "");
    if (!cleanId) return "";

    // 1. Fast in-memory cache
    if (this.lidToPhoneMap.has(cleanId)) {
      return this.lidToPhoneMap.get(cleanId)!;
    }

    // 2. Check if LID reverse mapping exists on disk
    if (fs.existsSync(this.sessionDir)) {
      const reverseFile = path.join(this.sessionDir, `lid-mapping-${cleanId}_reverse.json`);
      if (fs.existsSync(reverseFile)) {
        try {
          const mapped = JSON.parse(fs.readFileSync(reverseFile, "utf-8"));
          if (mapped) {
            const cleanMapped = String(mapped).replace(/[^0-9]/g, "");
            if (cleanMapped.length >= 7) {
              this.lidToPhoneMap.set(cleanId, cleanMapped);
              this.phoneToLidMap.set(cleanMapped, cleanId);
              return cleanMapped;
            }
          }
        } catch (e) {}
      }
    }

    return cleanId;
  }

  private loadData() {
    try {
      if (fs.existsSync(this.leadsFile)) {
        const raw = fs.readFileSync(this.leadsFile, "utf-8");
        this.leads = JSON.parse(raw);
      } else {
        this.leads = [];
        this.saveLeads();
      }
    } catch (e) {
      console.error("Error loading CRM leads:", e);
      this.leads = [];
    }

    try {
      if (fs.existsSync(this.messagesFile)) {
        const raw = fs.readFileSync(this.messagesFile, "utf-8");
        const list: ExtractedMessage[] = JSON.parse(raw);
        list.forEach((msg) => {
          const rawClean = (msg.phone || "").replace(/[^0-9]/g, "");
          const cleanPhone = this.resolvePhone(rawClean) || rawClean;
          if (cleanPhone) {
            const arr = this.messagesByPhone.get(cleanPhone) || [];
            if (!arr.some((m) => m.id === msg.id)) {
              arr.push({ ...msg, phone: cleanPhone });
              this.messagesByPhone.set(cleanPhone, arr);
            }
          }
        });
      } else {
        this.messagesByPhone.clear();
        this.saveMessages();
      }
    } catch (e) {
      console.error("Error loading CRM messages:", e);
    }

    try {
      if (fs.existsSync(this.contactsFile)) {
        const raw = fs.readFileSync(this.contactsFile, "utf-8");
        const obj = JSON.parse(raw);
        Object.entries(obj).forEach(([phone, name]) => {
          if (phone && name) this.contactNames.set(phone, String(name));
        });
      }
    } catch (e) {
      console.error("Error loading CRM contacts:", e);
    }

    try {
      if (fs.existsSync(this.chatsFile)) {
        const raw = fs.readFileSync(this.chatsFile, "utf-8");
        const list = JSON.parse(raw);
        list.forEach((item: any) => {
          if (item.phone) {
            const resolved = this.resolvePhone(item.phone);
            this.chatSummaries.set(resolved, {
              name: item.name || this.contactNames.get(resolved) || `+${resolved}`,
              unreadCount: item.unreadCount || 0,
              lastActive: item.lastActive || new Date().toISOString(),
              lastMessage: item.lastMessage || "",
              accountId: item.accountId || "default",
              accountName: item.accountName,
            });
          }
        });
      }
    } catch (e) {
      console.error("Error loading CRM chats:", e);
    }
  }

  private lastSyncTime: number = 0;

  public syncChatsFromSession(targetAccountId?: string) {
    if (!fs.existsSync(this.sessionDir)) return;
    this.precomputeLidMappings();

    try {
      let newFound = 0;
      const dirsToScan: Array<{ dir: string; accountId: string }> = [
        { dir: this.sessionDir, accountId: "default" }
      ];

      // Also scan accounts subdirectories
      const accountsDir = path.join(this.sessionDir, "accounts");
      if (fs.existsSync(accountsDir)) {
        try {
          const accDirs = fs.readdirSync(accountsDir, { withFileTypes: true });
          for (const d of accDirs) {
            if (d.isDirectory()) {
              dirsToScan.push({ dir: path.join(accountsDir, d.name), accountId: d.name });
            }
          }
        } catch {}
      }

      const activeDirs = (targetAccountId && targetAccountId !== "all")
        ? dirsToScan.filter((d) => d.accountId === targetAccountId)
        : dirsToScan;

      for (const { dir: currentDir, accountId } of activeDirs) {
        if (!fs.existsSync(currentDir)) continue;
        const files = fs.readdirSync(currentDir);

        // 1. Sync from device-list files (device-list-<phone>.json)
        const devFiles = files.filter((f) => f.startsWith("device-list-") && f.endsWith(".json"));
        for (const f of devFiles) {
          try {
            const raw = f.replace("device-list-", "").replace(".json", "");
            const phone = this.resolvePhone(raw);
            if (phone && phone.length >= 7) {
              if (!this.chatSummaries.has(phone)) {
                let lastActive = new Date().toISOString();
                try {
                  const stat = fs.statSync(path.join(currentDir, f));
                  if (stat?.mtime) lastActive = stat.mtime.toISOString();
                } catch {}
                const knownName = this.contactNames.get(phone) || `+${phone}`;
                this.chatSummaries.set(phone, {
                  name: knownName,
                  unreadCount: 0,
                  lastActive,
                  lastMessage: "جهة اتصال مسجلة",
                  accountId,
                });
                newFound++;
              }
            }
          } catch {}
        }

        // 2. Sync from session files (session-<id>_*.json)
        const sessFiles = files.filter((f) => f.startsWith("session-") && f.endsWith(".json"));
        for (const f of sessFiles) {
          try {
            const raw = f.replace("session-", "").split("_")[0];
            const phone = this.resolvePhone(raw);
            if (phone && phone.length >= 7) {
              if (!this.chatSummaries.has(phone)) {
                let lastActive = new Date().toISOString();
                try {
                  const stat = fs.statSync(path.join(currentDir, f));
                  if (stat?.mtime) lastActive = stat.mtime.toISOString();
                } catch {}
                const knownName = this.contactNames.get(phone) || `+${phone}`;
                this.chatSummaries.set(phone, {
                  name: knownName,
                  unreadCount: 0,
                  lastActive,
                  lastMessage: "محادثة سابقة عبر واتساب",
                  accountId,
                });
                newFound++;
              }
            }
          } catch {}
        }

        // 3. Sync from tctoken files (has explicit conversation timestamps)
        const tcFiles = files.filter((f) => f.startsWith("tctoken-") && f.endsWith(".json"));
        for (const f of tcFiles) {
          try {
            const rawId = f.replace("tctoken-", "").replace(".json", "");
            const phone = this.resolvePhone(rawId);
            if (!phone || phone.length < 7) continue;

            const content = JSON.parse(fs.readFileSync(path.join(currentDir, f), "utf-8"));
            const timestamp = content.timestamp
              ? new Date(Number(content.timestamp) * 1000).toISOString()
              : new Date().toISOString();

            const existing = this.chatSummaries.get(phone);
            const knownName = this.contactNames.get(phone) || (existing ? existing.name : "");

            if (!existing) {
              this.chatSummaries.set(phone, {
                name: knownName && !knownName.startsWith("+") ? knownName : `+${phone}`,
                unreadCount: 0,
                lastActive: timestamp,
                lastMessage: "محادثة نشطة عبر واتساب",
                accountId,
              });
              newFound++;
            } else if (!existing.lastActive || existing.lastActive < timestamp) {
              existing.lastActive = timestamp;
              if (knownName && (!existing.name || existing.name.startsWith("+"))) {
                existing.name = knownName;
              }
              if (accountId && (!existing.accountId || existing.accountId === "default")) {
                existing.accountId = accountId;
              }
            }
          } catch {}
        }
      }

      // 4. Sync from precomputed LID reverse mappings
      this.lidToPhoneMap.forEach((phone, lid) => {
        if (!phone || phone.length < 8) return;
        const existing = this.chatSummaries.get(phone);
        const knownName = this.contactNames.get(phone) || (existing ? existing.name : "");

        if (!existing) {
          let lastActive = new Date().toISOString();
          try {
            const stat = fs.statSync(path.join(this.sessionDir, `lid-mapping-${lid}_reverse.json`));
            if (stat && stat.mtime) {
              lastActive = stat.mtime.toISOString();
            }
          } catch {}

          this.chatSummaries.set(phone, {
            name: knownName && !knownName.startsWith("+") ? knownName : `+${phone}`,
            unreadCount: 0,
            lastActive,
            lastMessage: "محادثة نشطة عبر واتساب",
          });
          newFound++;
        } else if (knownName && (!existing.name || existing.name.startsWith("+"))) {
          existing.name = knownName;
        }
      });

      this.lastSyncTime = Date.now();
      if (newFound > 0) {
        console.log(`Synced ${this.chatSummaries.size} WhatsApp chats from session files (${newFound} newly discovered).`);
        this.saveChats();
      }
    } catch (err) {
      console.error("Error syncing chats from session:", err);
    }
  }

  private saveLeads() {
    try {
      fs.writeFileSync(this.leadsFile, JSON.stringify(this.leads, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving CRM leads:", e);
    }
  }

  private saveMessages() {
    try {
      const all: ExtractedMessage[] = [];
      this.messagesByPhone.forEach((msgs) => {
        all.push(...msgs.slice(-50)); // store recent messages per contact
      });
      fs.writeFileSync(this.messagesFile, JSON.stringify(all, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving CRM messages:", e);
    }
  }

  private saveChats() {
    try {
      const list: any[] = [];
      this.chatSummaries.forEach((val, phone) => {
        list.push({ phone, ...val });
      });
      fs.writeFileSync(this.chatsFile, JSON.stringify(list, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving CRM chats:", e);
    }
  }

  private saveContacts() {
    try {
      const obj: Record<string, string> = {};
      this.contactNames.forEach((name, phone) => {
        obj[phone] = name;
      });
      fs.writeFileSync(this.contactsFile, JSON.stringify(obj, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving CRM contacts:", e);
    }
  }

  // --- Real-time Message Recording from Baileys ---
  public handleIncomingWhatsAppMessage(msg: ExtractedMessage) {
    const cleanPhone = this.resolvePhone(msg.phone);
    if (!cleanPhone || cleanPhone.length < 7) return;

    // 1. Add to messages history
    const existing = this.messagesByPhone.get(cleanPhone) || [];
    if (!existing.some((m) => m.id === msg.id)) {
      existing.push({ ...msg, phone: cleanPhone });
      if (existing.length > 100) existing.shift();
      this.messagesByPhone.set(cleanPhone, existing);
    }

    // 2. Update contact name if provided
    if (msg.senderName && !msg.fromMe && !msg.senderName.startsWith("+")) {
      this.contactNames.set(cleanPhone, msg.senderName);
      this.saveContacts();
    }

    // 3. Update chat summary
    const summary = this.chatSummaries.get(cleanPhone) || {
      name: msg.senderName || this.contactNames.get(cleanPhone) || `+${cleanPhone}`,
      unreadCount: 0,
      lastActive: new Date().toISOString(),
      lastMessage: msg.text,
    };

    if (!msg.fromMe) {
      summary.unreadCount = (summary.unreadCount || 0) + 1;
    }
    if (msg.senderName && !msg.fromMe && (!summary.name || summary.name.startsWith("+"))) {
      summary.name = msg.senderName;
    }
    summary.lastActive = new Date().toISOString();
    summary.lastMessage = msg.fromMe ? `أنت: ${msg.text}` : msg.text;
    if (msg.accountId) summary.accountId = msg.accountId;
    if (msg.accountName) summary.accountName = msg.accountName;
    this.chatSummaries.set(cleanPhone, summary);

    // 4. Find if lead already exists in CRM
    const lead = this.leads.find((l) => l.phone === cleanPhone);
    if (lead) {
      lead.lastContactedAt = new Date().toISOString();
      lead.updatedAt = new Date().toISOString();
      if ((!lead.name || lead.name.includes("عميل") || lead.name === cleanPhone) && msg.senderName && !msg.fromMe) {
        lead.name = msg.senderName;
      }
      this.saveLeads();
    }

    this.saveMessages();
    this.saveChats();
  }

  public recordChatSummary(
    phone: string,
    name: string,
    unreadCount: number,
    lastActive?: string,
    accountId?: string,
    accountName?: string
  ) {
    const cleanPhone = this.resolvePhone(phone);
    if (!cleanPhone || cleanPhone.length < 7) return;

    const cur = this.chatSummaries.get(cleanPhone) || {
      name: name || this.contactNames.get(cleanPhone) || `+${cleanPhone}`,
      unreadCount,
      lastActive: lastActive || new Date().toISOString(),
      accountId: accountId || "default",
      accountName,
    };
    if (name && (!cur.name || cur.name.startsWith("+") || cur.name.includes("عميل"))) {
      cur.name = name;
      this.contactNames.set(cleanPhone, name);
      this.saveContacts();
    }
    cur.unreadCount = unreadCount;
    if (lastActive) cur.lastActive = lastActive;
    if (accountId) cur.accountId = accountId;
    if (accountName) cur.accountName = accountName;
    this.chatSummaries.set(cleanPhone, cur);
    this.saveChats();
  }

  public recordContactName(phone: string, name: string, accountId?: string, accountName?: string) {
    const cleanPhone = this.resolvePhone(phone);
    if (!name || !cleanPhone || cleanPhone.length < 7) return;

    this.contactNames.set(cleanPhone, name);
    this.saveContacts();

    const cur = this.chatSummaries.get(cleanPhone);
    if (cur) {
      cur.name = name;
      if (accountId) cur.accountId = accountId;
      if (accountName) cur.accountName = accountName;
      this.saveChats();
    } else {
      this.chatSummaries.set(cleanPhone, {
        name,
        unreadCount: 0,
        lastActive: new Date().toISOString(),
        lastMessage: "محادثة نشطة عبر واتساب",
        accountId: accountId || "default",
        accountName,
      });
      this.saveChats();
    }

    const lead = this.leads.find((l) => l.phone === cleanPhone);
    if (lead && (!lead.name || lead.name.includes("عميل") || lead.name === cleanPhone || lead.name.startsWith("+"))) {
      lead.name = name;
      this.saveLeads();
    }
  }

  // --- CRM Leads Retrieval & Management ---
  public getLeads(filters?: {
    stage?: string;
    priority?: string;
    search?: string;
    followUpDue?: boolean;
  }): CRMLead[] {
    let list = [...this.leads];

    if (filters?.stage && filters.stage !== "all") {
      list = list.filter((l) => l.stage === filters.stage);
    }
    if (filters?.priority && filters.priority !== "all") {
      list = list.filter((l) => l.priority === filters.priority);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.company && l.company.toLowerCase().includes(q)) ||
          l.tags.some((t) => t.toLowerCase().includes(q)) ||
          (l.notes && l.notes.toLowerCase().includes(q))
      );
    }
    if (filters?.followUpDue) {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter((l) => l.nextFollowUpDate && l.nextFollowUpDate <= today && !l.isFollowUpDone);
    }

    // Attach recent messages from cache
    return list.map((l) => ({
      ...l,
      recentMessages: (this.messagesByPhone.get(l.phone) || []).slice(-20),
    }));
  }

  public getLeadById(id: string): CRMLead | null {
    const lead = this.leads.find((l) => l.id === id);
    if (!lead) return null;
    return {
      ...lead,
      recentMessages: this.messagesByPhone.get(lead.phone) || [],
    };
  }

  public getMessagesForPhone(phone: string, filterAccountId?: string): ExtractedMessage[] {
    if (!phone) return [];
    const rawClean = phone.replace(/[^0-9]/g, "");
    if (!rawClean) return [];
    const resolvedPhone = this.resolvePhone(rawClean) || rawClean;

    let result: ExtractedMessage[] = [];

    // 1. Direct match by resolved phone
    let msgs = this.messagesByPhone.get(resolvedPhone);
    if (msgs && msgs.length > 0) {
      result = msgs;
    } else {
      // 2. Direct match by rawClean
      msgs = this.messagesByPhone.get(rawClean);
      if (msgs && msgs.length > 0) {
        result = msgs;
      } else {
        // 3. Match by mapped LID
        const lid = this.phoneToLidMap.get(resolvedPhone) || this.phoneToLidMap.get(rawClean);
        if (lid) {
          msgs = this.messagesByPhone.get(lid);
          if (msgs && msgs.length > 0) result = msgs;
        } else {
          // 4. Suffix matching (e.g. 1012345678 vs 201012345678)
          for (const [key, val] of this.messagesByPhone.entries()) {
            if ((key.length >= 8 && resolvedPhone.endsWith(key)) || (resolvedPhone.length >= 8 && key.endsWith(resolvedPhone))) {
              result = val;
              break;
            }
          }
        }
      }
    }

    if (filterAccountId && filterAccountId !== "all" && result.length > 0) {
      const filtered = result.filter((m) => !m.accountId || m.accountId === filterAccountId);
      return filtered.length > 0 ? filtered : result;
    }

    return result;
  }

  public recordOutgoingMessage(
    phone: string,
    text: string,
    accountId?: string,
    accountName?: string
  ): ExtractedMessage {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const now = new Date();
    const timeStr = now.toLocaleTimeString("ar-EG", { hour12: true });
    const newMsg: ExtractedMessage = {
      id: `sent-${Date.now()}`,
      phone: cleanPhone,
      senderName: "أنا",
      text,
      timestamp: timeStr,
      fromMe: true,
      accountId: accountId || "default",
      accountName,
    };

    const arr = this.messagesByPhone.get(cleanPhone) || [];
    arr.push(newMsg);
    this.messagesByPhone.set(cleanPhone, arr);
    this.saveMessages();

    const summary = this.chatSummaries.get(cleanPhone) || {
      name: cleanPhone,
      unreadCount: 0,
      lastActive: timeStr,
      accountId: accountId || "default",
      accountName,
    };
    summary.lastActive = timeStr;
    if (accountId) summary.accountId = accountId;
    if (accountName) summary.accountName = accountName;
    this.chatSummaries.set(cleanPhone, summary);

    const lead = this.leads.find((l) => l.phone === cleanPhone);
    if (lead) {
      lead.lastContactedAt = now.toISOString();
      lead.updatedAt = now.toISOString();
      if (!lead.activities) lead.activities = [];
      lead.activities.unshift({
        id: `act-${Date.now()}`,
        timestamp: timeStr,
        type: "whatsapp",
        title: accountName ? `رسالة واتساب (${accountName})` : "رسالة واتساب مرسلة",
        note: text.length > 80 ? text.slice(0, 80) + "..." : text,
      });
      this.saveLeads();
    }

    return newMsg;
  }

  public createLead(data: Partial<CRMLead>): CRMLead {
    const normPhone = normalizePhoneNumber(data.phone);
    if (!normPhone || normPhone.length < 7) {
      throw new Error("رقم الهاتف غير صالح لتسجيل العميل في الـ CRM");
    }

    // Check duplicate using normalized phone
    const existingIndex = this.leads.findIndex((l) => isSamePhoneNumber(l.phone, normPhone));
    if (existingIndex >= 0) {
      // Update existing lead
      this.leads[existingIndex] = {
        ...this.leads[existingIndex],
        ...data,
        phone: normPhone,
        updatedAt: new Date().toISOString(),
      };
      this.saveLeads();
      return this.leads[existingIndex];
    }

    const newLead: CRMLead = {
      id: `lead-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      phone: normPhone,
      rawPhone: data.rawPhone || data.phone || normPhone,
      name: data.name || `عميل (${normPhone.slice(-4)})`,
      company: data.company || "",
      stage: data.stage || "new",
      priority: data.priority || "medium",
      dealValue: data.dealValue || 0,
      tags: data.tags || ["جديد"],
      notes: data.notes || "",
      source: data.source || "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastContactedAt: data.lastContactedAt || new Date().toISOString(),
      nextFollowUpDate: data.nextFollowUpDate,
      nextFollowUpTime: data.nextFollowUpTime,
      nextFollowUpNote: data.nextFollowUpNote,
      isFollowUpDone: Boolean(data.isFollowUpDone),
      activities: data.activities || [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour12: true }),
          type: "note",
          title: "إنشاء ملف العميل",
          note: "تمت إضافة العميل إلى منظومة الـ CRM.",
        },
      ],
      recentMessages: this.messagesByPhone.get(normPhone) || [],
    };

    this.leads.unshift(newLead);
    this.saveLeads();
    return newLead;
  }

  public updateLead(id: string, updates: Partial<CRMLead>): CRMLead {
    const idx = this.leads.findIndex((l) => l.id === id);
    if (idx < 0) {
      throw new Error("العميل غير موجود");
    }

    this.leads[idx] = {
      ...this.leads[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveLeads();
    return this.leads[idx];
  }

  public deleteLead(id: string): boolean {
    const initialLen = this.leads.length;
    this.leads = this.leads.filter((l) => l.id !== id);
    if (this.leads.length !== initialLen) {
      this.saveLeads();
      return true;
    }
    return false;
  }

  public addActivity(
    leadId: string,
    activity: { type: FollowUpActivity["type"]; title: string; note: string; outcome?: string }
  ): FollowUpActivity {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("العميل غير موجود");

    const newAct: FollowUpActivity = {
      id: `act-${Date.now().toString(36)}`,
      timestamp: new Date().toLocaleString("ar-EG", { hour12: true }),
      type: activity.type,
      title: activity.title,
      note: activity.note,
      outcome: activity.outcome,
    };

    lead.activities = lead.activities || [];
    lead.activities.unshift(newAct);
    lead.lastContactedAt = new Date().toISOString();
    lead.updatedAt = new Date().toISOString();

    this.saveLeads();
    return newAct;
  }

  public addActivityByPhone(
    phone: string,
    activity: { type: FollowUpActivity["type"]; title: string; note: string; outcome?: string }
  ): FollowUpActivity | null {
    const normPhone = normalizePhoneNumber(phone);
    let lead = this.leads.find((l) => isSamePhoneNumber(l.phone, normPhone));
    if (!lead) {
      lead = this.createLead({
        phone: normPhone,
        source: "whatsapp_extracted",
        stage: "new",
        priority: "medium",
      });
    }
    return this.addActivity(lead.id, activity);
  }

  // --- Extracted WhatsApp Chats & Messages Hub ---
  public getExtractedChats(filterAccountId?: string): ExtractedChatSummary[] {
    // Auto sync from session files if more than 8 seconds have passed
    if (Date.now() - this.lastSyncTime > 8000) {
      try {
        this.syncChatsFromSession(filterAccountId);
      } catch {}
    }

    const summaries: ExtractedChatSummary[] = [];
    const leadMap = new Map(this.leads.map((l) => [l.phone, l]));

    // All known phones with messages, chat summaries, contact names, or CRM leads
    const phones = new Set<string>();
    this.messagesByPhone.forEach((_, p) => phones.add(p));
    this.chatSummaries.forEach((_, p) => phones.add(p));
    this.contactNames.forEach((_, p) => phones.add(p));
    this.leads.forEach((l) => {
      if (l.phone) phones.add(l.phone);
    });

    phones.forEach((phone) => {
      if (!phone || phone.length < 7) return;
      const msgs = this.messagesByPhone.get(phone) || [];
      const chatInfo = this.chatSummaries.get(phone);
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

      const chatAccountId = chatInfo?.accountId || lastMsg?.accountId || "default";
      if (filterAccountId && filterAccountId !== "all") {
        const matchesAccount =
          chatAccountId === filterAccountId ||
          msgs.some((m) => m.accountId === filterAccountId);
        if (!matchesAccount) {
          return;
        }
      }

      const lead = leadMap.get(phone);
      const knownContactName = this.contactNames.get(phone);

      // Determine best display name
      let displayName = "";
      if (lead?.name && !lead.name.startsWith("+")) {
        displayName = lead.name;
      } else if (chatInfo?.name && !chatInfo.name.startsWith("+")) {
        displayName = chatInfo.name;
      } else if (knownContactName && !knownContactName.startsWith("+")) {
        displayName = knownContactName;
      } else if (lastMsg?.senderName && !lastMsg.fromMe && !lastMsg.senderName.startsWith("+")) {
        displayName = lastMsg.senderName;
      } else {
        // Format Egyptian / International phone cleanly
        displayName = `+${phone}`;
      }

      const lastTimestamp = lastMsg?.timestamp || chatInfo?.lastActive || "";
      const lastText = lastMsg
        ? lastMsg.fromMe
          ? `أنت: ${lastMsg.text}`
          : lastMsg.text
        : chatInfo?.lastMessage || (msgs.length ? "[مرفق]" : (lead ? "عميل مسجل في الـ CRM" : "جهة اتصال مسجلة"));

      summaries.push({
        phone,
        name: displayName,
        lastMessage: lastText,
        lastMessageTimestamp: lastTimestamp,
        unreadCount: chatInfo?.unreadCount || 0,
        messageCount: msgs.length,
        isAlreadyLead: Boolean(lead),
        leadId: lead?.id,
        accountId: chatAccountId,
        accountName: chatInfo?.accountName,
      });
    });

    // Sort: unread first, then latest active timestamp, then message count
    return summaries.sort((a, b) => {
      if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
        return (b.unreadCount || 0) - (a.unreadCount || 0);
      }
      const timeA = new Date(a.lastMessageTimestamp || 0).getTime() || 0;
      const timeB = new Date(b.lastMessageTimestamp || 0).getTime() || 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (b.messageCount || 0) - (a.messageCount || 0);
    });
  }

  public restoreBackupLeads(backupLeads: CRMLead[]): { restoredCount: number; total: number } {
    if (!Array.isArray(backupLeads)) return { restoredCount: 0, total: this.leads.length };
    let restoredCount = 0;
    for (const item of backupLeads) {
      if (!item || !item.phone) continue;
      const normPhone = normalizePhoneNumber(item.phone);
      if (!normPhone || normPhone.length < 7) continue;

      const idx = this.leads.findIndex((l) => isSamePhoneNumber(l.phone, normPhone) || l.id === item.id);
      if (idx >= 0) {
        // Update
        this.leads[idx] = { ...this.leads[idx], ...item, phone: normPhone };
      } else {
        // Add
        this.leads.push({ ...item, phone: normPhone });
        restoredCount++;
      }
    }
    this.saveLeads();
    return { restoredCount, total: this.leads.length };
  }

  public convertChatToLead(phone: string, name?: string, notes?: string): CRMLead {
    const normPhone = normalizePhoneNumber(phone);
    if (!normPhone) {
      throw new Error("رقم الهاتف غير صالح");
    }

    const existing = this.leads.find((l) => isSamePhoneNumber(l.phone, normPhone));
    if (existing) {
      return existing;
    }

    const msgs = this.messagesByPhone.get(normPhone) || [];
    const chatInfo = this.chatSummaries.get(normPhone);
    const inferredName = name || chatInfo?.name || (msgs.find((m) => !m.fromMe)?.senderName) || `عميل (${normPhone.slice(-4)})`;

    return this.createLead({
      phone: normPhone,
      name: inferredName,
      source: "whatsapp_extracted",
      stage: "new",
      priority: "medium",
      tags: ["مسحوب من واتساب", "وارد حديثاً"],
      notes: notes || (msgs.length > 0 ? `آخر رسالة واردة: "${msgs[msgs.length - 1].text}"` : "تم سحب الرقم من محادثات واتساب."),
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour12: true }),
          type: "whatsapp",
          title: "سحب المحادثة وتحويلها إلى Lead",
          note: `تم سحب سجل المحادثة (${msgs.length} رسالة) وتحويل الرقم إلى عميل مستهدف في الـ CRM.`,
        },
      ],
    });
  }

  public async analyzeLeadWithAI(leadId: string) {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("العميل غير موجود");

    const messages = this.messagesByPhone.get(lead.phone) || [];

    const result = await analyzeLeadWithGemini({
      name: lead.name,
      phone: lead.phone,
      company: lead.company,
      stage: lead.stage,
      notes: lead.notes,
      messages,
      activities: lead.activities,
    });

    lead.aiAnalysis = {
      ...result,
      analyzedAt: new Date().toISOString(),
    };

    // If sentiment is positive and priority is low, suggest raising
    if (result.sentiment === "positive" && lead.priority === "low") {
      lead.priority = "high";
    }

    lead.updatedAt = new Date().toISOString();
    this.saveLeads();
    return lead.aiAnalysis;
  }

  public deduplicateLeads(): { removedCount: number; remainingCount: number } {
    const initialCount = this.leads.length;
    const map = new Map<string, CRMLead>();

    for (const lead of this.leads) {
      const norm = normalizePhoneNumber(lead.phone);
      if (!norm || norm.length < 7) continue;

      if (!map.has(norm)) {
        map.set(norm, { ...lead, phone: norm });
      } else {
        const existing = map.get(norm)!;
        // Merge activities
        if (lead.activities && lead.activities.length > 0) {
          const existingActIds = new Set((existing.activities || []).map((a) => a.id));
          const newActs = lead.activities.filter((a) => !existingActIds.has(a.id));
          existing.activities = [...(existing.activities || []), ...newActs];
        }
        // Merge tags
        if (lead.tags && lead.tags.length > 0) {
          existing.tags = Array.from(new Set([...(existing.tags || []), ...lead.tags]));
        }
        if (!existing.company && lead.company) existing.company = lead.company;
        if (!existing.notes && lead.notes) existing.notes = lead.notes;
        if ((!existing.name || existing.name.startsWith("+") || existing.name.includes("عميل")) && lead.name && !lead.name.startsWith("+")) {
          existing.name = lead.name;
        }
      }
    }

    this.leads = Array.from(map.values());
    this.saveLeads();
    const removedCount = initialCount - this.leads.length;
    return { removedCount, remainingCount: this.leads.length };
  }

  public pushLeadsToCampaign(leadIds: string[]): { addedCount: number; duplicateCount: number } {
    const selected = this.leads.filter((l) => leadIds.includes(l.id));
    if (selected.length === 0) return { addedCount: 0, duplicateCount: 0 };

    const contactsToAdd: Contact[] = selected.map((l) => {
      const norm = normalizePhoneNumber(l.phone);
      return {
        id: `c-crm-${l.id}-${Date.now().toString(36)}`,
        phone: norm,
        rawPhone: l.rawPhone || l.phone,
        name: l.name,
        company: l.company || "",
        notes: l.notes || "",
        status: "pending",
        groupName: "عملاء الـ CRM",
        customFields: {
          crmStage: l.stage,
          priority: l.priority,
          dealValue: l.dealValue ? String(l.dealValue) : "",
        },
      };
    });

    const result = campaignQueue.addContacts(contactsToAdd, "عملاء الـ CRM");
    return { addedCount: result.addedCount, duplicateCount: result.duplicateCount };
  }

  public reloadAll() {
    this.precomputeLidMappings();
    this.loadData();
    this.syncChatsFromSession();
  }
}

export const crmService = new CRMService();
