# Android Deep Link Setup for OAuth

## Steps to Configure Deep Links in Android

### 1. Update AndroidManifest.xml

Navigate to: `android/app/src/main/AndroidManifest.xml`

Add this `<intent-filter>` inside the `<activity>` tag (under the existing intent-filters):

```xml
<activity
    android:name=".MainActivity"
    ...>
    
    <!-- Existing intent filters -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    
    <!-- ADD THIS: Deep link for OAuth callback -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.beanhealth.app" 
              android:host="oauth-callback" />
    </intent-filter>
    
</activity>
```

### 2. Configure Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your BeanHealth project
3. Navigate to: **Authentication** → **URL Configuration**
4. Add these to **Redirect URLs**:
   ```
   com.beanhealth.app://oauth-callback
   http://localhost:5173
   https://yourdomain.com (your production URL)
   ```

### 3. Sync Capacitor

After making changes, run:
```powershell
npm run build
npx cap sync
```

### 4. Test the Flow

1. Build and install the app on your Android device
2. Click "Sign in with Google"
3. Browser opens for authentication
4. After login, browser should close automatically
5. App should reopen with authenticated session

### 5. Debugging

To debug deep links:
```powershell
# Check if deep link is registered
adb shell dumpsys package com.beanhealth.app | findstr /i "scheme"

# Monitor logs when deep link triggers
adb logcat | findstr /i "deeplink\|oauth\|intent"
```

### Common Issues:

**Issue**: Browser opens but doesn't return to app
- **Fix**: Make sure `android:autoVerify="true"` is set and the scheme matches exactly

**Issue**: Deep link not recognized
- **Fix**: Run `npx cap sync` after any AndroidManifest.xml changes

**Issue**: Session not persisting
- **Fix**: Check that Supabase redirect URL matches `com.beanhealth.app://oauth-callback`

### Notes:
- The deep link scheme `com.beanhealth.app://` must match your `appId` in capacitor.config.ts
- Make sure to test on a real device (emulators may have issues with browser intents)
- The Browser plugin automatically closes after redirect on successful auth
