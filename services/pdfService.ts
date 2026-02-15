import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { PDFFile } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Handle ESM import for pdfjs-dist which might be structured differently depending on the environment/bundler
// In some cases (like esm.sh), the default export contains the library methods.
const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;

// Configure worker
if (pdfjs && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

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
    
    // Check file type to determine embedding method
    if (imgFile.file.type === 'image/jpeg' || imgFile.file.type === 'image/jpg') {
      image = await pdfDoc.embedJpg(arrayBuffer);
    } else if (imgFile.file.type === 'image/png') {
      image = await pdfDoc.embedPng(arrayBuffer);
    } else {
      continue; // Skip unsupported formats
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

export const splitPDF = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const pageCount = sourcePdf.getPageCount();
  const zip = new JSZip();

  // Create a separate PDF for each page
  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(sourcePdf, [i]);
    newPdf.addPage(page);
    const pdfBytes = await newPdf.save();
    
    // Pad page number for sorting (001, 002, etc.)
    const pageNum = (i + 1).toString().padStart(3, '0');
    zip.file(`page-${pageNum}.pdf`, pdfBytes);
  }

  return await zip.generateAsync({ type: 'blob' });
};

// Basic compression (re-saving often removes unused objects and optimizes XRef table)
export const compressPDF = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  // pdf-lib doesn't support aggressive compression, but saving fresh can help.
  // We can't easily downsample images without a canvas loop which is slow.
  // For this demo, we'll perform a standard clean save.
  return await pdf.save();
};

export const pdfToImages = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Use the resolved pdfjs instance
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const zip = new JSZip();

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const scale = 2.0; // Higher scale for better quality
    const viewport = page.getViewport({ scale });

    // Create a canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Convert to blob
      const blob = await new Promise<Blob | null>(resolve => 
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );

      if (blob) {
        const pageNum = i.toString().padStart(3, '0');
        zip.file(`page-${pageNum}.jpg`, blob);
      }
    }
  }

  return await zip.generateAsync({ type: 'blob' });
};