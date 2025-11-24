import React from 'react';

interface RichSummaryDisplayProps {
  summary: string;
  className?: string;
}

interface ParsedSummary {
  "Current Issue/Reason for Visit"?: string[];
  "Medical History"?: string[];
  "Findings/Results"?: string[];
  "Diagnosis"?: string[];
  "Medications/Treatment"?: string[];
  "Recommendations/Follow-up"?: string[];
  [key: string]: string[] | undefined;
}

const RichSummaryDisplay: React.FC<RichSummaryDisplayProps> = ({ summary, className = '' }) => {
  // Try to parse JSON, fallback to plain text display
  let parsedData: ParsedSummary | null = null;
  let isJSON = false;

  try {
    // Check if the summary is JSON
    const trimmed = summary.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      parsedData = JSON.parse(trimmed);
      isJSON = true;
    }
  } catch (error) {
    // Not valid JSON, will display as plain text
    isJSON = false;
  }

  // If not JSON or empty, display as plain text
  if (!isJSON || !parsedData) {
    return (
      <div className={`prose prose-slate dark:prose-invert max-w-none ${className}`}>
        <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
          {summary}
        </div>
      </div>
    );
  }

  // Map of section keys to their display info
  const sectionConfig: Record<string, { icon: string; title: string; color: string; bgColor: string }> = {
    "Current Issue/Reason for Visit": {
      icon: "🩺",
      title: "Current Issue / Reason for Visit",
      color: "text-rose-700 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-900/20"
    },
    "Medical History": {
      icon: "📋",
      title: "Medical History",
      color: "text-secondary-700 dark:text-secondary-400",
      bgColor: "bg-secondary-50 dark:bg-secondary-900/20"
    },
    "Findings/Results": {
      icon: "🔬",
      title: "Findings & Results",
      color: "text-purple-700 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    "Diagnosis": {
      icon: "⚕️",
      title: "Diagnosis",
      color: "text-secondary-700 dark:text-secondary-400",
      bgColor: "bg-rose-50 dark:bg-secondary-900/20"
    },
    "Medications/Treatment": {
      icon: "💊",
      title: "Medications & Treatment",
      color: "text-green-700 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    "Recommendations/Follow-up": {
      icon: "📌",
      title: "Recommendations & Follow-up",
      color: "text-secondary-700 dark:text-secondary-400",
      bgColor: "bg-secondary-50 dark:bg-secondary-900/20"
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {Object.entries(parsedData).map(([sectionKey, items]) => {
        if (!items || items.length === 0) return null;

        const config = sectionConfig[sectionKey] || {
          icon: "📄",
          title: sectionKey,
          color: "text-gray-700 dark:text-gray-400",
          bgColor: "bg-gray-50 dark:bg-gray-900/20"
        };

        return (
          <div 
            key={sectionKey} 
            className={`rounded-xl p-5 border border-gray-200 dark:border-gray-700 ${config.bgColor} transition-all duration-300 hover:shadow-md`}
          >
            <h4 className={`text-lg font-bold mb-3 flex items-center ${config.color}`}>
              <span className="text-2xl mr-2">{config.icon}</span>
              {config.title}
            </h4>
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li 
                  key={index} 
                  className="flex items-start text-gray-700 dark:text-gray-300 leading-relaxed"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mt-2 mr-3 flex-shrink-0"></span>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default RichSummaryDisplay;

