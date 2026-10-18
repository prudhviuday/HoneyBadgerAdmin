// js/config.js

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL =
    "https://vorvkmklptldvgecfyso.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_8rl5-39n-iAwaTD5QEIGng_GYbZjFvN";

export const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("Supabase client initialized:", !!supabaseClient);