/* eslint-disable no-restricted-syntax */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

export const COPILOTKIT_RUNTIME_URL: string =
  (import.meta.env.VITE_COPILOTKIT_URL as string | undefined) ?? `${API_BASE_URL}/pragna`;


export const LOG_LEVEL: string =
  (import.meta.env.VITE_LOG_LEVEL as string | undefined) ?? 'info';

export const APP_NAME: string =
  (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'Pragna';

export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0';

export const FEATURE_FLOW_BUILDER: boolean =
  (import.meta.env.VITE_FEATURE_FLOW_BUILDER as string | undefined) !== 'false';
