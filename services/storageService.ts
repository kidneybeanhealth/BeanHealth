import { supabase } from '../lib/supabase'

// Optimized upload function with retry logic
export const uploadFileToSupabaseSimple = async (
  file: File, 
  bucket: string = 'medical-records',
  onProgress?: (progress: number) => void
): Promise<string> => {
    // Generate unique file name
    const fileExt = file.name.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    console.log('[Storage] Starting upload:', fileName, 'Size:', file.size);
    
    let retries = 3;
    let lastError: Error | null = null;
    
    while (retries > 0) {
        try {
            // Upload the file directly with timeout
            const uploadPromise = supabase.storage
                .from(bucket)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            // Add timeout (30 seconds)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Upload timeout after 30s')), 30000);
            });
            
            const { data: uploadData, error: uploadError } = await Promise.race([
                uploadPromise,
                timeoutPromise
            ]) as any;

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            console.log('[Storage] Upload successful:', uploadData.path);
            
            // Get the public URL
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(uploadData.path);

            if (!urlData.publicUrl) {
                throw new Error('Failed to get public URL for uploaded file');
            }

            console.log('[Storage] Public URL generated:', urlData.publicUrl);
            return urlData.publicUrl;
            
        } catch (error) {
            lastError = error as Error;
            retries--;
            
            if (retries > 0) {
                console.warn(`[Storage] Upload failed, retrying... (${retries} attempts left)`, lastError.message);
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            } else {
                console.error('[Storage] Upload failed after all retries:', lastError);
                throw new Error(`Upload failed after 3 attempts: ${lastError.message}`);
            }
        }
    }
    
    throw lastError || new Error('Upload failed');
};

export const uploadFileToSupabase = async (file: File, bucket: string = 'medical-records'): Promise<string> => {
    // Check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
        throw new Error(`Failed to access storage: ${bucketsError.message}`);
    }

    const bucketExists = buckets?.some(b => b.name === bucket);
    
    if (!bucketExists) {
        // Try direct bucket access as fallback
        try {
            const { error: testError } = await supabase.storage
                .from(bucket)
                .list('', { limit: 1 });
            
            if (testError) {
                throw new Error(`Storage bucket '${bucket}' does not exist or is not accessible. Please verify it exists in your Supabase dashboard.`);
            }
        } catch (directAccessError) {
            throw new Error(`Storage bucket '${bucket}' does not exist. Please create it in your Supabase dashboard.`);
        }
    }

    // Generate unique file name
    const fileExt = file.name.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload the file
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadData.path);

    if (!urlData.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file');
    }

    return urlData.publicUrl;
}

// Function to check if the medical-records bucket exists
export const checkMedicalRecordsBucket = async (): Promise<{ exists: boolean; message: string }> => {
    const bucketName = 'medical-records';
    
    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) {
            return {
                exists: false,
                message: `Failed to list buckets: ${listError.message}`
            };
        }

        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
        
        if (bucketExists) {
            return {
                exists: true,
                message: 'medical-records bucket found and ready to use'
            };
        } else {
            return {
                exists: false,
                message: 'medical-records bucket not found. Please create it manually in your Supabase dashboard under Storage > Buckets.'
            };
        }
    } catch (error) {
        return {
            exists: false,
            message: `Error checking bucket: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
};

// Legacy function name for backward compatibility
export const createMedicalRecordsBucket = checkMedicalRecordsBucket;

// Function to delete a file from Supabase storage
export const deleteFileFromSupabase = async (fileUrl: string, bucket: string = 'medical-records'): Promise<boolean> => {
    try {
        // Extract the file path from the URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
        const urlParts = fileUrl.split('/');
        const bucketIndex = urlParts.findIndex(part => part === bucket);
        
        if (bucketIndex === -1 || bucketIndex >= urlParts.length - 1) {
            return false;
        }
        
        // Get the path after the bucket name
        const filePath = urlParts.slice(bucketIndex + 1).join('/');
        
        const { error } = await supabase.storage
            .from(bucket)
            .remove([filePath]);
        
        if (error) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
};

// Function to test storage connectivity
export const testStorageConnection = async (): Promise<boolean> => {
    try {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) {
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
};

// Function to test direct bucket access
export const testBucketAccess = async (bucketName: string = 'medical-records'): Promise<{ accessible: boolean; message: string }> => {
    try {
        // Try to list files in the bucket
        const { data, error } = await supabase.storage
            .from(bucketName)
            .list('', { limit: 1 });
        
        if (error) {
            return {
                accessible: false,
                message: `Cannot access bucket: ${error.message}`
            };
        }
        
        return {
            accessible: true,
            message: 'Bucket is accessible and ready for uploads'
        };
    } catch (error) {
        return {
            accessible: false,
            message: `Bucket access test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
};

export const uploadFileToGCS = uploadFileToSupabase;

// Chat file upload functions
export const uploadChatFile = async (
    file: File, 
    senderId: string, 
    recipientId: string, 
    fileType: 'pdf' | 'image' | 'audio'
): Promise<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}> => {
    try {
        // Generate organized file path
        const fileExt = file.name.split('.').pop() || 'bin';
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2);
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}-${randomId}-${sanitizedFileName}`;
        
        // Organize files in folders by type and participants
        const conversationId = [senderId, recipientId].sort().join('-');
        const filePath = `chat-files/${conversationId}/${fileType}/${fileName}`;

        // Upload to chat-files bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Chat file upload failed: ${uploadError.message}`);
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
            .from('chat-files')
            .getPublicUrl(uploadData.path);

        if (!urlData.publicUrl) {
            throw new Error('Failed to get public URL for uploaded chat file');
        }

        return {
            fileUrl: urlData.publicUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type
        };
    } catch (error) {
        console.error('Chat file upload error:', error);
        throw error;
    }
};

