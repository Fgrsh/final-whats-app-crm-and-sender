export interface Contact {
  id: string;
  phone: string;
  rawPhone: string;
  name?: string;
  company?: string;
  notes?: string;
  groupName?: string;
  customFields?: Record<string, string>;
  status: 'pending' | 'generating' | 'sending' | 'sent' | 'failed' | 'skipped';
  personalizedMessage?: string;
  errorMessage?: string;
  sentAt?: string;
  messageId?: string;
  deliveryStatus?: 'pending' | 'server_ack' | 'delivered' | 'read' | 'failed' | 'not_registered' | 'unknown';
}

export interface CampaignAttachment {
  type: 'image' | 'document';
  fileName: string;
  mimetype: string;
  dataBase64: string;
  size?: number;
}

export interface MessageTemplate {
  id: string;
  name: string;
  template: string;
  attachment?: CampaignAttachment | null;
  aiInstruction?: string;
  aiTone?: 'friendly' | 'professional' | 'sales' | 'reminder' | 'casual';
  appendTimestampAndCode?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignConfig {
  template: string;
  templateId?: string;
  templateName?: string;
  useAI: boolean;
  aiInstruction: string;
  aiTone: 'friendly' | 'professional' | 'sales' | 'reminder' | 'casual';
  language: 'ar' | 'en';
  minDelay: number;
  maxDelay: number;
  enableBatchPause: boolean;
  batchSize: number;
  batchPauseDuration: number;
  sendMethod: 'baileys' | 'direct_link';
  appendTimestampAndCode: boolean;
  enableDailyLimit: boolean;
  dailyLimit: number;
  attachment?: CampaignAttachment | null;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  phone?: string;
}

export interface QueueProgress {
  isRunning: boolean;
  isPaused: boolean;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  currentIndex: number;
  currentContactId?: string;
  estimatedSecondsLeft?: number;
  sentToday: number;
  dailyLimit: number;
  isWaitingForNextDay: boolean;
  currentDayDate: string;
}

export interface WhatsAppStatus {
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  qrCode?: string | null;
  qrCodeDataUrl?: string | null;
  pairingCode?: string | null;
  user?: {
    id?: string;
    name?: string;
    phone?: string;
  } | null;
  lastError?: string | null;
  connectedAt?: string | null;
  isAvailable?: boolean;
}

// --- CRM & Leads Management Types ---

export type LeadStage = 'new' | 'follow_up' | 'interested' | 'negotiation' | 'won' | 'lost';
export type LeadPriority = 'high' | 'medium' | 'low';
export type ActivityType = 'call' | 'whatsapp' | 'meeting' | 'note';

export interface FollowUpActivity {
  id: string;
  timestamp: string;
  type: ActivityType;
  title: string;
  note: string;
  outcome?: string;
}

export interface ExtractedMessage {
  id: string;
  phone: string;
  senderName?: string;
  text: string;
  timestamp: string;
  rawTimestamp?: number;
  fromMe: boolean;
  hasMedia?: boolean;
  accountId?: string;
  accountName?: string;
}

export interface ExtractedChatSummary {
  phone: string;
  name: string;
  lastMessage: string;
  lastMessageTimestamp: string;
  rawTimestamp?: number;
  unreadCount: number;
  messageCount: number;
  isAlreadyLead: boolean;
  leadId?: string;
  accountId?: string;
  accountName?: string;
}

export interface CampaignBackup {
  version: string;
  exportedAt: string;
  appName?: string;
  summary: {
    totalContacts: number;
    sentContacts: number;
    pendingContacts: number;
    failedContacts: number;
    totalLogs: number;
  };
  config: CampaignConfig;
  contacts: Contact[];
  logs: LogEntry[];
}

export interface CRMLead {
  id: string;
  phone: string;
  rawPhone?: string;
  name: string;
  company?: string;
  stage: LeadStage;
  priority: LeadPriority;
  dealValue?: number;
  tags: string[];
  notes?: string;
  source: 'whatsapp_extracted' | 'campaign' | 'manual' | 'csv_import';
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
  nextFollowUpDate?: string; // YYYY-MM-DD
  nextFollowUpTime?: string; // HH:mm
  nextFollowUpNote?: string;
  isFollowUpDone?: boolean;
  activities: FollowUpActivity[];
  recentMessages?: ExtractedMessage[];
  aiAnalysis?: {
    summary?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    recommendedAction?: string;
    suggestedMessage?: string;
    analyzedAt?: string;
  };
}

export interface WhatsAppAccountInfo {
  id: string;
  name: string;
  phone?: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  qrCodeDataUrl?: string | null;
  pairingCode?: string | null;
  user?: {
    id?: string;
    name?: string;
    phone?: string;
  } | null;
  connectedAt?: string | null;
  lastError?: string | null;
}

export interface CampaignItem {
  id: string;
  name: string;
  whatsappAccountId: string;
  status: 'idle' | 'running' | 'paused' | 'completed';
  contacts: Contact[];
  config: CampaignConfig;
  progress: QueueProgress;
  logs: LogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactDeliveryDiagnostic {
  phone: string;
  name?: string;
  messageId?: string;
  sentAt?: string;
  isRegisteredOnWhatsApp: boolean;
  verifiedJid?: string;
  deliveryStatus: 'READ' | 'DELIVERY_ACK' | 'SERVER_ACK' | 'PENDING' | 'ERROR' | 'NOT_REGISTERED' | 'NOT_FOUND' | 'NOT_SENT';
  deliveryStatusLabelAr: string;
  deliveryStatusLabelEn: string;
  statusCode?: number;
  lastUpdated?: string;
  isSelf?: boolean;
  diagnosticNote: string;
  troubleshootGuide?: string;
  error?: string;
}

export interface DeliveryVerificationResult {
  success: boolean;
  timestamp: string;
  campaignId?: string;
  campaignName?: string;
  provider: {
    accountId: string;
    accountName: string;
    isConnected: boolean;
    senderPhone?: string;
    socketStatus: string;
    wsReadyState: 'OPEN' | 'CONNECTING' | 'CLOSED' | 'UNKNOWN';
  };
  summary: {
    totalContactsChecked: number;
    registeredCount: number;
    unregisteredCount: number;
    deliveredCount: number;
    serverAckCount: number;
    readCount: number;
    pendingOrErrorCount: number;
    verdict: 'ALL_DELIVERED' | 'PARTIAL_DELIVERY' | 'SERVER_WAITING' | 'UNREGISTERED_DETECTED' | 'DISCONNECTED' | 'NO_SENT_MESSAGES';
    verdictLabelAr: string;
    verdictLabelEn: string;
  };
  contacts: ContactDeliveryDiagnostic[];
  recommendations: {
    ar: string[];
    en: string[];
  };
  rawLogs?: string[];
}

// ==========================================
// --- AI Sales Agent System Types ---
// ==========================================

export type AIAgentMode = 'all' | 'new_leads_only' | 'whitelist_only' | 'off';
export type AISessionStatus = 'active' | 'human_takeover' | 'completed' | 'disabled';
export type AILeadQuality = 'cold' | 'warm' | 'hot';
export type AILeadIntent =
  | 'inquiry'
  | 'pricing'
  | 'purchasing'
  | 'complaint'
  | 'support'
  | 'human_request'
  | 'general';

export interface AIProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  description: string;
  features?: string[];
  inStock: boolean;
  sku?: string;
}

export interface AIFaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface AIKnowledgeBase {
  companyName: string;
  businessSummary: string;
  currency: string;
  products: AIProduct[];
  faqs: AIFaqItem[];
  shippingPolicy: string;
  returnPolicy: string;
  paymentMethods: string;
  workingHours: {
    enabled: boolean;
    start: string; // e.g. "09:00"
    end: string;   // e.g. "21:00"
    outsideHoursMessage: string;
  };
  contactInfo: string;
}

export interface AIAgentSettings {
  enabled: boolean;
  agentName: string;
  companyName: string;
  operatingMode: AIAgentMode;
  responseDelaySeconds: number; // natural typing feel 2-10s
  typingIndicator: boolean;
  language: 'ar' | 'en' | 'auto';
  tone: 'friendly' | 'professional' | 'persuasive' | 'consultative';
  model: string;
  temperature: number;
  maxHistoryTurns: number;
  systemPromptCustom: string;
  humanHandoffKeywords: string[];
  autoHandoffOnAngry: boolean;
  handoffMessage: string;
  welcomeMessage: string;
  autoScoreLeads: boolean;
  autoCreateCrmLeads: boolean;
  whitelistPhones: string[];
  blacklistPhones: string[];
  antiBanSafetyEnabled?: boolean;
  maxRepliesPerMinute?: number;
  minReplyIntervalSeconds?: number;
  onlyReplyToNewMessages?: boolean;
  maxMessageAgeSeconds?: number;
  enableInteractiveOptions?: boolean;
  optionsMenuPrompt?: string;
}

export interface AIAgentSession {
  phone: string;
  name: string;
  status: AISessionStatus;
  handoffReason?: string;
  handoffTimestamp?: string;
  leadScore: number;
  leadQuality: AILeadQuality;
  intent: AILeadIntent;
  summary: string;
  keyPreferences: string[];
  totalTurns: number;
  firstInteraction: string;
  lastInteraction: string;
  accountId?: string;
  accountName?: string;
  hasUnreadForHuman?: boolean;
}

export interface AIOrderItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type AIOrderStatus = 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

export interface AIOrder {
  id: string;
  phone: string;
  customerName: string;
  items: AIOrderItem[];
  totalAmount: number;
  currency: string;
  shippingAddress: string;
  locationUrl?: string;
  locationCoordinates?: { latitude: number; longitude: number };
  paymentMethod: string;
  notes: string;
  status: AIOrderStatus;
  shippingFee?: number;
  isRetail?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIAgentActivityLog {
  id: string;
  timestamp: string;
  phone: string;
  type:
    | 'incoming_message'
    | 'ai_reply'
    | 'order_collected'
    | 'order_updated'
    | 'human_handoff'
    | 'manual_takeover'
    | 'resumed_ai'
    | 'lead_scored'
    | 'anti_ban_blocked'
    | 'safety_paused'
    | 'error';
  title: string;
  details: string;
}

export interface AIAgentDashboardStats {
  enabled: boolean;
  totalConversations: number;
  activeAiChats: number;
  humanTakeovers: number;
  totalOrders: number;
  totalOrderValue: number;
  hotLeadsCount: number;
  warmLeadsCount: number;
  coldLeadsCount: number;
  currency: string;
  antiBanStatus?: {
    safeQueueLength: number;
    repliesInLastMinute: number;
    maxRepliesPerMinute: number;
    circuitBreakerTripped: boolean;
    circuitBreakerRemainingSeconds: number;
    cooldownActive: boolean;
  };
}


