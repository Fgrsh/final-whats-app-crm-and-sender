import type { Contact, CRMLead, CampaignItem } from "../types.ts";

/**
 * Normalizes a phone number to standard international digits without leading '+' or '00'.
 * Specifically handles Egyptian (010, 011, 012, 015 -> 201...), Saudi (05 -> 9665...), UAE, etc.
 */
export function normalizePhoneNumber(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return "";
  let digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return "";

  // Strip international dialing prefix '00'
  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  // Egypt: 010, 011, 012, 015 (11 digits starting with 01) -> convert to 201...
  if (digits.length === 11 && /^01[0125]/.test(digits)) {
    return "20" + digits.substring(1);
  }

  // Egypt: 10 digits starting with 10, 11, 12, 15 -> convert to 201...
  if (digits.length === 10 && /^1[0125]/.test(digits)) {
    return "20" + digits;
  }

  // Saudi Arabia: 10 digits starting with 05 -> convert to 9665...
  if (digits.length === 10 && digits.startsWith("05")) {
    return "966" + digits.substring(1);
  }

  // Saudi Arabia: 9 digits starting with 5 -> convert to 9665...
  if (digits.length === 9 && digits.startsWith("5")) {
    return "966" + digits;
  }

  // UAE: 10 digits starting with 05 -> convert to 9715...
  if (digits.length === 10 && /^05[024568]/.test(digits)) {
    return "971" + digits.substring(1);
  }

  // General leading zero removal if number is already international length (>= 10)
  if (digits.startsWith("0") && digits.length >= 10) {
    digits = digits.substring(1);
  }

  return digits;
}

/**
 * Checks if two phone numbers refer to the exact same recipient
 */
export function isSamePhoneNumber(phoneA: string | undefined | null, phoneB: string | undefined | null): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhoneNumber(phoneA);
  const normB = normalizePhoneNumber(phoneB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Suffix matching for national vs international formats (if length >= 9)
  const rawA = String(phoneA).replace(/[^0-9]/g, "");
  const rawB = String(phoneB).replace(/[^0-9]/g, "");
  if (rawA.length >= 9 && rawB.length >= 9) {
    if (rawA.endsWith(rawB) || rawB.endsWith(rawA)) {
      return true;
    }
  }

  return false;
}

export interface DuplicateMatchInfo {
  incomingContact: Contact;
  normalizedPhone: string;
  source: "self" | "current_campaign" | "other_campaign" | "crm";
  existingName?: string;
  existingGroupName?: string;
  existingCampaignName?: string;
  existingCrmStage?: string;
  duplicateCountInFile?: number;
  reasonAr: string;
  reasonEn: string;
}

export interface DuplicateAnalysisResult {
  totalIncoming: number;
  uniqueNewCount: number;
  totalDuplicatesFound: number;
  selfDuplicatesCount: number;
  currentCampaignDuplicatesCount: number;
  otherCampaignDuplicatesCount: number;
  crmDuplicatesCount: number;
  cleanContacts: Contact[];
  duplicateDetails: DuplicateMatchInfo[];
  hasDuplicates: boolean;
}

/**
 * Analyzes incoming contacts against:
 * 1. Internal duplicates within the uploaded file itself
 * 2. Current campaign contacts
 * 3. Other campaigns (if provided)
 * 4. CRM Leads (if provided)
 */
