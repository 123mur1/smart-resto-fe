/**
 * Centralized API configuration
 * 
 * This file provides a single source of truth for API endpoints.
 * It uses environment variables to support different environments:
 * - Development: http://localhost:3003
 * - Production: Your deployed backend URL
 * 
 * To configure:
 * 1. Create a .env.local file in the scr/ directory
 * 2. Add: NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
 * 3. For local development, you can also set it to http://localhost:3003
 */

// Get API base URL from environment variable, fallback to localhost for development
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";

// Common API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    VERIFY_EMAIL: `${API_BASE_URL}/auth/verify-email`,
  },
  // Booking endpoints
  BOOKING: {
    BASE: `${API_BASE_URL}/booking`,
    PAY: (id: string) => `${API_BASE_URL}/booking/${id}/pay`,
    VERIFY: `${API_BASE_URL}/booking/verify`,
  },
  // User endpoints
  USER: {
    BASE: `${API_BASE_URL}/user`,
    BY_ID: (id: string) => `${API_BASE_URL}/user/${id}`,
  },
  // Student endpoints
  STUDENT: {
    BASE: `${API_BASE_URL}/student`,
    TOPUP: `${API_BASE_URL}/student/topup`,
  },
  // Meal endpoints
  MEAL: {
    BASE: `${API_BASE_URL}/meal`,
    BY_ID: (id: string) => `${API_BASE_URL}/meal/${id}`,
  },
  // Payment endpoints
  PAYMENT: {
    BASE: `${API_BASE_URL}/payment`,
  },
  // Transaction endpoints
  TRANSACTION: {
    BASE: `${API_BASE_URL}/transaction`,
  },
  // Metrics endpoints
  METRICS: {
    FINANCE: `${API_BASE_URL}/metrics/finance`,
  },
} as const;

