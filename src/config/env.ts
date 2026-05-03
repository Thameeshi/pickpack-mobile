// Environment configuration — reads from .env via expo-constants
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

export const ENV = {
  FIREBASE: {
    API_KEY: extra.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    AUTH_DOMAIN: extra.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    PROJECT_ID: extra.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    STORAGE_BUCKET: extra.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    MESSAGING_SENDER_ID: extra.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    APP_ID: extra.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  },
  GOOGLE_MAPS_API_KEY: extra.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
};
