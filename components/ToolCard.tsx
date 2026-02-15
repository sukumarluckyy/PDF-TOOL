import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ 
  title, 
  description, 
  icon, 
  color,
  onClick 
}) => {
  return (
    <div 
      onClick={onClick}
      className="group tool-card bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-200 transition-all duration-300"
    >
      <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center ${color} bg-opacity-10`}>
        <div className={color.replace('bg-', 'text-')}>
          {icon}
        </div>
      </div>
      
      <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
        {title}
      </h3>
      
      <p className="text-slate-500 text-sm leading-relaxed mb-4">
        {description}
      </p>
      
      <div className="flex items-center text-sm font-medium text-blue-600 opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
        Open Tool <ArrowRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  );
};