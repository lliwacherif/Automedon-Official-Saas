import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/image';

export function useFileUpload() {
    const uploading = ref(false);
    const uploadError = ref<string | null>(null);

    /**
     * Upload a file to Supabase Storage
     * @param file - The file to upload
     * @param bucket - The storage bucket name (default: 'car-images')
     * @param folder - Optional folder path within the bucket
     * @returns The public URL of the uploaded file, or null if upload failed
     */
    async function uploadFile(
        file: File,
        bucket: string = 'car-images',
        folder: string = ''
    ): Promise<string | null> {
        uploading.value = true;
        uploadError.value = null;

        try {
            // Compress if image (except SVGs)
            let fileToUpload = file;
            if (file.type.startsWith('image/') && !file.type.includes('svg')) {
                try {
                    fileToUpload = await compressImage(file);
                } catch (compressErr) {
                    console.warn('Image compression failed, proceeding with original file:', compressErr);
                }
            }

            // Generate unique filename
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = folder ? `${folder}/${fileName}` : fileName;

            // Upload file to Supabase Storage
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(filePath, fileToUpload, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Supabase Storage Upload Error (Detail):', JSON.stringify(error, null, 2));

                // Handle HTML error responses (often Nginx/Proxy errors due to size)
                let errorMsg = error.message || 'Unknown error';
                if (errorMsg.includes('<!DOCTYPE html>') || errorMsg.includes('<html')) {
                    errorMsg = 'Server error. The file might be too large or the server is temporarily unavailable.';
                }

                alert('Upload Error: ' + errorMsg);
                throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (e: any) {
            let message = e.message;
            if (message && (message.includes('<!DOCTYPE html>') || message.includes('<html'))) {
                message = 'Server connection error (possible file size limit exceeded).';
            }
            uploadError.value = message;
            console.error('Error uploading file:', e);

            // Re-throw if it wasn't the explicit throw above (to propagate to caller)
            if (!message.startsWith('Server error') && !message.startsWith('Upload Error')) {
                // It's already been alerted if it was a supabase error
            }

            return null;
        } finally {
            uploading.value = false;
        }
    }

    /**
     * Delete a file from Supabase Storage
     * @param url - The public URL of the file to delete
     * @param bucket - The storage bucket name (default: 'car-images')
     */
    async function deleteFile(url: string, bucket: string = 'car-images'): Promise<boolean> {
        try {
            // Extract file path from URL
            const urlParts = url.split(`/storage/v1/object/public/${bucket}/`);
            if (urlParts.length < 2) {
                throw new Error('Invalid file URL');
            }
            const filePath = urlParts[1];

            const { error } = await supabase.storage
                .from(bucket)
                .remove([filePath]);

            if (error) throw error;

            return true;
        } catch (e: any) {
            uploadError.value = e.message;
            console.error('Error deleting file:', e);
            return false;
        }
    }

    return {
        uploading,
        uploadError,
        uploadFile,
        deleteFile
    };
}
