import React, { useState } from 'react';
import { MedicalRecord } from '../types';
import { DocumentIcon } from './icons/DocumentIcon';
import { EmptyRecordsIcon } from './icons/EmptyRecordsIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EyeIcon } from './icons/EyeIcon';
import { TagIcon } from './icons/TagIcon';
import RichSummaryDisplay from './RichSummaryDisplay';

interface RecordsProps {
  records: MedicalRecord[];
  onRemoveRecord: (recordId: string) => void;
}

const Records: React.FC<RecordsProps> = ({ records, onRemoveRecord }) => {
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  const toggleRecord = (recordId: string) => {
    setExpandedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };
  if (records.length === 0) {
    return (
      <div className="card text-center py-20 animate-fadeIn">
        <div className="bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-rose-900/30 dark:to-indigo-900/30 p-8 rounded-3xl inline-block mb-6">
          <EmptyRecordsIcon className="h-32 w-32 text-rose-900 dark:text-rose-400" />
        </div>
        <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-rose-900 bg-clip-text text-transparent">No Records Found</h3>
        <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-md mx-auto">Upload your first medical record to get started with AI-powered health insights.</p>
      </div>
    );
  }

  const handleRemoveClick = (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      onRemoveRecord(recordId);
    }
  };

  const getCategoryColor = (category: string) => {
    switch(category.toLowerCase()) {
        case 'lab report': return 'bg-blue-500 text-white shadow-lg';
        case 'prescription': return 'bg-purple-500 text-white shadow-lg';
        case 'medical image': return 'bg-amber-500 text-white shadow-lg';
        default: return 'bg-slate-500 text-white shadow-lg';
    }
  }

  return (
    <div className="animate-fadeIn">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 lg:mb-6">Your Medical Records</h2>
      <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
        {records.map((record, index) => {
          const isExpanded = expandedRecords.has(record.id);
          return (
            <div key={record.id} className="card group hover-lift animate-slideUp" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-start space-x-2.5 sm:space-x-3 lg:space-x-4 p-3 sm:p-4 lg:p-6">
                <div className="bg-rose-700 p-2 sm:p-2.5 lg:p-4 rounded-lg sm:rounded-xl lg:rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 flex-shrink-0">
                  <DocumentIcon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-2 gap-1.5 sm:gap-2">
                    <div className="flex-1 min-w-0">
                      <div className={`inline-flex items-center px-2 sm:px-2.5 lg:px-3 py-0.5 sm:py-1 lg:py-1.5 rounded-md sm:rounded-lg lg:rounded-xl text-xs font-bold ${getCategoryColor(record.category)} mb-1.5 sm:mb-2`}>
                        <TagIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5 mr-1"/>
                        {record.category}
                      </div>
                      <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800 dark:text-gray-100 mb-0.5 sm:mb-1 truncate">{record.type}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">{new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center space-x-1.5 sm:space-x-2 transition-all duration-200 opacity-100 sm:opacity-0 sm:translate-x-4 group-hover:sm:opacity-100 group-hover:sm:translate-x-0 flex-shrink-0">
                      {record.fileUrl && (
                        <a 
                          href={record.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 lg:p-3 rounded-md sm:rounded-lg lg:rounded-xl bg-rose-700 text-white hover:bg-rose-800 hover:shadow-lg hover:scale-110 transition-all duration-200"
                          aria-label={`Preview record from ${new Date(record.date).toLocaleDateString()}`}
                        >
                          <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                        </a>
                      )}
                      <button 
                        onClick={() => handleRemoveClick(record.id)}
                        className="p-1.5 sm:p-2 lg:p-3 rounded-md sm:rounded-lg lg:rounded-xl bg-rose-600 text-white hover:bg-rose-700 hover:shadow-lg hover:scale-110 transition-all duration-200"
                        aria-label={`Remove record from ${new Date(record.date).toLocaleDateString()}`}
                      >
                        <TrashIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">Doctor:</span> {record.doctor}
                      </p>
                      <button
                        onClick={() => toggleRecord(record.id)}
                        className="text-xs sm:text-sm font-semibold text-rose-900 dark:text-rose-400 hover:text-rose-900 dark:hover:text-sky-300 transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <>
                            <span>Show Less</span>
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>Show Details</span>
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 sm:mt-3 animate-fade-in">
                        <RichSummaryDisplay summary={record.summary} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Records;