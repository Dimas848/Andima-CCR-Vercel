import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
// Lazy initialization preserves login imports. Browser sessions use SSR cookies.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = createClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
