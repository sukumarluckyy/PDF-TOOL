import React from 'react';
import { PDFFile } from '../types';
import { FileText, X, GripVertical, Eye, Trash2 } from 'lucide-react';

interface FileListProps {
  files: PDFFile[];
  onRemove: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

export const FileList: React.FC<FileListProps> = ({ files, onRemove, onMove }) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <div className="p-4 mb-4 bg-blue-50 rounded-full">
          <FileText className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No PDFs uploaded yet</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-xs">
          Upload documents to start merging or editing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file, index) => (
        <div 
          key={file.id}
          className="group relative flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-200"
        >
          {/* Drag Handle Placeholder */}
          <div className="flex flex-col gap-1 text-slate-300">
             <button 
                onClick={() => onMove(file.id, 'up')}
                disabled={index === 0}
                className="hover:text-blue-500 disabled:opacity-0 transition-colors"
                title="Move Up"
             >
                ▲
             </button>
             <button 
                onClick={() => onMove(file.id, 'down')}
                disabled={index === files.length - 1}
                className="hover:text-blue-500 disabled:opacity-0 transition-colors"
                title="Move Down"
             >
                ▼
             </button>
          </div>

          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-red-50 rounded-lg">
            <FileText className="w-6 h-6 text-red-500" />
          </div>

          <div className="flex-grow min-w-0">
            <h4 className="font-medium text-slate-900 truncate" title={file.name}>
              {file.name}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              <span>•</span>
              <span>{file.pageCount || '?'} Pages</span>
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onRemove(file.id)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};