export function analyzeImportDuplicates(
  incomingContacts: Contact[],
  currentCampaignContacts: Contact[],
  allCampaigns: CampaignItem[] = [],
  crmLeads: CRMLead[] = []
): DuplicateAnalysisResult {
  const currentMap = new Map<string, Contact>();
  currentCampaignContacts.forEach((c) => {
    const norm = normalizePhoneNumber(c.phone);
    if (norm) currentMap.set(norm, c);
  });

  // Other campaigns map (excluding active campaign contacts)
  const otherCampaignMap = new Map<string, { campaignName: string; contact: Contact }>();
  allCampaigns.forEach((camp) => {
    (camp.contacts || []).forEach((c) => {
      const norm = normalizePhoneNumber(c.phone);
      if (norm && !currentMap.has(norm) && !otherCampaignMap.has(norm)) {
        otherCampaignMap.set(norm, { campaignName: camp.name, contact: c });
      }
    });
  });

  // CRM Leads map
  const crmMap = new Map<string, CRMLead>();
  crmLeads.forEach((l) => {
    const norm = normalizePhoneNumber(l.phone);
    if (norm) crmMap.set(norm, l);
  });

  const seenInFile = new Map<string, number>();
  const cleanContacts: Contact[] = [];
  const duplicateDetails: DuplicateMatchInfo[] = [];

  let selfDuplicatesCount = 0;
  let currentCampaignDuplicatesCount = 0;
  let otherCampaignDuplicatesCount = 0;
  let crmDuplicatesCount = 0;

  incomingContacts.forEach((c) => {
    const norm = normalizePhoneNumber(c.phone);
    if (!norm) return;

    const countInFile = seenInFile.get(norm) || 0;

    // 1. Check if it appeared earlier in the same file
    if (countInFile > 0) {
      seenInFile.set(norm, countInFile + 1);
      selfDuplicatesCount++;
      duplicateDetails.push({
        incomingContact: c,
        normalizedPhone: norm,
        source: "self",
        duplicateCountInFile: countInFile + 1,
        reasonAr: `مكرر داخل الملف المرفوع (${countInFile + 1} مرات)`,
        reasonEn: `Duplicate inside the uploaded file (${countInFile + 1} times)`,
      });
      return;
    }

    seenInFile.set(norm, 1);

    // 2. Check if already exists in current campaign
    if (currentMap.has(norm)) {
      const existing = currentMap.get(norm)!;
      currentCampaignDuplicatesCount++;
      duplicateDetails.push({
        incomingContact: c,
        normalizedPhone: norm,
        source: "current_campaign",
        existingName: existing.name,
        existingGroupName: existing.groupName,
        reasonAr: `موجود بالفعل في الحملة الحالية (مجموعة: "${existing.groupName || "افتراضية"}"${
          existing.name ? ` - الاسم: ${existing.name}` : ""
        })`,
        reasonEn: `Already exists in current campaign (Group: "${existing.groupName || "General"}"${
          existing.name ? ` - Name: ${existing.name}` : ""
        })`,
      });
      return;
    }

    // 3. Check if exists in other campaigns
    if (otherCampaignMap.has(norm)) {
      const existing = otherCampaignMap.get(norm)!;
      otherCampaignDuplicatesCount++;
      duplicateDetails.push({
        incomingContact: c,
        normalizedPhone: norm,
        source: "other_campaign",
        existingCampaignName: existing.campaignName,
        existingName: existing.contact.name,
        reasonAr: `موجود في حملة أخرى: "${existing.campaignName}"`,
        reasonEn: `Already exists in another campaign: "${existing.campaignName}"`,
      });
      return;
    }

    // 4. Check if exists in CRM leads
    if (crmMap.has(norm)) {
      const lead = crmMap.get(norm)!;
      crmDuplicatesCount++;
      duplicateDetails.push({
        incomingContact: c,
        normalizedPhone: norm,
        source: "crm",
        existingName: lead.name,
        existingCrmStage: lead.stage,
        reasonAr: `مسجل مسبقاً في الـ CRM (الاسم: "${lead.name || norm}" - المرحلة: "${lead.stage}")`,
        reasonEn: `Already registered in CRM (Name: "${lead.name || norm}" - Stage: "${lead.stage}")`,
      });
      // Note: Depending on user preference, numbers in CRM can still be imported into campaign or flagged.
      // We flag it as an existing CRM lead so the user is informed!
      return;
    }

    // Clean unique contact
    cleanContacts.push({
      ...c,
      phone: norm,
    });
  });

  const totalDuplicatesFound = duplicateDetails.length;

  return {
    totalIncoming: incomingContacts.length,
    uniqueNewCount: cleanContacts.length,
    totalDuplicatesFound,
    selfDuplicatesCount,
    currentCampaignDuplicatesCount,
    otherCampaignDuplicatesCount,
    crmDuplicatesCount,
    cleanContacts,
    duplicateDetails,
    hasDuplicates: totalDuplicatesFound > 0,
  };
}

/**
 * Deduplicates an array of contacts, keeping the first occurrence and updating missing fields from subsequent occurrences
 */
export function deduplicateContactList(contacts: Contact[]): {
  cleaned: Contact[];
  removedCount: number;
} {
  const map = new Map<string, Contact>();
  let removedCount = 0;

  for (const c of contacts) {
    const norm = normalizePhoneNumber(c.phone);
    if (!norm || norm.length < 7) {
      removedCount++;
      continue;
    }

    if (map.has(norm)) {
      removedCount++;
      const existing = map.get(norm)!;
      // Enrich with any missing info
      if (!existing.name && c.name) existing.name = c.name;
      if (!existing.company && c.company) existing.company = c.company;
      if (!existing.notes && c.notes) existing.notes = c.notes;
    } else {
      map.set(norm, {
        ...c,
        phone: norm,
      });
    }
  }

  return {
    cleaned: Array.from(map.values()),
    removedCount,
  };
}
