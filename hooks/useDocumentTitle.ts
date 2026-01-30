import { useEffect } from 'react';

/**
 * Custom hook to update the document title dynamically.
 * 
 * @param title The title to set for the current view.
 * @param includeAppName Whether to append "| BeanHealth" to the title. Defaults to true.
 */
export const useDocumentTitle = (title: string, includeAppName = true) => {
    useEffect(() => {
        const fullTitle = includeAppName ? `${title} | BeanHealth` : title;
        document.title = fullTitle;
    }, [title, includeAppName]);
};
