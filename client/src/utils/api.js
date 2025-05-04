/**
 * Utility functions for API calls
 */

/**
 * Get default fetch options for API requests
 * @returns {Object} Default fetch options
 */
export const getDefaultFetchOptions = () => {
  return {
    credentials: 'include', // Include cookies for cross-origin requests
  };
};

/**
 * Build a complete API URL
 * In development mode, we use the proxy configured in vite.config.js
 * In production mode, we use relative URLs
 * 
 * @param {string} endpoint - The API endpoint (should start with '/')
 * @returns {string} The complete API URL
 */
export const buildApiUrl = (endpoint) => {
  // Always use relative URLs - in dev mode Vite will proxy to the correct server
  return endpoint;
};