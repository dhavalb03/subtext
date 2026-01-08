# Supabase & Google OAuth Setup Guide

## Phase 1: Create Supabase Project
1. Go to [Supabase](https://supabase.com/) and click "Start your project".
2. Sign in with GitHub.
3. Click "New Project".
4. Choose your organization.
5. **Name:** `Subtext Extension`
6. **Database Password:** Generate a strong password and save it in your password manager (we won't need it for code, but good to have).
7. **Region:** Choose one close to you (e.g., US East).
8. Click **Create new project**.
9. Wait ~2 minutes for the database to set up.

## Phase 2: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown (top left) → **New Project**.
3. **Project Name:** `Subtext Auth`.
4. Click **Create**.
5. Select the new project from the notifications or dropdown.

### Configure OAuth Consent Screen
1. Search for "OAuth consent screen" in the top bar.
2. Select **External** User Type → Create.
3. **App Information:**
   - App name: `Subtext`
   - User support email: Select your email
4. **Developer Contact Information:** Enter your email.
5. Click **Save and Continue** multiple times until finished (you can skip "Scopes" and "Test Users" for now).
6. On the Summary page, click **Back to Dashboard**.
7. Under "Publishing Status", click **Publish App** -> Confirm. (This allows anyone with a Gmail account to log in).

### Create Credentials
1. Go to **Credentials** in the left sidebar.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. **Application type:** Web application.
4. **Name:** `Supabase Auth`.
5. **Authorized redirect URIs:**
   - We need to get this URL from Supabase.
   - **Keep this tab open**, switch to your Supabase tab.

## Phase 3: Connect Supabase & Google
1. Go to your Supabase Project Dashboard.
2. Click the **Authentication** icon (left sidebar, looks like a users group) → **Providers**.
3. Click **Google** to expand it.
4. **Enable Google** (toggle switch).
5. Copy the **Callback URL (for OAuth)**.
   - It looks like: `https://<your-project-id>.supabase.co/auth/v1/callback`
6. Switch back to **Google Cloud Console**.
7. Paste this URL into **Authorized redirect URIs**.
8. Click **Create**.
9. Copy the **Client ID** and **Client Secret**.

## Phase 4: Finalize Connection
1. Switch back to **Supabase**.
2. Paste the **Client ID** and **Client Secret** into the Google Provider settings.
3. Click **Save**.

## Phase 5: Get Keys for Extension
1. In Supabase, go to **Settings (Gear icon)** → **API**.
2. Find **Project URL** and copy it.
3. Find **Project API keys** → `anon` public key and copy it.
4. You will paste these into the `supabase-config.js` file in the extension.

## Phase 6: Extension Redirect Setup
1. In `Supabase > Authentication > URL Configuration`.
2. Ensure `Site URL` is set.
3. Under `Redirect URLs`, you need to add your Chrome Extension URL.
   - To find this: Open your extension in Chrome, right-click the icon → Manage Extension.
   - The ID looks like `abcdefghijklmnop...`
   - The redirect URL format is: `https://<extension-id>.chromiumapp.org/`
   - **Add this URL** to the Redirect URLs list in Supabase.
   - Click **Save**.
