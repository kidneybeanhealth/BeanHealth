# Android Deep Link Setup for OAuth - UPDATED

## CRITICAL: Supabase Dashboard Configuration

### Step 1: Configure Supabase Redirect URLs

1. Go to: https://supabase.com/dashboard
2. Select your BeanHealth project
3. Navigate to: **Authentication** → **URL Configuration**
4. Add these **EXACT URLs** to **Redirect URLs**:
   ```
   com.beanhealth.app://oauth-callback
   http://localhost:5173
   ```

5. **IMPORTANT**: Make sure the redirect URL matches EXACTLY: `com.beanhealth.app://oauth-callback`
   - No trailing slash
   - Scheme is `com.beanhealth.app`
   - Host is `oauth-callback`

### Step 2: Verify Google OAuth Provider Settings

1. In Supabase Dashboard: **Authentication** → **Providers** → **Google**
2. Make sure **Skip nonce check** is **DISABLED** (or leave default)
3. Verify your Google Client ID and Secret are correct

## Android Configuration

### AndroidManifest.xml Setup

Your `android/app/src/main/AndroidManifest.xml` should have these intent filters in the MainActivity:

```xml
<activity
    android:name=".MainActivity"
    android:launchMode="singleTask"
    android:exported="true"
    ...>
    
    <!-- Default launcher -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    
    <!-- Deep Link for OAuth Callback (with host) -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.beanhealth.app" 
              android:host="oauth-callback" />
    </intent-filter>
    
    <!-- Fallback for scheme-only deep links -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.beanhealth.app" />
    </intent-filter>
    
</activity>
```

### Capacitor Config

Your `capacitor.config.ts` should have:
- `appId: 'com.beanhealth.app'`
- `webDir: 'dist'`

## Building the App

After any changes, run:

```bash
# Build the web app
npm run build

# Sync with Capacitor
npx cap sync android

# Open Android Studio
npx cap open android
```

Then in Android Studio: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**

## How OAuth Flow Works

1. User taps "Sign in with Google"
2. App opens browser with Supabase OAuth URL
3. User authenticates with Google
4. Google redirects to Supabase
5. Supabase redirects to `com.beanhealth.app://oauth-callback?code=XXX`
6. Android catches this deep link and opens the app
7. App's `handleDeepLink` function extracts the `code` parameter
8. App calls `supabase.auth.exchangeCodeForSession(code)`
9. Session is established and app reloads

## Debugging

### Check if deep link is working:

```bash
# Test deep link manually
adb shell am start -W -a android.intent.action.VIEW -d "com.beanhealth.app://oauth-callback?code=test" com.beanhealth.app

# Watch logs
adb logcat | grep -E "(App|AuthService|AuthContext|Supabase)"
```

### Common Issues:

1. **"Both access_token and code_verifier are required"**
   - This means the PKCE flow is broken
   - Check that storage is persisting the code_verifier
   - Make sure app isn't restarting between OAuth start and callback

2. **Deep link not received**
   - Check AndroidManifest intent-filters
   - Make sure launchMode is "singleTask"
   - Run `npx cap sync android` after manifest changes

3. **Login loops back to login page**
   - Session not being persisted
   - Check CapacitorStorage is working
   - Check supabase.ts has correct storage config

4. **"Invalid nonce" or similar errors**
   - PKCE code_verifier not matching
   - Try clearing app data and re-testing

## Supabase Client Configuration

Make sure your `lib/supabase.ts` has:

```typescript
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  storage: Capacitor.isNativePlatform() ? CapacitorStorage : window.localStorage,
  storageKey: 'supabase.auth.token',
  flowType: 'pkce',
}
```

## Test Checklist

- [ ] Supabase has `com.beanhealth.app://oauth-callback` in redirect URLs
- [ ] AndroidManifest has intent-filter with correct scheme and host
- [ ] `launchMode="singleTask"` is set on MainActivity
- [ ] `npx cap sync android` was run after any changes
- [ ] App is tested on real device (emulators may have issues)
