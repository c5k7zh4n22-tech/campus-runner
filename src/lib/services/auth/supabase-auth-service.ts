import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppUser, AuthResult, AuthService } from "./types";

export class SupabaseAuthService implements AuthService {
  isConfigured() {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  async getCurrentUser(): Promise<AppUser | null> {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const supabase = await createClient();
    if (!supabase) return { error: "认证服务尚未配置" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }

  async signUpWithPassword(input: {
    email: string;
    password: string;
    displayName: string;
    redirectTo: string;
  }): Promise<AuthResult & { sessionCreated: boolean }> {
    const supabase = await createClient();
    if (!supabase) return { error: "认证服务尚未配置", sessionCreated: false };
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.displayName },
        emailRedirectTo: input.redirectTo
      }
    });
    return error ? { error: error.message, sessionCreated: false } : { sessionCreated: Boolean(data.session) };
  }

  async signOut(): Promise<AuthResult> {
    const supabase = await createClient();
    if (!supabase) return {};
    const { error } = await supabase.auth.signOut();
    return error ? { error: error.message } : {};
  }

  async exchangeCodeForSession(code: string): Promise<AuthResult> {
    const supabase = await createClient();
    if (!supabase) return { error: "认证服务尚未配置" };
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? { error: error.message } : {};
  }
}
