// utils/supabase/client.ts
import { supabase } from "@/lib/supabase";

// Kembalikan objek yang sama persis agar tidak membuat instance baru
export function createClient() {
  return supabase;
}