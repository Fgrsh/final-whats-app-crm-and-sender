import express from "express";
import path from "path";
import dotenv from "dotenv";
import { whatsappManager } from "./server/whatsappManager.ts";
import { campaignQueue } from "./server/campaignQueue.ts";
import { generateTemplatePrompt, personalizeMessage } from "./server/geminiService.ts";
import { crmService } from "./server/crmService.ts";
import { templateService } from "./server/templateService.ts";
import { aiSalesAgentService } from "./server/aiSalesAgentService.ts";
import { backupService } from "./server/backupService.ts";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Determine production vs development:
  // Running the compiled bundle (dist/server.cjs) or explicitly NODE_ENV=production means production
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof __filename !== "undefined" && (__filename.endsWith(".cjs") || __filename.includes("dist")));

  if (isProduction) {
    process.env.NODE_ENV = "production";
  }

  // Enable CORS for all incoming requests (crucial for iframe preview and cross-origin modules)
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // WhatsApp connection endpoints
  app.get("/api/whatsapp/status", (req, res) => {
    const state = whatsappManager.getState();
    res.json({
      ...state,
      qrCode: state.qrCodeDataUrl,
    });
  });

  app.post("/api/whatsapp/connect", async (req, res) => {
    try {
      const { phoneNumber } = req.body || {};
      const state = await whatsappManager.connect(phoneNumber);
      res.json({
        success: true,
        state: {
          ...state,
          qrCode: state.qrCodeDataUrl,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Failed to initiate connection" });
    }
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    try {
      await whatsappManager.disconnect();
      res.json({ success: true, message: "Disconnected successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // --- Multi-Account WhatsApp Endpoints ---
  app.get("/api/whatsapp/accounts", (req, res) => {
    try {
      res.json({ success: true, accounts: whatsappManager.getAccounts() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post(["/api/whatsapp/accounts", "/api/whatsapp/accounts/create"], async (req, res) => {
    try {
      const { name, phoneNumber, autoConnect } = req.body || {};
      const newAcc = whatsappManager.createAccount(name);
      let state = newAcc;
      if (phoneNumber || autoConnect) {
        try {
          const connState = await whatsappManager.connect(newAcc.id, phoneNumber);
          state = { ...newAcc, ...connState };
        } catch (e: any) {
          console.error("Auto connect new account error:", e?.message);
        }
      }
      res.json({
        success: true,
        account: newAcc,
        state: { ...state, qrCode: (state as any).qrCodeDataUrl },
        accounts: whatsappManager.getAccounts(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.delete("/api/whatsapp/accounts/:id", async (req, res) => {
    try {
      const success = await whatsappManager.deleteAccount(req.params.id);
      res.json({ success, accounts: whatsappManager.getAccounts() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/whatsapp/accounts/:id/status", (req, res) => {
    try {
      const acc = whatsappManager.getAccount(req.params.id);
      if (!acc) return res.status(404).json({ success: false, error: "Account not found" });
      res.json({
        success: true,
        account: acc.getInfo(),
        state: { ...acc.state, qrCode: acc.state.qrCodeDataUrl },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/whatsapp/accounts/:id/connect", async (req, res) => {
    try {
      const { phoneNumber } = req.body || {};
      const state = await whatsappManager.connect(req.params.id, phoneNumber);
      res.json({
        success: true,
        state: { ...state, qrCode: state.qrCodeDataUrl },
        accounts: whatsappManager.getAccounts(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/whatsapp/accounts/:id/disconnect", async (req, res) => {
    try {
      await whatsappManager.disconnect(req.params.id);
      res.json({ success: true, accounts: whatsappManager.getAccounts() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // --- Multi-Campaign Endpoints ---
  app.get("/api/campaigns", (req, res) => {
    try {
      const campaigns = campaignQueue.getCampaigns();
      res.json({ success: true, campaigns, activeCampaignId: campaignQueue.activeCampaignId });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post(["/api/campaigns", "/api/campaigns/create"], (req, res) => {
    try {
      const { name, whatsappAccountId, contacts, config } = req.body || {};
      const newCamp = campaignQueue.createCampaign(name, whatsappAccountId, contacts, config);
      res.json({ success: true, campaign: newCamp, campaigns: campaignQueue.getCampaigns() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post(["/api/campaigns/select", "/api/campaigns/:id/select"], (req, res) => {
    try {
      const campaignId = req.params.id || req.body?.campaignId;
      if (campaignId) campaignQueue.setActiveCampaign(campaignId);
      res.json({ success: true, activeCampaignId: campaignQueue.activeCampaignId });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.delete("/api/campaigns/:id", (req, res) => {
    try {
      const success = campaignQueue.deleteCampaign(req.params.id);
      res.json({ success, campaigns: campaignQueue.getCampaigns() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/:id/start", async (req, res) => {
    try {
      const camp = campaignQueue.getCampaign(req.params.id);
      if (!camp) return res.status(404).json({ success: false, error: "Campaign not found" });
      await camp.start();
      res.json({ success: true, message: "Campaign started", campaign: camp.getItem() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/:id/pause", (req, res) => {
    try {
      const camp = campaignQueue.getCampaign(req.params.id);
      if (!camp) return res.status(404).json({ success: false, error: "Campaign not found" });
      camp.pause();
      res.json({ success: true, message: "Campaign paused", campaign: camp.getItem() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/:id/resume", (req, res) => {
    try {
      const camp = campaignQueue.getCampaign(req.params.id);
      if (!camp) return res.status(404).json({ success: false, error: "Campaign not found" });
      camp.resume();
      res.json({ success: true, message: "Campaign resumed", campaign: camp.getItem() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/:id/stop", (req, res) => {
    try {
      const camp = campaignQueue.getCampaign(req.params.id);
      if (!camp) return res.status(404).json({ success: false, error: "Campaign not found" });
      camp.stop();
      res.json({ success: true, message: "Campaign stopped", campaign: camp.getItem() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/:id/reset", (req, res) => {
    try {
      const camp = campaignQueue.getCampaign(req.params.id);
      if (!camp) return res.status(404).json({ success: false, error: "Campaign not found" });
      camp.reset();
      res.json({ success: true, message: "Campaign reset", campaign: camp.getItem() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/:id/contacts", (req, res) => {
    try {
      const camp = campaignQueue.getCampaign(req.params.id);
      if (!camp) return res.status(404).json({ success: false, error: "Campaign not found" });
      const { contacts } = req.body;
      if (Array.isArray(contacts)) {
        camp.setContacts(contacts);
      }
      res.json({ success: true, campaign: camp.getItem() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/:id/config", (req, res) => {
    try {
      const camp = campaignQueue.getCampaign(req.params.id);
      if (!camp) return res.status(404).json({ success: false, error: "Campaign not found" });
      const { config, name, whatsappAccountId } = req.body;
      if (config) camp.updateConfig(config);
      if (name) camp.name = name;
      if (whatsappAccountId) camp.whatsappAccountId = whatsappAccountId;
      camp.notifyChange();
      res.json({ success: true, campaign: camp.getItem() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaigns/restore-backup", (req, res) => {
    try {
      const { campaigns } = req.body;
      const result = campaignQueue.restoreBackupCampaigns(campaigns);
      res.json({ success: true, ...result, campaigns: campaignQueue.getCampaigns() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  // --- Saved Message & Attachment Templates Endpoints ---
  app.get("/api/templates", (req, res) => {
    try {
      res.json({ success: true, templates: templateService.getTemplates() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/templates/:id", (req, res) => {
    try {
      const tpl = templateService.getTemplate(req.params.id);
      if (!tpl) return res.status(404).json({ success: false, error: "Template not found" });
      res.json({ success: true, template: tpl });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post(["/api/templates", "/api/templates/save"], (req, res) => {
    try {
      const template = templateService.createOrUpdateTemplate(req.body);
      res.json({ success: true, template, templates: templateService.getTemplates() });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.delete("/api/templates/:id", (req, res) => {
    try {
      const success = templateService.deleteTemplate(req.params.id);
      res.json({ success, templates: templateService.getTemplates() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Campaign Queue endpoints
  app.get("/api/campaign/status", (req, res) => {
    const data = campaignQueue.getStatus();
    res.json(data);
  });

  app.post("/api/campaign/contacts", (req, res) => {
    try {
      const { contacts } = req.body;
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ success: false, error: "Contacts must be an array" });
      }
      campaignQueue.setContacts(contacts);
      res.json({ success: true, count: contacts.length });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/config", (req, res) => {
    try {
      const config = req.body;
      campaignQueue.updateConfig(config);
      res.json({ success: true, config: campaignQueue.getStatus().config });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/start", async (req, res) => {
    try {
      await campaignQueue.start();
      res.json({ success: true, message: "Campaign started" });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/pause", (req, res) => {
    campaignQueue.pause();
    res.json({ success: true, message: "Campaign paused" });
  });

  app.post("/api/campaign/resume", (req, res) => {
    campaignQueue.resume();
    res.json({ success: true, message: "Campaign resumed" });
  });

  app.post("/api/campaign/stop", (req, res) => {
    campaignQueue.stop();
    res.json({ success: true, message: "Campaign stopped" });
  });

  app.post("/api/campaign/clear", (req, res) => {
    campaignQueue.clear();
    res.json({ success: true, message: "Campaign cleared" });
  });

  app.post("/api/campaign/reset", (req, res) => {
    campaignQueue.reset();
    res.json({ success: true, message: "Campaign reset" });
  });

  // Export Campaign History (contacts, logs, config) as JSON backup
  app.get("/api/campaign/backup/export", (req, res) => {
    try {
      const backup = campaignQueue.exportBackup();
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename="campaign-backup-${dateStr}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json(backup);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Failed to export campaign backup" });
    }
  });

  // Import Campaign History (contacts, logs, config) from JSON backup
  app.post("/api/campaign/backup/import", (req, res) => {
    try {
      const { backupData, mode } = req.body;
      if (!backupData) {
        return res.status(400).json({ success: false, error: "بيانات النسخة الاحتياطية مطلوبة (backupData is required)" });
      }
      const result = campaignQueue.importBackup(backupData, mode || "overwrite");
      const currentStatus = campaignQueue.getStatus();
      res.json({
        success: true,
        ...result,
        status: currentStatus,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || "Failed to import campaign backup" });
    }
  });

  app.post("/api/campaign/override-daily-limit", (req, res) => {
    campaignQueue.overrideDailyLimit();
    res.json({ success: true, message: "Daily limit overridden" });
  });

  app.post("/api/campaign/contact/add", (req, res) => {
    try {
      const { contact } = req.body;
      if (!contact || !contact.phone) {
        return res.status(400).json({ success: false, error: "Contact and phone are required" });
      }
      campaignQueue.addContact(contact);
      res.json({ success: true, message: "Contact added" });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/contact/update", (req, res) => {
    try {
      const { id, updated } = req.body;
      if (!id || !updated) {
        return res.status(400).json({ success: false, error: "ID and updated fields required" });
      }
      campaignQueue.updateContact(id, updated);
      res.json({ success: true, message: "Contact updated" });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/contact/delete", (req, res) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, error: "Contact ID required" });
      }
      campaignQueue.deleteContact(id);
      res.json({ success: true, message: "Contact deleted" });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  // Contact Groups Management Endpoints
  app.post("/api/campaign/contacts/group/delete", (req, res) => {
    try {
      const { groupName } = req.body;
      if (!groupName) {
        return res.status(400).json({ success: false, error: "اسم المجموعة مطلوب" });
      }
      const removed = campaignQueue.deleteGroup(groupName);
      res.json({ success: true, removedCount: removed });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/contacts/group/reset", (req, res) => {
    try {
      const { groupName } = req.body;
      if (!groupName) {
        return res.status(400).json({ success: false, error: "اسم المجموعة مطلوب" });
      }
      const resetCount = campaignQueue.resetGroup(groupName);
      res.json({ success: true, resetCount });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/contacts/group/rename", (req, res) => {
    try {
      const { oldName, newName } = req.body;
      if (!oldName || !newName) {
        return res.status(400).json({ success: false, error: "الاسم القديم والجديد مطلوبان" });
      }
      const updatedCount = campaignQueue.renameGroup(oldName, newName);
      res.json({ success: true, updatedCount });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  // Diagnostic: Verify Message Delivery directly from Baileys Provider
  app.post(["/api/campaign/verify-delivery", "/api/campaigns/:id/verify-delivery"], async (req, res) => {
    try {
      const campaignId = req.params?.id || req.body?.campaignId;
      const accountId = req.body?.accountId;
      const targetCamp = campaignId ? campaignQueue.getCampaign(campaignId) : campaignQueue.getActiveCampaign();
      const contacts = req.body?.contacts || targetCamp?.contacts || [];
      const targetAccountId = accountId || targetCamp?.whatsappAccountId || "default";

      const result = await whatsappManager.verifyDelivery({
        accountId: targetAccountId,
        campaignId: targetCamp?.id,
        campaignName: targetCamp?.name,
        contacts,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Error in verify-delivery endpoint:", err);
      res.status(500).json({ success: false, error: err?.message || "Failed to verify message delivery" });
    }
  });

  app.get(["/api/campaign/verify-delivery", "/api/campaigns/:id/verify-delivery"], async (req, res) => {
    try {
      const campaignId = (req.params?.id as string) || (req.query?.campaignId as string);
      const accountId = req.query?.accountId as string;
      const targetCamp = campaignId ? campaignQueue.getCampaign(campaignId) : campaignQueue.getActiveCampaign();
      const contacts = targetCamp?.contacts || [];
      const targetAccountId = accountId || targetCamp?.whatsappAccountId || "default";

      const result = await whatsappManager.verifyDelivery({
        accountId: targetAccountId,
        campaignId: targetCamp?.id,
        campaignName: targetCamp?.name,
        contacts,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Error in verify-delivery endpoint:", err);
      res.status(500).json({ success: false, error: err?.message || "Failed to verify message delivery" });
    }
  });

  app.post(["/api/campaign/contacts/add-batch", "/api/campaign/contacts/group/add-batch"], (req, res) => {
    try {
      const { contacts, groupName } = req.body;
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ success: false, error: "Contacts must be an array" });
      }
      const result = campaignQueue.addContacts(contacts, groupName);
      res.json({
        success: true,
        count: contacts.length,
        addedCount: result.addedCount,
        duplicateCount: result.duplicateCount,
        contacts: campaignQueue.getStatus().contacts,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/contacts/deduplicate", (req, res) => {
    try {
      const result = campaignQueue.deduplicateContacts();
      res.json({
        success: true,
        ...result,
        contacts: campaignQueue.getStatus().contacts,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // AI Helpers
  app.post("/api/campaign/preview-ai", async (req, res) => {
    try {
      const { sampleContact } = req.body || {};
      const output = await campaignQueue.previewAIMessage(sampleContact);
      res.json({ success: true, preview: output });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/ai/generate-template", async (req, res) => {
    try {
      const { purpose, tone, language, industry } = req.body;
      const template = await generateTemplatePrompt({
        purpose: purpose || "عرض خاص للعملاء",
        tone: tone || "friendly",
        language: language || "ar",
        industry: industry || "retail",
      });
      res.json({ success: true, template });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/campaign/send-single", async (req, res) => {
    try {
      const { phone, message, attachment, accountId } = req.body;
      if (!phone || (!message && !attachment)) {
        return res.status(400).json({ success: false, error: "Phone and message or attachment are required" });
      }
      const result = accountId
        ? await whatsappManager.sendMessage(accountId, phone, message || "", attachment)
        : await whatsappManager.sendMessage(phone, message || "", attachment);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // --- CRM & Leads API Routes ---
  app.get("/api/crm/leads", (req, res) => {
    try {
      const { stage, priority, search, followUpDue } = req.query;
      const leads = crmService.getLeads({
        stage: stage as string,
        priority: priority as string,
        search: search as string,
        followUpDue: followUpDue === "true",
      });
      res.json({ success: true, leads });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/crm/leads/:id", (req, res) => {
    try {
      const lead = crmService.getLeadById(req.params.id);
      if (!lead) {
        return res.status(404).json({ success: false, error: "Lead not found" });
      }
      res.json({ success: true, lead });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/leads", (req, res) => {
    try {
      const lead = crmService.createLead(req.body);
      res.json({ success: true, lead });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.put("/api/crm/leads/:id", (req, res) => {
    try {
      const lead = crmService.updateLead(req.params.id, req.body);
      res.json({ success: true, lead });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.delete("/api/crm/leads/:id", (req, res) => {
    try {
      const deleted = crmService.deleteLead(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/leads/:id/activities", (req, res) => {
    try {
      const { type, title, note, outcome } = req.body;
      if (!title || !type) {
        return res.status(400).json({ success: false, error: "Title and type are required" });
      }
      const activity = crmService.addActivity(req.params.id, { type, title, note: note || "", outcome });
      res.json({ success: true, activity });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/leads/:id/ai-analyze", async (req, res) => {
    try {
      const analysis = await crmService.analyzeLeadWithAI(req.params.id);
      res.json({ success: true, analysis });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/crm/extracted-chats", (req, res) => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const chats = crmService.getExtractedChats(accountId);
      res.json({ success: true, chats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.get("/api/crm/chats/:phone/messages", async (req, res) => {
    try {
      const phone = req.params.phone;
      const accountId = req.query.accountId as string | undefined;
      const targetAccId = accountId && accountId !== "all" ? accountId : undefined;
      const messages = crmService.getMessagesForPhone(phone, targetAccId);
      // If no messages stored yet and target account (or any active) is connected, trigger on-demand history sync from phone
      const targetAcc = targetAccId ? whatsappManager.getAccount(targetAccId) : undefined;
      const isConnected = targetAcc ? targetAcc.isConnected() : whatsappManager.isConnected();
      if (messages.length === 0 && isConnected) {
        whatsappManager.requestChatHistory(phone, 50, targetAccId).catch(() => {});
      }
      res.json({ success: true, messages });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/chats/:phone/sync-messages", async (req, res) => {
    try {
      const phone = req.params.phone;
      const accountId = (req.body?.accountId || req.query?.accountId) as string | undefined;
      const targetAccId = accountId && accountId !== "all" ? accountId : undefined;
      let requested = false;
      const targetAcc = targetAccId ? whatsappManager.getAccount(targetAccId) : undefined;
      const isConnected = targetAcc ? targetAcc.isConnected() : whatsappManager.isConnected();
      if (isConnected) {
        requested = await whatsappManager.requestChatHistory(phone, 100, targetAccId);
      }
      const messages = crmService.getMessagesForPhone(phone, targetAccId);
      res.json({ success: true, requested, messages });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/send-whatsapp", async (req, res) => {
    try {
      const { phone, message, accountId } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ success: false, error: "Phone and message are required" });
      }
      const targetAccId = accountId && accountId !== "all" ? accountId : undefined;
      const targetAcc = targetAccId ? whatsappManager.getAccount(targetAccId) : undefined;
      // Send through whatsappManager with specific account if chosen
      const sendResult = targetAccId
        ? await whatsappManager.sendMessage(targetAccId, phone, message)
        : await whatsappManager.sendMessage(phone, message);
      const accName = targetAcc?.name;
      // Record outgoing message in CRM store with accountId and accountName
      const recorded = crmService.recordOutgoingMessage(phone, message, targetAccId, accName);
      res.json({
        success: sendResult.success,
        messageId: sendResult.messageId,
        error: sendResult.error,
        recorded,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/leads/quick-send-whatsapp", async (req, res) => {
    try {
      const { phone, message, accountId } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ success: false, error: "Phone and message are required" });
      }
      const targetAccId = accountId && accountId !== "all" ? accountId : undefined;
      const targetAcc = targetAccId ? whatsappManager.getAccount(targetAccId) : undefined;
      const sendResult = targetAccId
        ? await whatsappManager.sendMessage(targetAccId, phone, message)
        : await whatsappManager.sendMessage(phone, message);
      const accName = targetAcc?.name;
      const recorded = crmService.recordOutgoingMessage(phone, message, targetAccId, accName);
      res.json({
        success: sendResult.success,
        messageId: sendResult.messageId,
        error: sendResult.error,
        recorded,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/extracted-chats/convert", (req, res) => {
    try {
      const { phone, name, notes } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, error: "Phone is required" });
      }
      const lead = crmService.convertChatToLead(phone, name, notes);
      res.json({ success: true, lead });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/push-to-campaign", (req, res) => {
    try {
      const { leadIds } = req.body;
      if (!leadIds || !Array.isArray(leadIds)) {
        return res.status(400).json({ success: false, error: "leadIds array is required" });
      }
      const result = crmService.pushLeadsToCampaign(leadIds);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/leads/restore-backup", (req, res) => {
    try {
      const { leads } = req.body;
      const result = crmService.restoreBackupLeads(leads);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/leads/deduplicate", (req, res) => {
    try {
      const result = crmService.deduplicateLeads();
      res.json({
        success: true,
        ...result,
        leads: crmService.getLeads(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post("/api/crm/sync-all", async (req, res) => {
    try {
      const accountId = (req.body?.accountId || req.query?.accountId) as string | undefined;
      const targetAccId = accountId && accountId !== "all" ? accountId : undefined;
      crmService.syncChatsFromSession(targetAccId);

      // If specific or all accounts are connected, trigger Baileys state sync
      let accountsToSync: string[] = [];
      if (targetAccId) {
        accountsToSync = [targetAccId];
      } else {
        accountsToSync = whatsappManager.getAccounts().map((a) => a.id);
      }

      for (const accId of accountsToSync) {
        const acc = whatsappManager.getAccount(accId);
        if (acc && acc.isConnected() && acc.sock) {
          try {
            if (typeof (acc.sock as any).resyncAppState === "function") {
              await (acc.sock as any).resyncAppState(["critical_unblock_low", "regular_low", "regular_high"]);
            }
          } catch (e) {}
        }
      }

      const chats = crmService.getExtractedChats(targetAccId);
      res.json({ success: true, count: chats.length, chats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // ==========================================
  // --- AI Sales Agent API Endpoints ---
  // ==========================================

  // Get AI Agent Dashboard Stats & Status
  app.get("/api/ai-agent/status", (req, res) => {
    try {
      const stats = aiSalesAgentService.getStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Reset Anti-Ban Safety Circuit Breaker
  app.post("/api/ai-agent/reset-circuit-breaker", (req, res) => {
    try {
      const success = aiSalesAgentService.resetCircuitBreaker();
      res.json({ success, stats: aiSalesAgentService.getStats() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Get AI Agent Settings
  app.get("/api/ai-agent/settings", (req, res) => {
    try {
      const settings = aiSalesAgentService.getSettings();
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Update AI Agent Settings
  app.post("/api/ai-agent/settings", (req, res) => {
    try {
      const updated = aiSalesAgentService.updateSettings(req.body);
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Get Knowledge Base & Catalog
  app.get("/api/ai-agent/knowledge", (req, res) => {
    try {
      const knowledge = aiSalesAgentService.getKnowledge();
      res.json({ success: true, knowledge });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Update Knowledge Base & Catalog
  app.post("/api/ai-agent/knowledge", (req, res) => {
    try {
      const updated = aiSalesAgentService.updateKnowledge(req.body);
      res.json({ success: true, knowledge: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Delete single product from Catalog
  app.delete("/api/ai-agent/knowledge/products/:id", (req, res) => {
    try {
      const updated = aiSalesAgentService.deleteProduct(req.params.id);
      res.json({ success: true, knowledge: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Clear all products from Catalog
  app.delete("/api/ai-agent/knowledge/products", (req, res) => {
    try {
      const updated = aiSalesAgentService.clearAllProducts();
      res.json({ success: true, knowledge: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Replace all products in Catalog with a new list
  app.post("/api/ai-agent/knowledge/products/replace", (req, res) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products)) {
        return res.status(400).json({ success: false, error: "products array is required" });
      }
      const updated = aiSalesAgentService.replaceProducts(products);
      res.json({ success: true, knowledge: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Reset Knowledge & Catalog to official Solo Italiano 2026 Price List
  app.post("/api/ai-agent/knowledge/reset-solo-italiano", (req, res) => {
    try {
      const updated = aiSalesAgentService.resetToSoloItalianoCatalog();
      res.json({ success: true, knowledge: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Get Customer Sessions & Memory
  app.get("/api/ai-agent/sessions", (req, res) => {
    try {
      const status = req.query.status as any;
      const search = req.query.search as string;
      const sessions = aiSalesAgentService.getSessions({ status, search });
      res.json({ success: true, count: sessions.length, sessions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Get Single Session Details & Message History
  app.get("/api/ai-agent/sessions/:phone", (req, res) => {
    try {
      const phone = req.params.phone;
      const session = aiSalesAgentService.getSession(phone);
      const messages = crmService.getMessagesForPhone(phone);
      res.json({ success: true, session, messages });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Human Takeover: Operator takes control of conversation (pauses AI)
  app.post("/api/ai-agent/sessions/:phone/takeover", (req, res) => {
    try {
      const phone = req.params.phone;
      const reason = req.body?.reason || "استلام يدوي من لوحة التحكم";
      const success = aiSalesAgentService.takeoverSession(phone, reason);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Resume AI: Re-enable automated sales replies for this phone
  app.post("/api/ai-agent/sessions/:phone/resume", (req, res) => {
    try {
      const phone = req.params.phone;
      const success = aiSalesAgentService.resumeSession(phone);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Manual Operator Reply: Send a message directly via WhatsApp from dashboard
  app.post("/api/ai-agent/sessions/:phone/manual-reply", async (req, res) => {
    try {
      const phone = req.params.phone;
      const { message, accountId } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: "نص الرسالة مطلوب" });
      }

      const sendRes = await whatsappManager.sendMessage(accountId || "default", phone, message.trim());
      if (sendRes.success) {
        crmService.recordOutgoingMessage(phone, message.trim(), accountId, "موظف المبيعات (يدوي)");
        aiSalesAgentService.addLog({
          phone,
          type: "manual_takeover",
          title: "رد يدوي من موظف المبيعات",
          details: `"${message.trim()}"`,
        });
      }

      res.json(sendRes);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Clear customer memory & preferences
  app.post("/api/ai-agent/sessions/:phone/clear-memory", (req, res) => {
    try {
      const phone = req.params.phone;
      const success = aiSalesAgentService.clearCustomerMemory(phone);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Get Collected Orders
  app.get("/api/ai-agent/orders", (req, res) => {
    try {
      const status = req.query.status as any;
      const search = req.query.search as string;
      const orders = aiSalesAgentService.getOrders({ status, search });
      res.json({ success: true, count: orders.length, orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Create or Update Order
  app.post("/api/ai-agent/orders", (req, res) => {
    try {
      const order = aiSalesAgentService.createOrUpdateOrder(req.body);
      res.json({ success: true, order });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Update Order Status
  app.post("/api/ai-agent/orders/:id/status", (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;
      const result = aiSalesAgentService.updateOrderStatus(id, status);
      if (!result.order) {
        return res.status(404).json({ success: false, error: "الطلب غير موجود" });
      }
      res.json({
        success: true,
        order: result.order,
        deleted: result.deleted,
        message: result.deleted ? "تم مسح الطلب الملغي نهائياً" : "تم تحديث حالة الطلب بنجاح",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Permanently Delete Single Order
  app.delete("/api/ai-agent/orders/:id", (req, res) => {
    try {
      const id = req.params.id;
      const deleted = aiSalesAgentService.deleteOrder(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "الطلب غير موجود" });
      }
      res.json({ success: true, message: "تم مسح وحذف الطلب نهائياً" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Permanently Clear All Cancelled Orders
  app.post("/api/ai-agent/orders/clear-cancelled", (req, res) => {
    try {
      const count = aiSalesAgentService.clearCancelledOrders();
      res.json({
        success: true,
        deletedCount: count,
        message: `تم مسح ${count} طلب ملغي نهائياً من النظام`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Get Activity Audit Logs
  app.get("/api/ai-agent/logs", (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const logs = aiSalesAgentService.getLogs(limit);
      res.json({ success: true, count: logs.length, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Simulator Test Endpoint (test AI response without sending to WhatsApp)
  const handleTestSimulator = async (req: express.Request, res: express.Response) => {
    try {
      const { phone, customerPhone, message } = req.body;
      const targetPhone = phone || customerPhone || "201000000000";
      if (!message) {
        return res.status(400).json({ success: false, error: "رسالة الاختبار مطلوبة" });
      }
      const testResult = await aiSalesAgentService.testSimulator(targetPhone, message);
      res.json(testResult);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  };

  app.post("/api/ai-agent/test-prompt", handleTestSimulator);
  app.post("/api/ai-agent/simulate", handleTestSimulator);
  app.post("/api/ai-agent/simulator", handleTestSimulator);
  app.post("/api/ai-agent/test", handleTestSimulator);

  // --- Full System Data Backup & Restore Endpoints ---

  // Export full system backup as JSON
  app.get(["/api/system/backup", "/api/system/export", "/api/system/export-backup"], (req, res) => {
    try {
      const backup = backupService.exportFullBackup();
      const filename = `solo_italiano_backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (req.query.download === "true" || req.path.includes("export")) {
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json(backup);
    } catch (err: any) {
      console.error("Error exporting system backup:", err);
      res.status(500).json({ success: false, error: err?.message || "فشل تصدير البيانات" });
    }
  });

  // Import / Restore full system backup
  app.post(["/api/system/restore", "/api/system/import", "/api/system/import-backup"], (req, res) => {
    try {
      const payload = req.body;
      if (!payload) {
        return res.status(400).json({ success: false, error: "بيانات النسخة الاحتياطية مفقودة" });
      }

      const result = backupService.importFullBackup(payload);
      res.json({
        success: true,
        message: "تم استيراد كافة بيانات النظام والمنتجات والأسئلة الشائعة بنجاح واستعادة حالة التطبيق بالكامل",
        ...result,
      });
    } catch (err: any) {
      console.error("Error restoring system backup:", err);
      res.status(500).json({ success: false, error: err?.message || "فشل استيراد النسخة الاحتياطية" });
    }
  });

  // Explicit 404 JSON response for any undefined /api/* route
  // (Prevents Vite SPA fallback from returning index.html as a 200 response to API calls)
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // --- Vite Middleware & Static Serving ---
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`WhatsApp AI Bulk Sender server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
});
