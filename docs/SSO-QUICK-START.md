# Single Sign-On (SSO) - Quick Start Guide

## What's Already Done ✅

The **main application is already configured** to pass login credentials to PESA, FIMS, and E-estimate applications. When a user clicks on any of these applications, the system automatically:

1. **Retrieves the current user session** from Supabase
2. **Transfers authentication tokens** using two methods:
   - **LocalStorage**: Stores auth data with a 30-second expiration
   - **URL Parameters**: Passes tokens in the URL for cross-domain support
3. **Opens the target application** in a new window with credentials

## What Needs to Be Done 🔧

The **receiving applications** (PESA, FIMS, E-estimate) need to implement the auto-login functionality.

### For Each Receiving Application:

#### Step 1: Copy the Auth Receiver File
Copy `/src/utils/authReceiver.ts` from this main application to your PESA/FIMS/E-estimate application.

#### Step 2: Add Auto-Login on App Load
In your app's `App.tsx` or `main.tsx`, add this code:

```typescript
import { useEffect, useState } from 'react';
import { initializeAuthReceiver } from './utils/authReceiver';
import { supabase } from './lib/supabase';

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      // Auto-login from main app (if credentials were passed)
      await initializeAuthReceiver('pesa'); // Change to 'fims' or 'estimate'

      // Check if user is now logged in
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    };

    initAuth();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginForm />;
  return <Dashboard user={user} />;
}
```

#### Step 3: Verify Same Supabase Project
Make sure all apps use the **same Supabase project**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## How to Test

### Test 1: Check Console Logs
1. Login to main application
2. Click on PESA/FIMS/E-estimate
3. Open browser console (F12)
4. You should see logs like:
   ```
   🚀 PESA: Starting SSO authentication transfer...
   🔑 PESA: Valid session found, transferring credentials...
   💾 PESA: Auth data stored in localStorage
   🌐 PESA: Opening with SSO credentials...
   ✅ PESA: User should be automatically logged in
   ```

### Test 2: Check URL Parameters
When the new app opens, check the URL - it should contain:
```
?auto_login=true&access_token=...&refresh_token=...&source=zp_main
```

### Test 3: Check LocalStorage
In the receiving app, open console and check:
```javascript
// For PESA
console.log(localStorage.getItem('pesa_auth_transfer'));

// For FIMS
console.log(localStorage.getItem('fims_auth_transfer'));

// For E-estimate
console.log(localStorage.getItem('estimate_auth_transfer'));
```

## Troubleshooting

### Problem: Still asking to login

**Solution 1**: Check if receiving app has `authReceiver.ts` and calls `initializeAuthReceiver()`

**Solution 2**: Verify all apps use the same Supabase project

**Solution 3**: Check browser console for errors

### Problem: "Access token expired" error

**Solution**: Session might have expired. Logout and login again in main app.

### Problem: CORS errors

**Solution**: Ensure all apps are on HTTPS and Supabase allows requests from all domains.

## Security Features

✅ **30-second expiration**: Auth data automatically deleted after 30 seconds
✅ **Source verification**: Only accepts auth from 'zp_chandrapur_main'
✅ **Automatic cleanup**: Tokens removed from localStorage after use
✅ **URL cleanup**: Sensitive parameters removed from URL after authentication
✅ **Encrypted tokens**: Uses Supabase's secure JWT tokens

## Application URLs

- **PESA**: https://pesaworks.zpchandrapurapps.com/
- **FIMS**: https://fieldinspection.zpchandrapurapps.com/
- **E-estimate**: https://estimatemb.zpchandrapurapps.com/

## Next Steps

1. ✅ Main app is ready (no changes needed)
2. ⚠️ Copy `authReceiver.ts` to PESA, FIMS, and E-estimate
3. ⚠️ Add auto-login code to each receiving app
4. ⚠️ Test SSO functionality
5. ✅ Enjoy seamless authentication!

## Support

For detailed implementation guide, see: `/docs/single-sign-on-integration.md`

For questions, check browser console logs - they provide detailed information about the SSO process.
