import { createClient } from "@/utils/supabase/client";
export { VALIDATE_ROLES, canValidate } from "@/lib/c2/roles";
export interface AppUser { id: string; name: string; role: string }
export const getAuthClient = createClient;
export async function getCurrentUser(): Promise<AppUser | null> {
  const { data, error } = await createClient().auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;
  return {
    id: user.id,
    name: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || user.id),
    role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : "",
  };
}
