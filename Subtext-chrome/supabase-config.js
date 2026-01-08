// Supabase Configuration
// You need to fill these in from your Supabase Project Settings -> API
const SUPABASE_URL = 'https://blasvtbtfevhschncgsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsYXN2dGJ0ZmV2aHNjaG5jZ3NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5ODc4NzAsImV4cCI6MjA4MjU2Mzg3MH0.fkeFUGv1639CPzXs_DixU5FQ4wSQkCHwD0aLGVemL24';

// Export for usage in other files if needed, though usually window global in simple extensions
window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
};
