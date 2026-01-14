# Authentication Integration Guide

## Overview
This guide explains how to integrate automatic login between the main ZP Chandrapur application and the E-estimate/FIMS applications using shared Supabase authentication.

## Implementation in E-estimate/FIMS Applications

### 1. Copy the Auth Receiver Utility
Copy the `src/utils/authReceiver.ts` file to your E-estimate or FIMS application.

### 2. Initialize Auto-Login in Target App
Add this to your main App component or entry point:

```typescript
// In your E-estimate/FIMS App.tsx or main component
import { useEffect } from 'react';
import { initializeAuthReceiver } from './utils/authReceiver';

function App() {
  useEffect(() => {
    // Initialize auth receiver when app loads
    // For E-estimate: initializeAuthReceiver('estimate');
    // For FIMS: initializeAuthReceiver('fims');
    // For PESA: initializeAuthReceiver('pesa');
    // For Workflow: initializeAuthReceiver('workflow');
    initializeAuthReceiver('estimate'); // or 'fims'
  }, []);

  // Rest of your app code...
}
```

### 3. Alternative: Check in Auth Guard
If you have an authentication guard or login page, you can check there:

```typescript
// In your login component or auth guard
import { handleAutoLogin } from './utils/authReceiver';

const LoginPage = () => {
  useEffect(() => {
    const checkAutoLogin = async () => {
      // Pass 'estimate' for E-estimate or 'fims' for FIMS
      // Pass 'pesa' for PESA or 'workflow' for Workflow Management
      const success = await handleAutoLogin('estimate'); // or 'fims'
      if (success) {
        // Redirect to dashboard or main app
        navigate('/dashboard');
      }
    };
    
    checkAutoLogin();
  }, []);

  // Rest of login component...
};
```

## How It Works

### Method 1: URL Parameters (Fallback)
- Main app passes auth tokens via URL parameters  
- Target app (E-estimate/FIMS) reads and uses them to set Supabase session
- URL is cleaned after successful login

### Method 2: localStorage Transfer (Primary)
- Main app stores auth data in localStorage temporarily
- E-estimate app reads and uses the data
- Data is automatically cleaned up after use

## Security Considerations

1. **localStorage Method**: More secure as tokens aren't visible in URL
2. **Automatic Cleanup**: Auth data is removed after 30 seconds or successful use
3. **Source Verification**: Checks that auth data comes from the main app
4. **Error Handling**: Graceful fallback to normal login if auto-login fails
5. **App-Specific Storage**: Each app uses its own localStorage key to prevent conflicts:
   - E-estimate: `estimate_auth_transfer`
   - FIMS: `fims_auth_transfer`
   - PESA: `pesa_auth_transfer`
   - Workflow: `workflow_auth_transfer`

## Testing

1. Login to main ZP Chandrapur application
2. Click on E-estimate, FIMS, PESA, or Workflow Management card
3. Target application should open in new tab and automatically log you in
4. Check browser console for detailed logs
5. If auto-login fails, normal login page should appear
6. Look for app-specific log messages (E-ESTIMATE:, FIMS:, PESA:, or WORKFLOW:)

## Configuration

Update the E-estimate URL in the main application:
```typescript
// In Dashboard.tsx, update this line:
const estimateUrl = 'https://your-actual-estimate-url.com';
```

Update the FIMS URL in the main application:
```typescript
const fimsUrl = 'https://your-actual-fims-url.com';
```

Update the PESA URL in the main application:
```typescript
const pesaUrl = 'https://zpchandrapur-pesa-fi-r90q.bolt.host';
```

Update the Workflow Management URL in the main application:
```typescript
const workflowUrl = 'https://your-actual-workflow-url.com';
```

## Troubleshooting

### Common Issues:
1. **Auto-login not working**: Check browser console for error messages
2. **Session expired**: Main app session might be expired
3. **CORS issues**: Ensure both apps have proper CORS configuration
4. **Different domains**: localStorage won't work across different domains - use URL method only
5. **Wrong app name**: Ensure you're passing the correct app name ('estimate', 'fims', 'pesa', or 'workflow') to the functions

### Debug Steps:
1. Open browser console in target app (E-estimate/FIMS)
2. Look for logs starting with app name (E-ESTIMATE:, FIMS:, PESA:, or WORKFLOW:) and emojis 🔍, 🔑, ✅, or ❌
3. Check if auth data is being passed correctly
4. Verify Supabase configuration matches between apps
5. Ensure the correct localStorage key is being used for each app:
   - E-estimate: `estimate_auth_transfer`
   - FIMS: `fims_auth_transfer`
   - PESA: `pesa_auth_transfer`
   - Workflow: `workflow_auth_transfer`

## Same Domain Optimization

If both applications are on the same domain, you can use:
- Shared localStorage/sessionStorage
- Shared cookies
- Direct session sharing

This implementation provides a seamless user experience while maintaining security best practices.