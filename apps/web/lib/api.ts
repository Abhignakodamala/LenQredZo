// Central API base URL. Uses the env var in production, falls back to localhost in dev.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  