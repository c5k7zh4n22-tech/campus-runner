import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface SmsService {
  isConfigured(): boolean;
  sendVerificationCode(phone: string): Promise<{ error?: string }>;
  verifyCode(phone: string, code: string): Promise<{ error?: string }>;
}

class DisabledSmsService implements SmsService {
  isConfigured() {
    return false;
  }

  async sendVerificationCode() {
    return { error: "短信服务尚未配置" };
  }

  async verifyCode() {
    return { error: "短信服务尚未配置" };
  }
}

class SupabasePhoneSmsService implements SmsService {
  isConfigured() {
    return process.env.SMS_PROVIDER === "supabase" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  }

  async sendVerificationCode(phone: string) {
    const supabase = await createClient();
    if (!supabase) return { error: "短信服务尚未配置" };
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return error ? { error: error.message } : {};
  }

  async verifyCode(phone: string, code: string) {
    const supabase = await createClient();
    if (!supabase) return { error: "短信服务尚未配置" };
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    return error ? { error: error.message } : {};
  }
}

export const smsService: SmsService =
  process.env.SMS_PROVIDER === "supabase"
    ? new SupabasePhoneSmsService()
    : new DisabledSmsService();
