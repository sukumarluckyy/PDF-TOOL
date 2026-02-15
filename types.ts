export interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string; // For first page thumbnail if possible
  pageCount?: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  EDITOR = 'EDITOR',
  MERGE_PREVIEW = 'MERGE_PREVIEW'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
