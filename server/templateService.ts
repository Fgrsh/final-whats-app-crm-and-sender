import fs from "fs";
import path from "path";
import type { MessageTemplate, CampaignAttachment } from "../src/types.ts";

class TemplateService {
  private dataDir: string;
  private templatesFile: string;
  private templates: MessageTemplate[] = [];

  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
    this.templatesFile = path.join(this.dataDir, "templates.json");

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.loadTemplates();
  }

  private loadTemplates() {
    try {
      if (fs.existsSync(this.templatesFile)) {
        const raw = fs.readFileSync(this.templatesFile, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.templates = list;
          return;
        }
      }
    } catch (e) {
      console.error("Error reading templates.json:", e);
    }

    // Default seeded templates if none exist
    this.templates = [
      {
        id: "tpl-welcome-offer",
        name: "عرض ترويجي ترحيبي مع بروشور",
        template: "أهلاً بك يا {name} في شركة {company}! 🎉\nيسعدنا تقديم خصم خاص لك بخصوص {notes}.\nاطلع على التفاصيل المرفقة ويسرنا تواصلك معنا مباشرة.",
        attachment: null,
        aiTone: "sales",
        aiInstruction: "أسلوب ترويجي جذاب مع إبراز الخصم والترحيب الشخصي",
        appendTimestampAndCode: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tpl-follow-up",
        name: "متابعة واستفسار رسمي",
        template: "مرحباً {name}، نأمل أن تكون بأفضل حال.\nبخصوص محادثتنا السابقة حول {notes}، هل تحتاج إلى أي استفسار أو مساعدة إضافية من فريق {company}؟",
        attachment: null,
        aiTone: "friendly",
        aiInstruction: "صياغة ودودة واحترافية تسأل عن اهتمام العميل وتفتح باب التواصل",
        appendTimestampAndCode: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "tpl-appointment-confirm",
        name: "تأكيد موعد أو طلب",
        template: "عزيزي {name}، تحية طيبة من {company}.\nنود تأكيد التفاصيل المتعلقة بـ: {notes}.\nفي حال رغبتك في تعديل أي بيانات يرجى إبلاغنا.",
        attachment: null,
        aiTone: "professional",
        aiInstruction: "صياغة رسمية ودقيقة لتأكيد المواعيد وتفاصيل الطلب",
        appendTimestampAndCode: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    this.saveTemplates();
  }

  private saveTemplates() {
    try {
      fs.writeFileSync(this.templatesFile, JSON.stringify(this.templates, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving templates.json:", e);
    }
  }

  public getTemplates(): MessageTemplate[] {
    return [...this.templates];
  }

  public getTemplate(id: string): MessageTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  public createOrUpdateTemplate(data: {
    id?: string;
    name: string;
    template: string;
    attachment?: CampaignAttachment | null;
    aiTone?: any;
    aiInstruction?: string;
    appendTimestampAndCode?: boolean;
  }): MessageTemplate {
    if (!data.name || !data.name.trim()) {
      throw new Error("اسم القالب مطلوب");
    }
    if (!data.template || !data.template.trim()) {
      throw new Error("نص القالب مطلوب");
    }

    const now = new Date().toISOString();
    const existingIndex = data.id ? this.templates.findIndex((t) => t.id === data.id) : -1;

    if (existingIndex >= 0) {
      this.templates[existingIndex] = {
        ...this.templates[existingIndex],
        name: data.name.trim(),
        template: data.template,
        attachment: data.attachment !== undefined ? data.attachment : this.templates[existingIndex].attachment,
        aiTone: data.aiTone || this.templates[existingIndex].aiTone,
        aiInstruction: data.aiInstruction !== undefined ? data.aiInstruction : this.templates[existingIndex].aiInstruction,
        appendTimestampAndCode: data.appendTimestampAndCode !== undefined ? data.appendTimestampAndCode : this.templates[existingIndex].appendTimestampAndCode,
        updatedAt: now,
      };
      this.saveTemplates();
      return this.templates[existingIndex];
    } else {
      const newTemplate: MessageTemplate = {
        id: data.id || `tpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        name: data.name.trim(),
        template: data.template,
        attachment: data.attachment || null,
        aiTone: data.aiTone || "friendly",
        aiInstruction: data.aiInstruction || "",
        appendTimestampAndCode: data.appendTimestampAndCode ?? true,
        createdAt: now,
        updatedAt: now,
      };
      this.templates.unshift(newTemplate);
      this.saveTemplates();
      return newTemplate;
    }
  }

  public deleteTemplate(id: string): boolean {
    const initialLen = this.templates.length;
    this.templates = this.templates.filter((t) => t.id !== id);
    if (this.templates.length !== initialLen) {
      this.saveTemplates();
      return true;
    }
    return false;
  }

  public reloadAll() {
    this.loadTemplates();
  }
}

export const templateService = new TemplateService();
