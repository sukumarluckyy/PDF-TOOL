import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { PDFFile } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Robust PDF.js initialization
const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;
if (pdfjs && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// Helper: Parse page ranges (e.g., "1, 3-5") into 0-based indices
const parsePageRanges = (rangeStr: string, totalPages: number): number[] => {
  if (!rangeStr.trim()) {
    // Default to all pages if empty
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const pages = new Set<number>();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i > 0 && i <= totalPages) pages.add(i - 1);
        }
      }
    } else {
      const page = Number(trimmed);
      if (!isNaN(page) && page > 0 && page <= totalPages) {
        pages.add(page - 1);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
};

export const getPageCount = async (file: File): Promise<number> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    return pdf.getPageCount();
  } catch (e) {
    console.error("Error reading PDF page count", e);
    return 0;
  }
};

export const mergePDFs = async (files: PDFFile[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();

  for (const pdfFile of files) {
    const arrayBuffer = await pdfFile.file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
};

export const imagesToPDF = async (files: PDFFile[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();

  for (const imgFile of files) {
    const arrayBuffer = await imgFile.file.arrayBuffer();
    let image;
    
    if (imgFile.file.type === 'image/jpeg' || imgFile.file.type === 'image/jpg') {
      image = await pdfDoc.embedJpg(arrayBuffer);
    } else if (imgFile.file.type === 'image/png') {
      image = await pdfDoc.embedPng(arrayBuffer);
    } else {
      continue;
    }

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  return await pdfDoc.save();
};

export const splitPDF = async (file: File, rangeStr: string): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const totalPages = sourcePdf.getPageCount();
  
  const indicesToKeep = parsePageRanges(rangeStr, totalPages);
  
  if (indicesToKeep.length === 0) {
     throw new Error("No valid pages selected");
  }

  const zip = new JSZip();

  // If user selected multiple pages, we create individual PDFs for them
  // Logic: Split EACH selected page into its own file
  for (const pageIndex of indicesToKeep) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(sourcePdf, [pageIndex]);
    newPdf.addPage(page);
    const pdfBytes = await newPdf.save();
    
    const pageNum = (pageIndex + 1).toString().padStart(3, '0');
    zip.file(`page-${pageNum}.pdf`, pdfBytes);
  }

  return await zip.generateAsync({ type: 'blob' });
};

// Compression: Render pages to images at reduced quality and rebuild PDF
export const compressPDF = async (file: File, quality: number = 0.7): Promise<Uint8Array> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  
  const newPdfDoc = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Use a reasonable scale. Lower scale = smaller size but blurrier text.
    // 1.5 is a decent balance for readability vs size when re-encoding.
    const scale = 1.5; 
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) continue;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
    const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());
    
    const embeddedImage = await newPdfDoc.embedJpg(imgBytes);
    
    const newPage = newPdfDoc.addPage([viewport.width / scale, viewport.height / scale]); // Maintain original physical size
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: viewport.width / scale,
      height: viewport.height / scale,
    });
  }

  return await newPdfDoc.save();
};

export const pdfToImages = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const zip = new JSZip();

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const scale = 2.0; 
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Promise wrap toDataURL or toBlob for consistency
      const blob = await new Promise<Blob | null>(resolve => 
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      );

      if (blob) {
        const pageNum = i.toString().padStart(3, '0');
        zip.file(`page-${pageNum}.jpg`, blob);
      }
    }
  }

  return await zip.generateAsync({ type: 'blob' });
};