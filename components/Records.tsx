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
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/60 dark:border-gray-700/60 text-center py-20 animate-fadeIn">
        <div className="bg-gray-100 dark:bg-gray-700 p-8 rounded-3xl inline-block mb-6">
          <EmptyRecordsIcon className="h-32 w-32 text-gray-600 dark:text-gray-400" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">No Records Found</h3>
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
        case 'lab report': return 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-400 border-secondary-200 dark:border-secondary-800';
        case 'prescription': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
        case 'medical image': return 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-400 border-secondary-200 dark:border-secondary-800';
        default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  }

  return (
    <div className="animate-fadeIn space-y-8 max-w-[1400px] mx-auto">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">Medical Records</h2>
      <div className="space-y-4">
        {records.map((record, index) => {
          const isExpanded = expandedRecords.has(record.id);
          return (
            <div key={record.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 group" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-start gap-5 p-6 lg:p-8">
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                  <DocumentIcon className="h-7 w-7 lg:h-8 lg:w-8 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium border mb-3 ${getCategoryColor(record.category)}`}>
                        <TagIcon className="h-3.5 w-3.5 mr-1.5"/>
                        {record.category}
                      </div>
                      <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-1 truncate">{record.type}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                      {record.fileUrl && (
                        <a
                          href={record.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                          aria-label={`Preview record from ${new Date(record.date).toLocaleDateString()}`}
                        >
                          <EyeIcon className="h-5 w-5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleRemoveClick(record.id)}
                        className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200"
                        aria-label={`Remove record from ${new Date(record.date).toLocaleDateString()}`}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-medium text-gray-700 dark:text-gray-200">Doctor:</span> {record.doctor}
                      </p>
                      <button
                        onClick={() => toggleRecord(record.id)}
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-2"
                      >
                        {isExpanded ? (
                          <>
                            <span>Show Less</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>Show Details</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
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

