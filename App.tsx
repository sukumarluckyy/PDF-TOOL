import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PDFFile, AppView } from './types';
import { getPageCount, mergePDFs } from './services/pdfService';
import { suggestFileName } from './services/geminiService';
import { FileList } from './components/FileList';
import { AIAssistant } from './components/AIAssistant';
import { Button } from './components/Button';
import { 
  Upload, 
  Files, 
  ArrowRight, 
  Wand2, 
  Download, 
  CheckCircle,
  Layout
} from 'lucide-react';

const App: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [suggestedName, setSuggestedName] = useState<string>('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
    
    const processedFiles = await Promise.all(pdfFiles.map(async (file) => ({
      id: uuidv4(),
      file,
      name: file.name,
      size: file.size,
      pageCount: await getPageCount(file)
    })));

    setFiles(prev => [...prev, ...processedFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const moveFile = (id: string, direction: 'up' | 'down') => {
    setFiles(prev => {
      const index = prev.findIndex(f => f.id === id);
      if (index === -1) return prev;
      
      const newFiles = [...prev];
      if (direction === 'up' && index > 0) {
        [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
      } else if (direction === 'down' && index < newFiles.length - 1) {
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      }
      return newFiles;
    });
  };

  const handleMerge = async () => {
    if (files.length === 0) return;
    setIsMerging(true);
    
    try {
      // 1. Get Smart Name from Gemini
      const fileNames = files.map(f => f.name);
      const smartName = await suggestFileName(fileNames);
      setSuggestedName(smartName);

      // 2. Merge Files
      const mergedBytes = await mergePDFs(files);
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setMergedPdfUrl(url);
      setActiveView(AppView.MERGE_PREVIEW);
    } catch (error) {
      console.error("Merge failed", error);
      alert("Failed to merge PDFs. Please try again.");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Files className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              PDF Tool
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded border border-blue-100">
              Gemini Powered
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeView === AppView.DASHBOARD && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Upload & List */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Dropzone */}
              <div 
                className={`
                  relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 text-center
                  ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 bg-white'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  multiple 
                  accept="application/pdf"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-4 pointer-events-none">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                    <Upload className={`w-8 h-8 text-blue-500 transition-transform ${isDragging ? 'scale-110' : ''}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">
                      {isDragging ? "Drop files now" : "Drop PDFs here"}
                    </h2>
                    <p className="mt-1 text-slate-500">
                      or click to browse from your computer
                    </p>
                  </div>
                </div>
              </div>

              {/* File List */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Layout className="w-4 h-4" />
                    Files to Merge ({files.length})
                  </h3>
                  {files.length > 0 && (
                    <button 
                      onClick={() => setFiles([])}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="p-4">
                  <FileList 
                    files={files} 
                    onRemove={removeFile}
                    onMove={moveFile}
                  />
                </div>
                {files.length > 0 && (
                   <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                      <Button 
                        onClick={handleMerge} 
                        isLoading={isMerging}
                        icon={<Wand2 className="w-4 h-4" />}
                        className="w-full sm:w-auto"
                      >
                        Merge {files.length} Files
                      </Button>
                   </div>
                )}
              </div>
            </div>

            {/* Right Column: AI Assistant */}
            <div className="lg:col-span-4 h-[600px] sticky top-24">
               <AIAssistant files={files} />
            </div>
          </div>
        )}

        {activeView === AppView.MERGE_PREVIEW && mergedPdfUrl && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-8 text-center border-b border-slate-100">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Merge Complete!</h2>
                <p className="text-slate-500 mt-2">
                  Gemini suggests naming this file:
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                   <input 
                      type="text" 
                      value={suggestedName}
                      onChange={(e) => setSuggestedName(e.target.value)}
                      className="text-center font-mono text-lg bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 w-full max-w-md focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
                <div className="mt-6 flex justify-center gap-4">
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setActiveView(AppView.DASHBOARD);
                      setMergedPdfUrl(null);
                    }}
                  >
                    Start Over
                  </Button>
                  <a 
                    href={mergedPdfUrl} 
                    download={suggestedName}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                </div>
              </div>
              
              <div className="bg-slate-100 p-8 flex justify-center">
                 <iframe 
                   src={mergedPdfUrl} 
                   className="w-full h-[600px] rounded-lg shadow-inner border border-slate-300"
                   title="PDF Preview"
                 />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;