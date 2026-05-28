import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

/**
 * Cloud Function to update a user's password
 * Only callable from authenticated superadmin users
 */
export const updateUserPassword = functions.https.onRequest(
  async (request, response) => {
    // Enable CORS
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST, PUT');
    response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    try {
      const { uid, email, newPassword } = request.body;

      // Validate inputs
      if (!uid || !email || !newPassword) {
        response.status(400).json({
          error: 'Missing required fields: uid, email, newPassword',
        });
        return;
      }

      if (newPassword.length < 6) {
        response.status(400).json({
          error: 'Password must be at least 6 characters long',
        });
        return;
      }

      // Get the auth token from request header
      const token = request.headers.authorization?.split('Bearer ')[1];
      if (!token) {
        response.status(401).json({
          error: 'Unauthorized: Missing authentication token',
        });
        return;
      }

      // Verify the token and check if user is superadmin
      const decodedToken = await auth.verifyIdToken(token);
      const adminUser = await db.collection('users').doc(decodedToken.uid).get();

      if (!adminUser.exists || adminUser.data()?.role !== 'superadmin') {
        response.status(403).json({
          error: 'Forbidden: Only superadmins can update user passwords',
        });
        return;
      }

      // Update the user's password using Admin SDK
      await auth.updateUser(uid, {
        password: newPassword,
      });

      // Log the password change in Firestore
      await db.collection('users').doc(uid).update({
        passwordUpdatedAt: admin.firestore.Timestamp.now(),
        passwordUpdatedBy: decodedToken.uid,
      });

      // Log to audit trail (optional)
      await db.collection('audit_logs').add({
        action: 'PASSWORD_UPDATED',
        targetUserId: uid,
        targetUserEmail: email,
        performedBy: decodedToken.uid,
        timestamp: admin.firestore.Timestamp.now(),
      });

      response.status(200).json({
        success: true,
        message: `Password updated successfully for ${email}`,
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      response.status(500).json({
        error: error.message || 'Failed to update password',
      });
    }
  }
);
