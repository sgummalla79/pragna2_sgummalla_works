/* eslint-disable no-restricted-syntax */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

// Base path for the AG-UI native chat surface (GET /pragna/agents,
// POST /pragna/agents/{name}). Use a relative path in dev so requests go
// through the Vite proxy (avoids CORS). In production set
// VITE_PRAGNA_BASE_URL to the full backend URL.
export const PRAGNA_BASE_URL: string =
  (import.meta.env.VITE_PRAGNA_BASE_URL as string | undefined) ?? '/pragna';


export const LOG_LEVEL: string =
  (import.meta.env.VITE_LOG_LEVEL as string | undefined) ?? 'info';

export const APP_NAME: string =
  (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'Pragna';

export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0';

export const FEATURE_FLOW_BUILDER: boolean =
  (import.meta.env.VITE_FEATURE_FLOW_BUILDER as string | undefined) !== 'false';
