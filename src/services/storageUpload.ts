/**
 * storageUpload.ts
 *
 * Uploads files to Firebase Storage using the REST API + FileSystem.uploadAsync.
 * This approach is fully native — no Blob, no FileReader, no Firebase Storage SDK —
 * and works reliably in Expo Go (New Architecture) and production builds.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import { auth } from './firebase';

// Your Firebase Storage bucket (from .env)
const BUCKET = 'pickpack-a981b.firebasestorage.app';

/**
 * Uploads a local file URI to Firebase Storage via REST API.
 * Returns the public download URL.
 */
export async function uploadFileToStorage(
  localUri: string,
  storagePath: string,
  contentType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const idToken = await currentUser.getIdToken();

  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o` +
    `?name=${encodeURIComponent(storagePath)}`;

  const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': contentType,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Storage upload failed (${result.status}): ${result.body}`);
  }

  const data = JSON.parse(result.body) as { downloadTokens?: string; name: string };
  const encodedPath = encodeURIComponent(storagePath);

  if (data.downloadTokens) {
    return (
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
      `${encodedPath}?alt=media&token=${data.downloadTokens}`
    );
  }

  // Fallback: get token via separate request
  const metaRes = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  const meta = await metaRes.json() as { downloadTokens?: string };
  return (
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
    `${encodedPath}?alt=media&token=${meta.downloadTokens}`
  );
}
