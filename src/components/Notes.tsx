import React from 'react';
import { NotesIcon } from './icons/NotesIcon';

interface NotesProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

const Notes: React.FC<NotesProps> = ({ notes, onNotesChange }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm h-full flex flex-col">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
        <NotesIcon className="mr-2 text-gray-500 dark:text-gray-400" />
        Personal Health Notes
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        Use this space to keep track of symptoms, questions for your doctor, or any other health-related thoughts. Your notes are saved automatically.
      </p>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Start typing your notes here..."
        className="w-full flex-1 p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-secondary-600 focus:border-secondary-600 transition-colors resize-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
        aria-label="Personal Health Notes"
      />
    </div>
  );
};

export default Notes;