import axios from 'axios';

const baseURL = import.meta.env.VITE_AUTH_API_BASE;
const apiKey = import.meta.env.VITE_API_KEY;

// Lean axios client for the External Supplier Bid page. It sends credentials
// (withCredentials) so it still works if the browser happens to hold a login
// cookie during this testing phase, but unlike supplierInstance.ts it has NO
// refresh-token / session-expired interceptor: an external visitor won't
// normally have a session at all, and supplierInstance's existing 401
// handling would incorrectly bounce them toward the internal login page
// instead of showing this page's own error state.
const externalSupplierInstance = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
  },
  withCredentials: true,
});

export default externalSupplierInstance;
