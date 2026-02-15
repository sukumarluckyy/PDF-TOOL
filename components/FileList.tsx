import React, { useRef, useState } from 'react';
import { PDFFile } from '../types';
import { FileText, Trash2, ArrowDownAZ, GripVertical } from 'lucide-react';

interface FileListProps {
  files: PDFFile[];
  onRemove: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onSort?: () => void;
  onReorder?: (newOrder: PDFFile[]) => void; // New prop for DnD
}

export const FileList: React.FC<FileListProps> = ({ 
  files, 
  onRemove, 
  onMove, 
  onSort,
  onReorder 
}) => {
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Make transparent ghost
    const el = e.currentTarget;
    setTimeout(() => {
        el.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    setDraggedItemIndex(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index || !onReorder) return;

    const newFiles = [...files];
    const draggedItem = newFiles[draggedItemIndex];
    
    // Remove from old index
    newFiles.splice(draggedItemIndex, 1);
    // Insert at new index
    newFiles.splice(index, 0, draggedItem);
    
    onReorder(newFiles);
    setDraggedItemIndex(index);
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <div className="p-4 mb-4 bg-blue-50 rounded-full">
          <FileText className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No files uploaded yet</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-xs">
          Upload documents to start.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
       {/* Toolbar */}
       <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Files ({files.length})
          </h3>
          <div className="flex items-center gap-3">
             {onSort && (
                 <button 
                   onClick={onSort}
                   className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium px-2 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                   title="Sort Alphabetically"
                 >
                   <ArrowDownAZ className="w-3 h-3" />
                   Sort A-Z
                 </button>
             )}
          </div>
       </div>

       {/* List */}
      <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
        {files.map((file, index) => (
          <div 
            key={file.id}
            draggable={!!onReorder}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            className={`
                group relative flex items-center gap-4 p-4 bg-white border rounded-xl shadow-sm transition-all duration-200 
                ${draggedItemIndex === index ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}
                cursor-grab active:cursor-grabbing
            `}
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 text-slate-300 group-hover:text-slate-400">
               <GripVertical className="w-5 h-5" />
            </div>

            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-50 rounded-lg">
              <FileText className="w-5 h-5 text-red-500" />
            </div>

            <div className="flex-grow min-w-0">
              <h4 className="font-medium text-slate-900 truncate text-sm" title={file.name}>
                {file.name}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                {file.pageCount && (
                    <>
                        <span>•</span>
                        <span>{file.pageCount} Pages</span>
                    </>
                )}
              </div>
            </div>

            <button 
              onClick={() => onRemove(file.id)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};