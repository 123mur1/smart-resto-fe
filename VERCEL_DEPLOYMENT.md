# Vercel Deployment Guide - Fixing NOT_FOUND Errors

## Problem: NOT_FOUND Error on Vercel

When deploying your Next.js frontend to Vercel, you may encounter `NOT_FOUND` errors when the application tries to make API calls to your backend.

### Root Cause

The frontend code was hardcoding `API_BASE_URL = "http://localhost:3003"` in multiple files. When deployed to Vercel:

1. **The backend is not running on localhost** - In production, your backend runs on a different server (e.g., `https://your-backend.vercel.app` or a separate hosting service)
2. **localhost doesn't exist in Vercel's environment** - The Vercel deployment environment cannot access `localhost:3003` because it's a different server
3. **All API calls fail** - Every fetch request to `http://localhost:3003` results in a NOT_FOUND error

### What Was Happening

```typescript
// ❌ BEFORE: Hardcoded localhost in every file
const API_BASE_URL = "http://localhost:3003";
const res = await fetch(`${API_BASE_URL}/auth/login`, { ... });
```

When deployed:
- Frontend tries: `http://localhost:3003/auth/login`
- Vercel says: "NOT_FOUND" (localhost doesn't exist in production)

### The Fix

We've implemented a centralized API configuration system that uses environment variables:

1. **Created `src/lib/api-config.ts`** - Single source of truth for all API endpoints
2. **Updated all files** - Replaced hardcoded URLs with the centralized config
3. **Environment variable support** - Uses `NEXT_PUBLIC_API_BASE_URL` for production

## Setup Instructions

### 1. Create Environment Variable File

Create a `.env.local` file in the `scr/` directory:

```bash
# For local development
NEXT_PUBLIC_API_BASE_URL=http://localhost:3003
```

### 2. Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `NEXT_PUBLIC_API_BASE_URL`
   - **Value**: Your production backend URL (e.g., `https://your-backend.vercel.app`)
   - **Environment**: Production, Preview, Development (select all)

### 3. Redeploy

After adding the environment variable, trigger a new deployment:
- Push a new commit, or
- Go to **Deployments** → Click **Redeploy** on the latest deployment

## How It Works

### Centralized Configuration

```typescript
// src/lib/api-config.ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    // ...
  },
  // ...
};
```

### Usage in Components

```typescript
// ✅ AFTER: Using centralized config
import { API_ENDPOINTS } from "@/lib/api-config";

const res = await fetch(API_ENDPOINTS.AUTH.LOGIN, { ... });
```

### Environment Variable Priority

1. **Production (Vercel)**: Uses `NEXT_PUBLIC_API_BASE_URL` from Vercel environment variables
2. **Local Development**: Uses `.env.local` if present, otherwise defaults to `http://localhost:3003`

## Why `NEXT_PUBLIC_` Prefix?

Next.js requires the `NEXT_PUBLIC_` prefix for environment variables that should be accessible in the browser. Without this prefix, the variable is only available on the server side.

## Testing the Fix

### Local Development
1. Ensure your backend is running on `http://localhost:3003`
2. Start your frontend: `npm run dev`
3. All API calls should work correctly

### Production (Vercel)
1. Set `NEXT_PUBLIC_API_BASE_URL` in Vercel dashboard
2. Deploy your application
3. Check browser console - API calls should now go to your production backend URL

## Common Issues

### Issue: Still getting NOT_FOUND errors

**Solution**: 
- Verify `NEXT_PUBLIC_API_BASE_URL` is set in Vercel
- Ensure the variable name is exactly `NEXT_PUBLIC_API_BASE_URL` (case-sensitive)
- Redeploy after adding the variable

### Issue: CORS errors

**Solution**: 
- Ensure your backend has CORS enabled for your Vercel domain
- Check backend CORS configuration in `Smart-be/src/main.ts`

### Issue: Environment variable not working

**Solution**:
- Restart your Next.js dev server after creating `.env.local`
- Clear Vercel build cache and redeploy
- Verify the variable is available: `console.log(process.env.NEXT_PUBLIC_API_BASE_URL)`

## Files Changed

- ✅ `src/lib/api-config.ts` (new file)
- ✅ `src/app/signin/page.tsx`
- ✅ `src/app/register/page.tsx`
- ✅ `src/app/dashboard/student/page.tsx`
- ✅ `src/app/dashboard/staff/page.tsx`
- ✅ `src/app/dashboard/admin/page.tsx`

## Additional Notes

- The centralized config makes it easier to:
  - Update API endpoints in one place
  - Switch between environments
  - Add new endpoints consistently
  - Maintain type safety with TypeScript

