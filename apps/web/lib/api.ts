// Central API base URL.
// In browser runtime, if no explicit external API URL is set:
// - on localhost:3000, routes to http://localhost:5000
// - on production VPS (behind Nginx reverse proxy), returns empty string '' so fetch(`${API_URL}/api/...`) calls relative /api/...
export const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== '') {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    return ''; // Relative path handled by Nginx proxy
  }
  return process.env.INTERNAL_API_URL || 'http://localhost:5000';
};

export const API_URL = getApiUrl();
