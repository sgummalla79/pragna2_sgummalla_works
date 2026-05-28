/** Shared env defaults for the e2e stack. Overridable via shell env so
 *  CI can point at a different BE / FE / DB if the standard ports are
 *  taken. */
export const FE_URL = process.env.E2E_FE_URL ?? 'http://localhost:5173';
export const BE_URL = process.env.E2E_BE_URL ?? 'http://localhost:8000';
export const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'pragna-vfe-browser';
export const TEST_DB = 'pragna_it';
export const TEST_USER = {
  email: 'verify@example.com',
  name: 'Verify',
  password: 'VerifyTest123!',
};
