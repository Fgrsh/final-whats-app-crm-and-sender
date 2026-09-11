import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Contact } from "../types.ts";
import { normalizePhoneNumber } from "./phoneUtils.ts";

export function cleanPhoneNumber(raw: string): string {
  if (!raw) return "";
  return normalizePhoneNumber(raw);
}

export function parseCSVString(content: string): Contact[] {
  const result = Papa.parse(content, { header: true, skipEmptyLines: true });
  return processParsedRows(result.data as Record<string, any>[]);
}

export async function parseFile(file: File): Promise<Contact[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(processParsedRows(results.data as Record<string, any>[]));
        },
        error: (err) => reject(err),
      });
    });
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
    return processParsedRows(rows);
  } else {
    throw new Error("نوع الملف غير مدعوم. يرجى رفع ملف بصيغة CSV أو Excel (.xlsx)");
  }
}

function processParsedRows(rows: Record<string, any>[]): Contact[] {
  const contacts: Contact[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;

    let phoneVal = "";
    let nameVal = "";
    let companyVal = "";
    let notesVal = "";
    const customFields: Record<string, string> = {};

    for (const [key, val] of Object.entries(row)) {
      if (!key) continue;
      const lowerKey = key.trim().toLowerCase();
      const strVal = String(val ?? "").trim();

      if (
        !phoneVal &&
        (lowerKey.includes("phone") ||
          lowerKey.includes("mobile") ||
          lowerKey.includes("number") ||
          lowerKey.includes("tel") ||
          lowerKey.includes("whatsapp") ||
          lowerKey.includes("هاتف") ||
          lowerKey.includes("جوال") ||
          lowerKey.includes("موبايل") ||
          lowerKey.includes("رقم"))
      ) {
        phoneVal = strVal;
      } else if (
        !nameVal &&
        (lowerKey.includes("name") ||
          lowerKey.includes("client") ||
          lowerKey.includes("customer") ||
          lowerKey.includes("اسم") ||
          lowerKey.includes("عميل"))
      ) {
        nameVal = strVal;
      } else if (
        !companyVal &&
        (lowerKey.includes("company") ||
          lowerKey.includes("org") ||
          lowerKey.includes("business") ||
          lowerKey.includes("شركة") ||
          lowerKey.includes("مؤسسة"))
      ) {
        companyVal = strVal;
      } else if (
        !notesVal &&
        (lowerKey.includes("note") ||
          lowerKey.includes("detail") ||
          lowerKey.includes("order") ||
          lowerKey.includes("ملاحظ") ||
          lowerKey.includes("تفاصيل"))
      ) {
        notesVal = strVal;
      } else {
        customFields[key.trim()] = strVal;
      }
    }

    // Fallback if no phone header matched: find the first value that looks like a phone number
    if (!phoneVal) {
      for (const val of Object.values(row)) {
        const cleaned = cleanPhoneNumber(String(val));
        if (cleaned.length >= 8 && cleaned.length <= 16) {
          phoneVal = String(val);
          break;
        }
      }
    }

    const clean = cleanPhoneNumber(phoneVal);
    if (clean.length >= 7) {
      contacts.push({
        id: `c-${i + 1}-${Date.now().toString(36)}`,
        phone: clean,
        rawPhone: phoneVal,
        name: nameVal || undefined,
        company: companyVal || undefined,
        notes: notesVal || undefined,
        customFields,
        status: "pending",
      });
    }
  }

  return contacts;
}

export function parsePastedNumbers(text: string): Contact[] {
  const lines = text.split(/[\r\n]+/);
  const contacts: Contact[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check if format is "phone,name,company,notes"
    if (trimmed.includes(",")) {
      const parts = trimmed.split(",").map((p) => p.trim());
      const clean = cleanPhoneNumber(parts[0]);
      if (clean.length >= 7) {
        contacts.push({
          id: `p-${idx + 1}-${Date.now().toString(36)}`,
          phone: clean,
          rawPhone: parts[0],
          name: parts[1] || undefined,
          company: parts[2] || undefined,
          notes: parts[3] || undefined,
          status: "pending",
        });
      }
    } else {
      // Just phone number
      const clean = cleanPhoneNumber(trimmed);
      if (clean.length >= 7) {
        contacts.push({
          id: `p-${idx + 1}-${Date.now().toString(36)}`,
          phone: clean,
          rawPhone: trimmed,
          status: "pending",
        });
      }
    }
  });

  return contacts;
}

export function generateSampleCSV(): string {
  return `phone,name,company,notes
201012345678,أحمد حسام,شركة الأمل,تأكيد طلب الشراء رقم 1042
966501234567,سارة العتيبي,مؤسسة النور,تذكير بالموعد غداً الساعة 4 عصراً
971501234567,محمد السويدي,الرواد للتجارة,عرض خاص بخصم 20%
201198765432,محمود علي,البركة,فاتورة رقم 889
`;
}
