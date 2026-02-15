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
  CheckCircle,
  Layers,
  Settings
} from 'lucide-react';

// Tool Configuration
const TOOLS: ToolConfig[] = [
  {
    id: 'MERGE',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into one single document. Drag to reorder or sort alphabetically.',
    icon: <Merge className="w-6 h-6" />,
    color: 'bg-indigo-500',
    accept: 'application/pdf',
    multiple: true
  },
  {
    id: 'SPLIT',
    title: 'Split PDF',
    description: 'Separate a PDF into individual pages or extract specific pages.',
    icon: <Scissors className="w-6 h-6" />,
    color: 'bg-rose-500',
    accept: 'application/pdf',
    multiple: false
  },
  {
    id: 'COMPRESS',
    title: 'Compress PDF',
    description: 'Reduce file size by optimizing and compressing images within the PDF.',
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

  // Tool Specific Options
  const [splitRange, setSplitRange] = useState('');
  const [compressionLevel, setCompressionLevel] = useState(0.7);

  // --- Navigation Helpers ---

  const openTool = (toolId: ToolType) => {
    const tool = TOOLS.find(t => t.id === toolId);
    if (tool) {
      setActiveTool(tool);
      setView(AppView.TOOL);
      setFiles([]);
      setResult(null);
      setSplitRange('');
      setCompressionLevel(0.7);
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

    if (validFiles.length === 0) return;

    // Enforce multiple flag
    if (!activeTool.multiple && validFiles.length > 1) {
      validFiles = [validFiles[0]];
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

  const handleReorder = (newOrder: PDFFile[]) => {
      setFiles(newOrder);
  };

  const handleSortAlphabetically = () => {
    setFiles(prev => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
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
          // Pass the user input range
          archive = await splitPDF(files[0].file, splitRange); 
          name = `${files[0].name.replace('.pdf', '')}_split.zip`;
          break;
        case 'COMPRESS':
          data = await compressPDF(files[0].file, compressionLevel);
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
    } catch (error: any) {
      console.error("Processing error", error);
      alert(error.message || "An error occurred while processing your files.");
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
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg shadow-slate-900/20 group-hover:scale-105 transition-all">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
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
                Simple tools for your documents.
              </h2>
              <p className="text-lg text-slate-500">
                Manage your PDF files securely in your browser. No sign-up required.
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col md:flex-row">
              
              {/* Left Side: Upload & File List */}
              <div className="flex-1 p-6 md:p-8 flex flex-col border-r border-slate-100">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                     <span className={`p-2 rounded-lg ${activeTool.color} bg-opacity-10 text-opacity-100 ${activeTool.color.replace('bg-', 'text-')}`}>
                        {activeTool.icon}
                     </span>
                     {activeTool.title}
                  </h2>
                  <p className="text-slate-500 mt-2">{activeTool.description}</p>
                </div>

                {!result ? (
                   <>
                     {/* Upload Area */}
                     {(files.length === 0 || activeTool.multiple) && (
                        <div 
                           className={`
                              relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 mb-6
                              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50/30'}
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
                           <div className="flex flex-col items-center gap-2 pointer-events-none">
                              <Upload className="w-6 h-6 text-slate-400" />
                              <span className="text-sm font-medium text-slate-600">
                                 {files.length > 0 ? "Add more" : "Click to upload or drag files"}
                              </span>
                           </div>
                        </div>
                     )}

                     {/* File List */}
                     {files.length > 0 && (
                        <div className="flex-1 overflow-hidden">
                           <FileList 
                              files={files} 
                              onRemove={removeFile}
                              onMove={moveFile}
                              onReorder={activeTool.id === 'MERGE' ? handleReorder : undefined}
                              onSort={activeTool.id === 'MERGE' ? handleSortAlphabetically : undefined}
                           />
                        </div>
                     )}
                   </>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-12 text-center animate-in fade-in zoom-in-95">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">Success!</h3>
                      <p className="text-slate-500 mb-6 text-sm">Your file is ready.</p>
                      
                      <div className="flex gap-3">
                         <Button variant="secondary" onClick={() => { setResult(null); setFiles([]); }}>
                            Back
                         </Button>
                         <a 
                            href={result.url} 
                            download={result.name}
                            className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium text-sm"
                         >
                            <Download className="w-4 h-4" />
                            Download
                         </a>
                      </div>
                  </div>
                )}
              </div>

              {/* Right Side: Options Panel (Only show if files present and not finished) */}
              {!result && files.length > 0 && (activeTool.id === 'SPLIT' || activeTool.id === 'COMPRESS' || activeTool.id === 'MERGE' || activeTool.id === 'JPG_TO_PDF') && (
                 <div className="w-full md:w-80 bg-slate-50 p-6 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col">
                    <div className="flex items-center gap-2 mb-6 text-slate-800 font-semibold">
                       <Settings className="w-4 h-4" />
                       Configuration
                    </div>
                    
                    <div className="space-y-6 flex-1">
                       
                       {/* Options for SPLIT */}
                       {activeTool.id === 'SPLIT' && (
                          <div>
                             <label className="block text-sm font-medium text-slate-700 mb-2">
                                Pages to Extract
                             </label>
                             <input 
                                type="text"
                                value={splitRange}
                                onChange={(e) => setSplitRange(e.target.value)}
                                placeholder="e.g. 1, 3-5, 8"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                             />
                             <p className="text-xs text-slate-500 mt-2">
                                Leave empty to extract all pages into separate files.
                             </p>
                          </div>
                       )}

                       {/* Options for COMPRESS */}
                       {activeTool.id === 'COMPRESS' && (
                          <div>
                             <label className="block text-sm font-medium text-slate-700 mb-2">
                                Compression Level
                             </label>
                             <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                                   <input 
                                      type="radio" 
                                      name="compression" 
                                      checked={compressionLevel === 0.8}
                                      onChange={() => setCompressionLevel(0.8)}
                                      className="text-blue-600"
                                   />
                                   <div>
                                      <div className="text-sm font-medium text-slate-900">Low Compression</div>
                                      <div className="text-xs text-slate-500">High Quality</div>
                                   </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                                   <input 
                                      type="radio" 
                                      name="compression" 
                                      checked={compressionLevel === 0.5}
                                      onChange={() => setCompressionLevel(0.5)}
                                      className="text-blue-600"
                                   />
                                   <div>
                                      <div className="text-sm font-medium text-slate-900">Recommended</div>
                                      <div className="text-xs text-slate-500">Good Quality</div>
                                   </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                                   <input 
                                      type="radio" 
                                      name="compression" 
                                      checked={compressionLevel === 0.2}
                                      onChange={() => setCompressionLevel(0.2)}
                                      className="text-blue-600"
                                   />
                                   <div>
                                      <div className="text-sm font-medium text-slate-900">Extreme Compression</div>
                                      <div className="text-xs text-slate-500">Low Quality</div>
                                   </div>
                                </label>
                             </div>
                          </div>
                       )}

                       {/* Generic Summary */}
                       <div className="pt-6 border-t border-slate-200">
                          <div className="flex justify-between text-sm text-slate-600 mb-2">
                             <span>Total Files:</span>
                             <span className="font-medium">{files.length}</span>
                          </div>
                       </div>
                    </div>

                    <Button 
                        onClick={handleProcess}
                        isLoading={isProcessing}
                        className="w-full mt-6 !py-3 !text-base shadow-none bg-slate-900 hover:bg-slate-800"
                     >
                        {activeTool.title}
                     </Button>
                 </div>
              )}

              {/* Mobile/Full width Action Button if no options panel */}
              {!result && files.length > 0 && !(activeTool.id === 'SPLIT' || activeTool.id === 'COMPRESS' || activeTool.id === 'MERGE' || activeTool.id === 'JPG_TO_PDF') && (
                  <div className="p-6 border-t border-slate-100 md:hidden">
                     <Button 
                        onClick={handleProcess}
                        isLoading={isProcessing}
                        className="w-full !py-3 !text-base shadow-none bg-slate-900 hover:bg-slate-800"
                     >
                        {activeTool.title}
                     </Button>
                  </div>
              )}

            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;