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
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

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
      <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border-none dark:border border-transparent dark:border-[#8AC43C]/20 text-center py-12 sm:py-24 px-4 animate-fadeIn">
        <div className="bg-gray-100 dark:bg-gray-700 p-5 sm:p-8 rounded-2xl sm:rounded-3xl inline-block mb-4 sm:mb-6">
          <EmptyRecordsIcon className="h-20 w-20 sm:h-32 sm:w-32 text-gray-600 dark:text-gray-400" />
        </div>
        <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">No Records Found</h3>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-md mx-auto">Upload your first medical record to get started with AI-powered health insights.</p>
      </div>
    );
  }

  const handleRemoveClick = async (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      setDeletingRecordId(recordId);
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        // Await the removal from parent to ensure state updates before we reset local state
        await onRemoveRecord(recordId);
      } catch (error) {
        console.error("Error removing record", error);
        // Only reset if error, otherwise component unmounts
        setDeletingRecordId(null);
      }
      // Note: We don't strictly need to setDeletingRecordId(null) on success 
      // because the record will be removed from the 'records' prop, causing unmount.
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'lab report': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'prescription': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'medical image': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8 animate-fade-in max-w-[1440px] mx-auto pt-0 px-1 sm:px-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#222222] dark:text-white tracking-tight">
            Medical Records
          </h1>
          <p className="text-xs sm:text-sm text-[#717171] dark:text-[#a0a0a0] font-medium mt-0.5 sm:mt-1">View and manage your health documentation</p>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-6">
        {records.map((record, index) => {
          const isExpanded = expandedRecords.has(record.id);
          return (
            <div key={record.id} className={`bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md rounded-xl sm:rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition-all duration-300 group border border-transparent dark:border-[#8AC43C]/20 ${deletingRecordId === record.id ? 'animate-trash-out' : ''}`} style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-start gap-2.5 sm:gap-4 p-3 sm:p-5">
                <div className="bg-gray-100 dark:bg-gray-800 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-transform duration-300 group-hover:scale-105 flex-shrink-0">
                  <DocumentIcon className="h-4 w-4 sm:h-6 sm:w-6 text-[#222222] dark:text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-row justify-between items-start mb-1.5 sm:mb-2 gap-3 sm:gap-2">
                    <div className="flex-1 min-w-0 pr-3 sm:pr-2">
                      <div className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1.5 sm:mb-2 mr-2 ${getCategoryColor(record.category).replace('border', 'border-none')}`}>
                        <TagIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5" />
                        {record.category}
                      </div>
                      <h3 className="text-sm sm:text-lg font-bold text-[#222222] dark:text-white mb-0.5 truncate">{record.type}</h3>
                      <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">{new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 pt-1">
                      {record.fileUrl && (
                        <a
                          href={record.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2.5 rounded-full bg-gray-50 dark:bg-gray-800/80 text-[#222222] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                          aria-label={`Preview record from ${new Date(record.date).toLocaleDateString()}`}
                        >
                          <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleRemoveClick(record.id)}
                        disabled={deletingRecordId === record.id}
                        className={`p-1.5 sm:p-2.5 rounded-full transition-all duration-200 ${deletingRecordId === record.id ? 'opacity-100 bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-red-50/50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                        aria-label={`Remove record from ${new Date(record.date).toLocaleDateString()}`}
                      >
                        <TrashIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${deletingRecordId === record.id ? 'animate-wiggle' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-gray-50 dark:border-gray-800/50">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-semibold text-gray-900 dark:text-white">Doctor:</span> {record.doctor}
                      </p>
                      <button
                        onClick={() => toggleRecord(record.id)}
                        className="text-[10px] sm:text-xs font-bold text-[#8AC43C] hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider"
                      >
                        {isExpanded ? (
                          <>
                            <span>Less</span>
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>Details</span>
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
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
