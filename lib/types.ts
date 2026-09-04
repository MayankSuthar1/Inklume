export interface JournalTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  /** TipTap ProseMirror document JSON structure */
  content?: Record<string, any> | null;
  summary: string;
  keyInsights?: string[];
  tags?: string[];
  turns: JournalTurn[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  status: 'active' | 'archived';
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: string;
}

export interface CompanionSettings {
  persona: 'socratic' | 'empathetic' | 'philosophical' | 'creative' | 'direct';
  responseLength: 'concise' | 'balanced' | 'inDepth';
  customGuidance: string;
  showSuggestions: boolean;
}

export interface AppPreferences {
  companion: CompanionSettings;
  editorFont: 'serif' | 'sans' | 'mono';
  editorFontSize: 'sm' | 'base' | 'lg';
  editorWidth: 'narrow' | 'standard' | 'wide';
  showWordCount: boolean;
}

export interface ChatApiRequest {
  turns: {
    role: 'user' | 'model';
    text: string;
  }[];
  userId: string;
  docTitle?: string;
  docText?: string;
  companionSettings?: CompanionSettings;
}

export interface ChatApiResponse {
  text: string;
  modelUsed: string;
}

export interface SummarizeApiRequest {
  turns: {
    role: 'user' | 'model';
    text: string;
  }[];
  userId: string;
  documentContent?: string;
}

export interface SummarizeApiResponse {
  title: string;
  summary: string;
  keyInsights: string[];
  modelUsed: string;
}

