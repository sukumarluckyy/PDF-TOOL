import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PDFFile, AppView, ToolType, ToolConfig, ProcessingResult } from './types';
import { 
  mergePDFs, 
  imagesToPDF, 
  splitPDF, 
  compressPDF, 
  pdfToImages,
  getPageCount 
} from './services/pdfService';
import { FileList } from './components/FileList';
import { Button } from './components/Button';
import { ToolCard } from './components/ToolCard';
import { 
  Files, 
  Upload, 
  Download, 
  ArrowLeft, 
  Merge, 
  Scissors, 
  Minimize2, 
  Image as ImageIcon, 
  FileType,
  Layout,
  CheckCircle,
  Loader2
} from 'lucide-react';

// Tool Configuration
const TOOLS: ToolConfig[] = [
  {
    id: 'MERGE',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into one single document in seconds. Drag and drop to reorder.',
    icon: <Merge className="w-6 h-6" />,
    color: 'bg-indigo-500',
    accept: 'application/pdf',
    multiple: true
  },
  {
    id: 'SPLIT',
    title: 'Split PDF',
    description: 'Separate one PDF file into individual pages. Downloads as a ZIP archive of all pages.',
    icon: <Scissors className="w-6 h-6" />,
    color: 'bg-rose-500',
    accept: 'application/pdf',
    multiple: false
  },
  {
    id: 'COMPRESS',
    title: 'Compress PDF',
    description: 'Optimize your PDF file size while maintaining quality for sharing and storage.',
    icon: <Minimize2 className="w-6 h-6" />,
    color: 'bg-emerald-500',
    accept: 'application/pdf',
    multiple: false
  },
  {
    id: 'JPG_TO_PDF',
    title: 'JPG to PDF',
    description: 'Convert your images (JPG, PNG) into a single PDF document.',
    icon: <ImageIcon className="w-6 h-6" />,
    color: 'bg-amber-500',
    accept: 'image/jpeg, image/png, image/jpg',
    multiple: true
  },
  {
    id: 'PDF_TO_JPG',
    title: 'PDF to JPG',
    description: 'Extract pages from your PDF file and save them as high-quality images.',
    icon: <FileType className="w-6 h-6" />,
    color: 'bg-blue-500',
    accept: 'application/pdf',
    multiple: false
  }
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.HOME);
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null);
  
  // State for tool execution
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // --- Navigation Helpers ---

  const openTool = (toolId: ToolType) => {
    const tool = TOOLS.find(t => t.id === toolId);
    if (tool) {
      setActiveTool(tool);
      setView(AppView.TOOL);
      setFiles([]);
      setResult(null);
    }
  };

  const goBack = () => {
    setView(AppView.HOME);
    setActiveTool(null);
    setFiles([]);
    setResult(null);
  };

  // --- File Handling ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processDroppedFiles = async (fileList: File[]) => {
    if (!activeTool) return;
    
    // Filter files based on tool acceptance
    let validFiles = fileList.filter(f => {
      if (activeTool.accept.includes('image')) {
        return f.type.startsWith('image/');
      }
      return f.type === 'application/pdf';
    });

    // Enforce multiple flag
    if (!activeTool.multiple && validFiles.length > 1) {
      validFiles = [validFiles[0]];
      // If we already have files and it's single mode, replace it
      setFiles([]); 
    } else if (!activeTool.multiple && validFiles.length === 1) {
       setFiles([]); // Replace existing
    }

    const processedFiles = await Promise.all(validFiles.map(async (file) => ({
      id: uuidv4(),
      file,
      name: file.name,
      size: file.size,
      pageCount: file.type === 'application/pdf' ? await getPageCount(file) : undefined
    })));

    setFiles(prev => activeTool.multiple ? [...prev, ...processedFiles] : processedFiles);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && activeTool) {
      await processDroppedFiles(Array.from(e.dataTransfer.files));
    }
  }, [activeTool]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && activeTool) {
      await processDroppedFiles(Array.from(e.target.files));
    }
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

  // --- Processing Logic ---

  const handleProcess = async () => {
    if (!activeTool || files.length === 0) return;
    setIsProcessing(true);
    setResult(null);

    try {
      let data: Uint8Array | Blob | undefined;
      let archive: Blob | undefined;
      let url: string | undefined;
      let name = 'processed.pdf';

      switch (activeTool.id) {
        case 'MERGE':
          data = await mergePDFs(files);
          name = 'merged_document.pdf';
          break;
        case 'JPG_TO_PDF':
          data = await imagesToPDF(files);
          name = 'images_converted.pdf';
          break;
        case 'SPLIT':
          archive = await splitPDF(files[0].file);
          name = `${files[0].name.replace('.pdf', '')}_pages.zip`;
          break;
        case 'COMPRESS':
          data = await compressPDF(files[0].file);
          name = `${files[0].name.replace('.pdf', '')}_compressed.pdf`;
          break;
        case 'PDF_TO_JPG':
          archive = await pdfToImages(files[0].file);
          name = `${files[0].name.replace('.pdf', '')}_images.zip`;
          break;
      }

      if (data) {
        const blob = new Blob([data], { type: 'application/pdf' });
        url = URL.createObjectURL(blob);
      } else if (archive) {
        url = URL.createObjectURL(archive);
      }

      setResult({
        success: true,
        data,
        archive,
        url,
        name
      });
    } catch (error) {
      console.error("Processing error", error);
      alert("An error occurred while processing your files.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      
      {/* Global Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => setView(AppView.HOME)}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-all">
              <Files className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              PDF Tool
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        
        {view === AppView.HOME && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                Every tool you need for your PDFs
              </h2>
              <p className="text-lg text-slate-500">
                A minimal, secure, and completely free suite of tools to manage your documents directly in your browser.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {TOOLS.map((tool) => (
                <ToolCard 
                  key={tool.id}
                  {...tool}
                  onClick={() => openTool(tool.id)}
                />
              ))}
            </div>
          </div>
        )}

        {view === AppView.TOOL && activeTool && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <button 
              onClick={goBack}
              className="mb-6 flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Tools
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
              {/* Tool Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${activeTool.color} bg-opacity-10`}>
                    <div className={`${activeTool.color.replace('bg-', 'text-')}`}>
                       {activeTool.icon}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{activeTool.title}</h2>
                    <p className="text-sm text-slate-500">{activeTool.description}</p>
                  </div>
                </div>
              </div>

              {/* Tool Content */}
              <div className="flex-1 p-6 md:p-8 flex flex-col">
                
                {!result && (
                  <>
                    {/* Upload Area - Show if empty or if multiple allowed */}
                    {(files.length === 0 || activeTool.multiple) && (
                      <div 
                        className={`
                          relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 mb-8
                          ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'}
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input 
                          type="file" 
                          multiple={activeTool.multiple}
                          accept={activeTool.accept}
                          onChange={handleFileInput}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-4 pointer-events-none">
                          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center">
                            <Upload className={`w-6 h-6 text-blue-500 transition-transform ${isDragging ? 'scale-110' : ''}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              {files.length > 0 && activeTool.multiple ? "Add more files" : "Choose files to upload"}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                              or drag and drop them here
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* File List */}
                    {files.length > 0 && (
                      <div className="flex-1 flex flex-col">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                            Files ({files.length})
                          </h3>
                          <button 
                            onClick={() => setFiles([])}
                            className="text-xs text-red-500 hover:text-red-600 font-medium"
                          >
                            Clear All
                          </button>
                        </div>
                        
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-8 max-h-[400px] overflow-y-auto">
                           <FileList 
                             files={files} 
                             onRemove={removeFile}
                             onMove={moveFile}
                           />
                        </div>

                        <div className="mt-auto flex justify-end">
                           <Button 
                              onClick={handleProcess}
                              isLoading={isProcessing}
                              className="w-full sm:w-auto min-w-[160px] !py-3 !text-base"
                           >
                              {activeTool.title}
                           </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Result View */}
                {result && (
                   <div className="flex flex-col items-center justify-center flex-1 py-12 text-center animate-in fade-in zoom-in-95">
                      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <CheckCircle className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        Task Completed!
                      </h3>
                      <p className="text-slate-500 max-w-sm mb-8">
                        Your files have been processed successfully. You can now download the result.
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                         <Button 
                            variant="secondary"
                            onClick={() => {
                               setResult(null);
                               setFiles([]);
                            }}
                         >
                            Start Over
                         </Button>
                         <a 
                            href={result.url} 
                            download={result.name}
                            className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all font-semibold active:scale-95"
                         >
                            <Download className="w-5 h-5" />
                            Download {result.archive ? 'ZIP' : 'PDF'}
                         </a>
                      </div>
                   </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;