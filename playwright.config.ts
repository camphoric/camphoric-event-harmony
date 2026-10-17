import { defineEventE2EConfig } from '@camphoric/camphoric-event-import-tools/e2e';

// The registration form's end-to-end tests (e2e/), against a throwaway
// Camphoric with this event imported: see README.md
export default defineEventE2EConfig({ globalSetup: './e2e/global-setup.ts' });
