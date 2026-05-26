/**
 * storageUpload.ts
 *
 * Uploads files to Cloudinary using the REST API via native fetch.
 * This approach is fully native — works reliably in Expo Go and production builds.
 */
import * as FileSystem from 'expo-file-system/legacy';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dvv9qjg43';
const CLOUDINARY_UPLOAD_PRESET = 'pickpack_images'; // Must be created as "Unsigned" preset
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Uploads a local file URI to Cloudinary via REST API.
 * Returns the public download URL.
 */
export async function uploadFileToStorage(
  localUri: string,
  storagePath: string,
  contentType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  console.log('🚀 Starting upload to Cloudinary:', { storagePath, contentType });

  try {
    // Read file as base64
    const fileData = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create FormData with all required fields
    const formData = new FormData();
    formData.append('file', `data:${contentType};base64,${fileData}`);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('public_id', storagePath.replace(/\//g, '_').replace(/\.[^.]+$/, ''));

    console.log('📤 Sending request to Cloudinary...');

    const response = await fetch(CLOUDINARY_API_URL, {
      method: 'POST',
      body: formData,
    });

    console.log('📡 Upload response:', { status: response.status });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = errorData?.error?.message || `Upload failed (${response.status})`;
      console.error('❌ Upload error:', errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json() as { secure_url?: string; url?: string };
    const downloadUrl = data.secure_url || data.url;

    if (!downloadUrl) {
      throw new Error('No URL returned from Cloudinary');
    }

    console.log('✅ Upload successful, download URL:', downloadUrl);
    return downloadUrl;
  } catch (error: any) {
    console.error('❌ Cloudinary upload error:', error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }
}
