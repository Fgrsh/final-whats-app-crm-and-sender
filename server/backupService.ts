import fs from "fs";
import path from "path";
import { aiSalesAgentService } from "./aiSalesAgentService.ts";
import { campaignQueue } from "./campaignQueue.ts";
import { crmService } from "./crmService.ts";
import { templateService } from "./templateService.ts";

export interface SystemBackupData {
  version: string;
  exportDate: string;
  app: string;
  metadata?: {
    productsCount: number;
    faqsCount: number;
    campaignsCount: number;
    leadsCount: number;
    ordersCount: number;
    templatesCount: number;
    chatsCount: number;
  };
  data: {
    ai_agent_knowledge?: any;
    ai_agent_settings?: any;
    ai_agent_sessions?: any;
    ai_agent_orders?: any;
    ai_agent_logs?: any;
    campaigns?: any;
    campaign_config?: any;
    campaign_contacts?: any;
    crm_leads?: any;
    crm_messages?: any;
    crm_chats?: any;
    crm_contacts?: any;
    templates?: any;
    whatsapp_accounts?: any;
  };
}

class BackupService {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private readJsonSafe(filename: string): any {
    const filePath = path.join(this.dataDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(content);
      } catch (e) {
        console.error(`Error reading ${filename} for backup:`, e);
      }
    }
    return null;
  }

  private writeJsonSafe(filename: string, content: any): boolean {
    const filePath = path.join(this.dataDir, filename);
    try {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");
      return true;
    } catch (e) {
      console.error(`Error writing ${filename} from restore:`, e);
      return false;
    }
  }

  public exportFullBackup(): SystemBackupData {
    const knowledge = this.readJsonSafe("ai_agent_knowledge.json") || aiSalesAgentService.getKnowledge();
    const settings = this.readJsonSafe("ai_agent_settings.json") || aiSalesAgentService.getSettings();
    const sessions = this.readJsonSafe("ai_agent_sessions.json") || [];
    const rawOrders = this.readJsonSafe("ai_agent_orders.json") || aiSalesAgentService.getOrders();
    const orders = Array.isArray(rawOrders)
      ? rawOrders.filter((o: any) => o && o.status !== "cancelled")
      : [];
    const logs = this.readJsonSafe("ai_agent_logs.json") || aiSalesAgentService.getLogs(500);
    const campaigns = this.readJsonSafe("campaigns.json") || campaignQueue.getCampaigns();
    const campaignConfig = this.readJsonSafe("campaign_config.json");
    const campaignContacts = this.readJsonSafe("campaign_contacts.json");
    const crmLeads = this.readJsonSafe("crm_leads.json") || [];
    const crmMessages = this.readJsonSafe("crm_messages.json") || [];
    const crmChats = this.readJsonSafe("crm_chats.json") || [];
    const crmContacts = this.readJsonSafe("crm_contacts.json") || {};
    const templates = this.readJsonSafe("templates.json") || templateService.getTemplates();
    const whatsappAccounts = this.readJsonSafe("whatsapp_accounts.json") || [];

    const productsCount = Array.isArray(knowledge?.catalog) ? knowledge.catalog.length : 0;
    const faqsCount = Array.isArray(knowledge?.faqs) ? knowledge.faqs.length : 0;
    const campaignsCount = Array.isArray(campaigns) ? campaigns.length : 0;
    const leadsCount = Array.isArray(crmLeads) ? crmLeads.length : 0;
    const ordersCount = Array.isArray(orders) ? orders.length : 0;
    const templatesCount = Array.isArray(templates) ? templates.length : 0;
    const chatsCount = Array.isArray(crmChats) ? crmChats.length : 0;

    return {
      version: "2.0.0",
      exportDate: new Date().toISOString(),
      app: "WhatsApp AI Marketer & Sales Agent - Solo Italiano",
      metadata: {
        productsCount,
        faqsCount,
        campaignsCount,
        leadsCount,
        ordersCount,
        templatesCount,
        chatsCount,
      },
      data: {
        ai_agent_knowledge: knowledge,
        ai_agent_settings: settings,
        ai_agent_sessions: sessions,
        ai_agent_orders: orders,
        ai_agent_logs: logs,
        campaigns: campaigns,
        campaign_config: campaignConfig,
        campaign_contacts: campaignContacts,
        crm_leads: crmLeads,
        crm_messages: crmMessages,
        crm_chats: crmChats,
        crm_contacts: crmContacts,
        templates: templates,
        whatsapp_accounts: whatsappAccounts,
      },
    };
  }

  public importFullBackup(payload: any): {
    success: boolean;
    restoredFiles: string[];
    summary: {
      productsRestored: number;
      faqsRestored: number;
      ordersRestored: number;
      campaignsRestored: number;
      leadsRestored: number;
      templatesRestored: number;
    };
    error?: string;
  } {
    if (!payload || typeof payload !== "object") {
      throw new Error("ملف النسخة الاحتياطية غير صالح أو فارغ");
    }

    // Support both wrapped format { version, data: { ... } } and direct format { ai_agent_knowledge, ... }
    const sourceData = payload.data && typeof payload.data === "object" ? payload.data : payload;

    const restoredFiles: string[] = [];
    const summary = {
      productsRestored: 0,
      faqsRestored: 0,
      ordersRestored: 0,
      campaignsRestored: 0,
      leadsRestored: 0,
      templatesRestored: 0,
    };

    if (sourceData.ai_agent_knowledge) {
      this.writeJsonSafe("ai_agent_knowledge.json", sourceData.ai_agent_knowledge);
      restoredFiles.push("ai_agent_knowledge.json");
      if (Array.isArray(sourceData.ai_agent_knowledge.catalog)) {
        summary.productsRestored = sourceData.ai_agent_knowledge.catalog.length;
      }
      if (Array.isArray(sourceData.ai_agent_knowledge.faqs)) {
        summary.faqsRestored = sourceData.ai_agent_knowledge.faqs.length;
      }
    }

    if (sourceData.ai_agent_settings) {
      this.writeJsonSafe("ai_agent_settings.json", sourceData.ai_agent_settings);
      restoredFiles.push("ai_agent_settings.json");
    }

    if (sourceData.ai_agent_sessions) {
      this.writeJsonSafe("ai_agent_sessions.json", sourceData.ai_agent_sessions);
      restoredFiles.push("ai_agent_sessions.json");
    }

    if (sourceData.ai_agent_orders) {
      const cleanOrders = Array.isArray(sourceData.ai_agent_orders)
        ? sourceData.ai_agent_orders.filter((o: any) => o && o.status !== "cancelled")
        : [];
      this.writeJsonSafe("ai_agent_orders.json", cleanOrders);
      restoredFiles.push("ai_agent_orders.json");
      summary.ordersRestored = cleanOrders.length;
    }

    if (sourceData.ai_agent_logs) {
      this.writeJsonSafe("ai_agent_logs.json", sourceData.ai_agent_logs);
      restoredFiles.push("ai_agent_logs.json");
    }

    if (sourceData.campaigns) {
      this.writeJsonSafe("campaigns.json", sourceData.campaigns);
      restoredFiles.push("campaigns.json");
      if (Array.isArray(sourceData.campaigns)) {
        summary.campaignsRestored = sourceData.campaigns.length;
      }
    }

    if (sourceData.campaign_config) {
      this.writeJsonSafe("campaign_config.json", sourceData.campaign_config);
      restoredFiles.push("campaign_config.json");
    }

    if (sourceData.campaign_contacts) {
      this.writeJsonSafe("campaign_contacts.json", sourceData.campaign_contacts);
      restoredFiles.push("campaign_contacts.json");
    }

    if (sourceData.crm_leads) {
      this.writeJsonSafe("crm_leads.json", sourceData.crm_leads);
      restoredFiles.push("crm_leads.json");
      if (Array.isArray(sourceData.crm_leads)) {
        summary.leadsRestored = sourceData.crm_leads.length;
      }
    }

    if (sourceData.crm_messages) {
      this.writeJsonSafe("crm_messages.json", sourceData.crm_messages);
      restoredFiles.push("crm_messages.json");
    }

    if (sourceData.crm_chats) {
      this.writeJsonSafe("crm_chats.json", sourceData.crm_chats);
      restoredFiles.push("crm_chats.json");
    }

    if (sourceData.crm_contacts) {
      this.writeJsonSafe("crm_contacts.json", sourceData.crm_contacts);
      restoredFiles.push("crm_contacts.json");
    }

    if (sourceData.templates) {
      this.writeJsonSafe("templates.json", sourceData.templates);
      restoredFiles.push("templates.json");
      if (Array.isArray(sourceData.templates)) {
        summary.templatesRestored = sourceData.templates.length;
      }
    }

    if (sourceData.whatsapp_accounts) {
      this.writeJsonSafe("whatsapp_accounts.json", sourceData.whatsapp_accounts);
      restoredFiles.push("whatsapp_accounts.json");
    }

    // Reload in-memory cache of all services
    try {
      aiSalesAgentService.reloadAll();
      campaignQueue.reloadAll();
      crmService.reloadAll();
      templateService.reloadAll();
    } catch (reloadErr) {
      console.error("Error reloading services after restore:", reloadErr);
    }

    return {
      success: true,
      restoredFiles,
      summary,
    };
  }
}

export const backupService = new BackupService();
