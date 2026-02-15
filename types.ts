import React from 'react';

export interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  pageCount?: number;
}

export enum AppView {
  HOME = 'HOME',
  TOOL = 'TOOL'
}

export type ToolType = 'MERGE' | 'SPLIT' | 'COMPRESS' | 'JPG_TO_PDF' | 'PDF_TO_JPG';

export interface ToolConfig {
  id: ToolType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accept: string;
  multiple: boolean;
}

export interface ProcessingResult {
  success: boolean;
  data?: Uint8Array | Blob; // For single file result
  url?: string;
  name?: string;
  archive?: Blob; // For ZIP results
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}