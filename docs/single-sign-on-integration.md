# Single Sign-On (SSO) Integration Guide

## Overview
The ZP Chandrapur Main Application implements Single Sign-On (SSO) functionality to allow users to seamlessly access PESA, FIMS, and E-estimate applications without re-entering credentials.

## How It Works

### Main Application (Sender)
When a user clicks on PESA, FIMS, or E-estimate, the main application:

1. **Retrieves Current Session**
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   ```

2. **Transfers Auth Data via Two Methods**:

   **Method 1: LocalStorage** (for same-origin)
   ```typescript
   const authData = {
     access_token: session.access_token,
     refresh_token: session.refresh_token,
     user: session.user,
     expires_at: session.expires_at,
     auto_login: true,
     source_app: 'zp_chandrapur_main',
     timestamp: Date.now()
   };
   localStorage.setItem('pesa_auth_transfer', JSON.stringify(authData));
   ```

   **Method 2: URL Parameters** (for cross-origin)
   ```typescript
   const url = new URL('https://pesaworks.zpchandrapurapps.com/');
   url.searchParams.set('auto_login', 'true');
   url.searchParams.set('access_token', session.access_token);
   url.searchParams.set('refresh_token', session.refresh_token);
   url.searchParams.set('source', 'zp_main');
   window.open(url.toString(), '_blank');
   ```

3. **Opens Target Application** in a new window with auth data

### Receiving Applications (PESA, FIMS, E-estimate)

Each receiving application must implement the auth receiver to automatically log in users.

## Implementation Steps for Receiving Apps

### Step 1: Copy the Auth Receiver Utility

Copy the `/src/utils/authReceiver.ts` file to your receiving application.

### Step 2: Initialize Auth Receiver on App Load

In your application's entry point (e.g., `App.tsx` or `main.tsx`), add:

```typescript
import { useEffect, useState } from 'react';
import { initializeAuthReceiver } from './utils/authReceiver';
import { supabase } from './lib/supabase';

function App() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for auto-login first
    const checkAutoLogin = async () => {
      // Try to auto-login from main app
      await initializeAuthReceiver('pesa'); // or 'fims' or 'estimate'

      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsCheckingAuth(false);
    };

    checkAutoLogin();
  }, []);

  if (isCheckingAuth) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <LoginForm />;
  }

  return <Dashboard user={user} />;
}
```

### Step 3: Handle Auth State Changes

Listen for authentication state changes:

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      console.log('User signed in via SSO');
      setUser(session?.user || null);
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

## Application-Specific Keys

Each application uses a specific localStorage key:

- **PESA**: `pesa_auth_transfer`
- **FIMS**: `fims_auth_transfer`
- **E-estimate**: `estimate_auth_transfer`
- **Workflow**: `workflow_auth_transfer`

## Security Features

### 1. Time-Limited Transfer
Auth data expires after 30 seconds:
```typescript
const isDataFresh = (Date.now() - authData.timestamp) < 30000;
```

### 2. Source Verification
Only accepts auth from verified source:
```typescript
if (authData.source_app === 'zp_chandrapur_main')
```

### 3. Automatic Cleanup
Auth data is automatically removed after use:
```typescript
localStorage.removeItem(storageKey);
```

### 4. URL Parameter Cleanup
Sensitive data is removed from URL:
```typescript
window.history.replaceState({}, document.title, window.location.pathname);
```

## Testing SSO Integration

### 1. Test Auto-Login via URL
```
https://yourapplication.com/?auto_login=true&access_token=xxx&refresh_token=yyy&source=zp_main
```

### 2. Test Auto-Login via LocalStorage
1. Open browser console
2. Set test data:
   ```javascript
   localStorage.setItem('pesa_auth_transfer', JSON.stringify({
     access_token: 'your_token',
     refresh_token: 'your_refresh_token',
     user: {...},
     expires_at: Date.now() + 3600000,
     auto_login: true,
     source_app: 'zp_chandrapur_main',
     timestamp: Date.now()
   }));
   ```
3. Refresh the page

### 3. Verify Session
```typescript
const { data: { session } } = await supabase.auth.getSession();
console.log('Current session:', session);
```

## Troubleshooting

### Issue: Auto-login not working

**Check 1: Verify URL parameters are being passed**
```javascript
console.log(window.location.href);
// Should contain: ?auto_login=true&access_token=...
```

**Check 2: Verify localStorage has auth data**
```javascript
console.log(localStorage.getItem('pesa_auth_transfer'));
```

**Check 3: Check browser console for errors**
Look for errors from `initializeAuthReceiver` or `handleAutoLogin`

**Check 4: Verify Supabase configuration**
Ensure all apps use the same Supabase project:
```typescript
// .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Issue: CORS errors

If you see CORS errors, ensure:
1. Supabase allows requests from all your application domains
2. Applications are using HTTPS (not HTTP)
3. No browser extensions blocking cross-origin requests

### Issue: Session expires immediately

Check token expiration:
```typescript
const { data: { session } } = await supabase.auth.getSession();
console.log('Expires at:', new Date(session.expires_at * 1000));
```

## Best Practices

1. **Always check for existing session first** before attempting auto-login
2. **Clear sensitive data immediately** after successful authentication
3. **Use HTTPS** for all applications to ensure secure token transfer
4. **Implement proper error handling** for failed auto-login attempts
5. **Provide fallback login** if SSO fails
6. **Log authentication events** for debugging and security monitoring

## Example: Complete PESA Integration

```typescript
// PESA App.tsx
import React, { useEffect, useState } from 'react';
import { initializeAuthReceiver } from './utils/authReceiver';
import { supabase } from './lib/supabase';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      console.log('🚀 PESA: Initializing authentication...');

      // Try SSO auto-login
      try {
        await initializeAuthReceiver('pesa');
      } catch (error) {
        console.error('SSO auto-login failed:', error);
      }

      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);

      if (session?.user) {
        console.log('✅ PESA: User authenticated via SSO');
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('PESA auth event:', event);
        setUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading PESA...</div>;
  }

  return user ? <Dashboard user={user} /> : <LoginPage />;
}
```

## Support

For issues or questions about SSO integration, contact the development team or refer to the Supabase authentication documentation:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Session Management](https://supabase.com/docs/guides/auth/sessions)
