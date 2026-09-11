import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

export function interpolateVariables(template: string, data: Record<string, any>): string {
  if (!template) return "";
  let result = template;

  for (const [key, value] of Object.entries(data)) {
    if (!key) continue;
    const cleanKey = String(key).replace(/^\uFEFF/, "").trim();
    if (!cleanKey) continue;
    const escapedKey = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\{${escapedKey}\\}`, "gi");
    result = result.replace(regex, value !== undefined && value !== null ? String(value) : "");
  }

  return result;
}

export async function personalizeMessage({
  template,
  contactData,
  instruction = "",
  tone = "friendly",
  language = "ar"
}: {
  template: string;
  contactData: Record<string, any>;
  instruction?: string;
  tone?: string;
  language?: string;
}): Promise<string> {
  const baseMessage = interpolateVariables(template, contactData);
  const client = getAIClient();

  if (!client) {
    // If no Gemini key is provided, return standard interpolated message
    return baseMessage;
  }

  try {
    const systemPrompt = `You are an expert WhatsApp message copywriter and communication strategist.
Your task is to rewrite and personalize the following message for a recipient on WhatsApp.

RULES:
1. Tone requested: ${tone}.
2. Language: ${language === "ar" ? "Arabic (natural, engaging Arabic suitable for WhatsApp)" : "English"}.
3. Custom extra guidance: ${instruction || "Keep it concise, friendly, authentic, and not spammy"}.
4. PRESERVE all essential facts: names, specific dates, times, amounts, discount codes, links, contact details.
5. Make the wording varied and natural to avoid robotic spam detection algorithms, but keep the exact same core message.
6. WhatsApp formatting: Use standard WhatsApp formatting (*bold*, _italic_, emojis where appropriate) and clean line breaks.
7. CRITICAL: Output ONLY the final message ready to be sent. Do NOT enclose in markdown quotes or add conversational preface.`;

    const userPrompt = `Recipient Data:
${JSON.stringify(contactData, null, 2)}

Base Template with Values:
${baseMessage}

Rewrite this message specifically for this recipient:`;

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `${systemPrompt}\n\n${userPrompt}`,
    });

    const output = response.text?.trim();
    return output || baseMessage;
  } catch (error) {
    console.error("Gemini personalization error, using template fallback:", error);
    return baseMessage;
  }
}

export async function generateTemplatePrompt({
  purpose,
  tone = "friendly",
  language = "ar",
  industry = "general"
}: {
  purpose: string;
  tone?: string;
  language?: string;
  industry?: string;
}): Promise<string> {
  const client = getAIClient();
  if (!client) {
    return language === "ar"
      ? `مرحباً {name}، نأمل أن تكون بخير! نود تذكيرك بـ {notes} لدى شركة {company}. لا تتردد بالتواصل معنا.`
      : `Hi {name}, hope you're having a great day! Regarding {notes} from {company}, let us know if you need anything.`;
  }

  try {
    const prompt = `Write a high-converting, professional WhatsApp message template for:
Purpose: ${purpose}
Tone: ${tone}
Industry: ${industry}
Language: ${language === "ar" ? "Arabic" : "English"}

Available variables to include where relevant:
- {name}: Recipient full name
- {company}: Company or store name
- {notes}: Order detail or specific note
- {custom1}: Any extra field

Rules:
- Make it polite, engaging, and clear with a distinct call-to-action.
- Use clean line breaks and relevant emojis.
- Return ONLY the raw template text.`;

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Error generating template:", error);
    return "";
  }
}

export async function analyzeLeadWithGemini({
  name,
  phone,
  company,
  stage,
  notes,
  messages = [],
  activities = [],
}: {
  name: string;
  phone: string;
  company?: string;
  stage: string;
  notes?: string;
  messages?: { senderName?: string; text: string; timestamp: string; fromMe: boolean }[];
  activities?: { type: string; title: string; note: string; timestamp: string }[];
}): Promise<{
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  recommendedAction: string;
  suggestedMessage: string;
}> {
  const client = getAIClient();

  const conversationHistory = messages
    .slice(-15)
    .map((m) => `[${m.timestamp}] ${m.fromMe ? "المبيعات / أنت" : m.senderName || "العميل"}: ${m.text}`)
    .join("\n");

  const activitiesHistory = activities
    .slice(-5)
    .map((a) => `[${a.timestamp}] نوع: ${a.type}, عنوان: ${a.title}, ملاحظة: ${a.note}`)
    .join("\n");

  const fallbackResult = {
    summary: `عميل مهتم بالتواصل (${name || phone}). يرجى المتابعة وتأكيد الاحتياجات ومناقشة عرض السعر المناسب.`,
    sentiment: "positive" as const,
    recommendedAction: "إرسال رسالة ترحيبية وتحديد موعد اتصال هاتفي مباشر.",
    suggestedMessage: `مرحباً ${name || "عزيزي العميل"}، يسعدنا تواصلك معنا دائماً. هل لديك أي استفسار بخصوص خدماتنا لنقدم لك أفضل عرض مناسب؟`,
  };

  if (!client) {
    return fallbackResult;
  }

  try {
    const prompt = `أنت خبير مبيعات ومحلل CRM محترف لرسائل واتساب.
المطلوب منك تحليل بيانات العميل والمحادثات التالية لاستخراج رؤية استراتيجية واقتراح الرد الأفضل:

بيانات العميل:
- الاسم: ${name || "غير محدد"}
- الهاتف: ${phone}
- الشركة / النشاط: ${company || "غير محدد"}
- مرحلة الصفقة (Stage): ${stage}
- الملاحظات الحالية: ${notes || "لا يوجد"}

سجل المحادثات مع العميل (واتساب):
${conversationHistory || "لا يوجد رسائل مسجلة بعد"}

سجل الأنشطة السابقة:
${activitiesHistory || "لا يوجد أنشطة سابقة"}

المطلوب إخراج النتيجة بتنسيق JSON حصراً بالشكل التالي دون نصوص إضافية:
{
  "summary": "ملخص دقيق ومختصر جداً في سطرين عن اهتمام العميل ونقاط القوة أو الاعتراضات",
  "sentiment": "positive أو neutral أو negative",
  "recommendedAction": "الخطوة العملية التالية الموصى بها لمسؤول المبيعات لإغلاق الصفقة",
  "suggestedMessage": "نص رسالة واتساب جاهزة للإرسال للعميل تتناسب تماماً مع سياق الحديث بنبرة مهنية وجذابة وبها دعوة لاتخاذ إجراء (Call to action)"
}`;

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim();
    if (!text) return fallbackResult;

    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || fallbackResult.summary,
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment)
        ? parsed.sentiment
        : "neutral",
      recommendedAction: parsed.recommendedAction || fallbackResult.recommendedAction,
      suggestedMessage: parsed.suggestedMessage || fallbackResult.suggestedMessage,
    };
  } catch (err) {
    console.error("Error analyzing lead with Gemini:", err);
    return fallbackResult;
  }
}

