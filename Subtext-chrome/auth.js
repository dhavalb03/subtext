// auth.js - Handles Authentication logic

// Initialize Supabase client
// Relies on SUPABASE_CONFIG (from supabase-config.js) and supabase (from libs/supabase.js) being loaded
let supabaseClient = null;

function getSupabase() {
    if (supabaseClient) return supabaseClient;

    if (!window.supabase || !window.SUPABASE_CONFIG) {
        console.error('Supabase library or config not loaded');
        return null;
    }

    // Initialize config
    const { url, key } = window.SUPABASE_CONFIG;
    if (url.includes('YOUR_SUPABASE_URL')) {
        console.warn('Supabase not configured yet');
        return null;
    }

    // Create client
    supabaseClient = window.supabase.createClient(url, key, {
        auth: {
            storage: {
                getItem: (key) => {
                    return new Promise((resolve) => {
                        chrome.storage.local.get([key], (result) => {
                            resolve(result[key]);
                        });
                    });
                },
                setItem: (key, value) => {
                    return new Promise((resolve) => {
                        chrome.storage.local.set({ [key]: value }, () => resolve());
                    });
                },
                removeItem: (key) => {
                    return new Promise((resolve) => {
                        chrome.storage.local.remove([key], () => resolve());
                    });
                }
            }
        }
    });

    return supabaseClient;
}

// Sign In with Google
async function signInWithGoogle() {
    const supabase = getSupabase();
    if (!supabase) {
        alert('Please configure Supabase credentials in supabase-config.js first!');
        return;
    }

    try {
        console.log('Starting Google Sign In...');

        // 1. Get the OAuth URL via manual construction or library
        // We use manual construction to ensure we control the redirect URL for Chrome Identity
        const redirectUrl = chrome.identity.getRedirectURL();
        console.log('=== DEBUG: Chrome Extension Redirect URL ===');
        console.log('Redirect URL:', redirectUrl);
        console.log('Make sure this EXACT URL is added to Supabase -> Authentication -> URL Configuration -> Redirect URLs');

        const { url: projectUrl } = window.SUPABASE_CONFIG;
        console.log('Supabase Project URL:', projectUrl);

        // This is the endpoint Supabase uses to start OAuth
        const authUrl = `${projectUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
        console.log('Full Auth URL:', authUrl);

        console.log('Launching Web Auth Flow:', authUrl);

        // 2. Launch Chrome's native auth flow
        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, async (responseUrl) => {
            if (chrome.runtime.lastError) {
                console.error('Auth Flow Error:', chrome.runtime.lastError.message);
                alert('Login failed: ' + chrome.runtime.lastError.message);
                return;
            }

            if (!responseUrl) {
                console.error('No response URL');
                return;
            }

            console.log('Got redirect URL:', responseUrl);

            // 3. Extract tokens from keys
            // The URL usually comes back as: https://<id>.chromiumapp.org/#access_token=...&refresh_token=...
            // Note: Supabase might return it in query params or fragment depending on config, but standard OAuth/Supabase 2.0 is fragment.
            const urlObj = new URL(responseUrl);
            const params = new URLSearchParams(urlObj.hash.substring(1)); // Remove '#'

            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (!accessToken) {
                // Try query params if hash failed
                const queryParams = new URLSearchParams(urlObj.search);
                const accessQuery = queryParams.get('access_token');
                const refreshQuery = queryParams.get('refresh_token');

                if (accessQuery) {
                    await setSession(accessQuery, refreshQuery);
                    return;
                }

                console.error('No access token found in URL');
                console.error('Hash:', urlObj.hash);
                console.error('Search:', urlObj.search);
                return;
            }

            await setSession(accessToken, refreshToken);
        });

    } catch (err) {
        console.error('Login error:', err);
    }
}

async function setSession(accessToken, refreshToken) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
    });

    if (error) {
        console.error('Set Session Error:', error);
        alert('Failed to save session');
    } else {
        console.log('Session saved!', data);
        window.location.reload(); // Reload to update UI
    }
}

// Sign Out
async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out error:', error);

    // Clear local storage too just in case
    chrome.storage.local.clear(() => {
        window.location.reload();
    });
}

// Check if user is logged in
async function checkAuth() {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        return null;
    }

    return session.user;
}

// Export functions for popup.js
window.auth = {
    signInWithGoogle,
    signOut,
    checkAuth
};
