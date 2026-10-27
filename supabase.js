import { createClient } from "@supabase/supabase-js";

const url = String(
  import.meta.env.VITE_SUPABASE_URL ?? ""
).trim();

const key = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""
).trim();

export const isDemoMode = url.length === 0;

let client = null;
let configurationError = "";

if (!isDemoMode) {
  try {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      throw new Error("Supabase URL phải dùng HTTP hoặc HTTPS.");
    }

    if (!key) {
      throw new Error("Thiếu VITE_SUPABASE_ANON_KEY.");
    }

    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (error) {
    configurationError =
      error instanceof Error
        ? error.message
        : "Cấu hình Supabase không hợp lệ.";
  }
}

export const supabase = client;
export const supabaseConfigError = configurationError;