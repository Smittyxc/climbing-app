function required(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export const FIREBASE_CONFIG = {
  apiKey: required('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: required('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