// Convert audio blob to file and upload
export const uploadAudioRecording = async (
    audioBlob: Blob, 
    senderId: string, 
    recipientId: string, 
    duration: number
): Promise<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}> => {
    try {
        // Create a file from the blob
        const timestamp = Date.now();
        const fileName = `voice-message-${timestamp}.webm`;
        const audioFile = new File([audioBlob], fileName, { 
            type: 'audio/webm;codecs=opus' 
        });

        return await uploadChatFile(audioFile, senderId, recipientId, 'audio');
    } catch (error) {
        console.error('Audio recording upload error:', error);
        throw error;
    }
};

// Delete chat file
export const deleteChatFile = async (fileUrl: string): Promise<boolean> => {
    try {
        // Extract file path from URL
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.findIndex(part => part === 'chat-files');
        
        if (bucketIndex === -1) {
            throw new Error('Invalid chat file URL');
        }
        
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        
        const { error } = await supabase.storage
            .from('chat-files')
            .remove([filePath]);
            
        if (error) {
            console.error('File deletion error:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Chat file deletion error:', error);
        return false;
    }
};

// Get file info from URL
export const getChatFileInfo = async (fileUrl: string): Promise<{
    size: number;
    lastModified: string;
    mimeType: string;
} | null> => {
    try {
        // Extract file path from URL
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.findIndex(part => part === 'chat-files');
        
        if (bucketIndex === -1) {
            return null;
        }
        
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        
        const { data, error } = await supabase.storage
            .from('chat-files')
            .list(filePath.split('/').slice(0, -1).join('/'), {
                search: filePath.split('/').pop()
            });
            
        if (error || !data || data.length === 0) {
            return null;
        }
        
        const fileInfo = data[0];
        return {
            size: fileInfo.metadata?.size || 0,
            lastModified: fileInfo.updated_at || fileInfo.created_at || '',
            mimeType: fileInfo.metadata?.mimetype || 'application/octet-stream'
        };
    } catch (error) {
        console.error('Get chat file info error:', error);
        return null;
    }
};

// Upload prescription PDF to storage
export const uploadPrescriptionPDF = async (
    pdfBlob: Blob,
    prescriptionId: string,
    doctorId: string,
    patientId: string
): Promise<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}> => {
    try {
        const timestamp = Date.now();
        const fileName = `Prescription_${prescriptionId}_${timestamp}.pdf`;
        
        // Organize in folders by conversation
        const conversationId = [doctorId, patientId].sort().join('-');
        const filePath = `chat-files/${conversationId}/pdf/${fileName}`;

        // Create file from blob
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        // Upload to chat-files bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'application/pdf'
            });

        if (uploadError) {
            throw new Error(`Prescription PDF upload failed: ${uploadError.message}`);
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
            .from('chat-files')
            .getPublicUrl(uploadData.path);

        if (!urlData.publicUrl) {
            throw new Error('Failed to get public URL for prescription PDF');
        }

        return {
            fileUrl: urlData.publicUrl,
            fileName: fileName,
            fileSize: pdfBlob.size,
            mimeType: 'application/pdf'
        };
    } catch (error) {
        console.error('Prescription PDF upload error:', error);
        throw error;
    }
};