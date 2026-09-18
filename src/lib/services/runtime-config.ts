import "server-only";

import { isSupabaseConfigured, siteUrl } from "@/lib/supabase/config";
import { authAdminService, wechatAuthProvider } from "./auth";
import { smsService } from "./sms";
import { storageService } from "./storage";

export const runtimeConfig = {
  appUrl: process.env.APP_URL || siteUrl,
  authProvider: process.env.AUTH_PROVIDER || "supabase",
  databaseProvider: process.env.DATABASE_PROVIDER || "supabase-postgres",
  storageProvider: process.env.STORAGE_PROVIDER || "supabase-storage",
  smsProvider: process.env.SMS_PROVIDER || "disabled",
  wechatProvider:
    process.env.WECHAT_PROVIDER || "official-account"
} as const;

export function getRuntimeCapabilities() {
  return {
    appUrl: runtimeConfig.appUrl,
    providers: runtimeConfig,
    configured: {
      database: isSupabaseConfigured,
      auth: isSupabaseConfigured,
      authAdmin: authAdminService.isConfigured(),
      storage: storageService.isConfigured(),
      sms: smsService.isConfigured(),
      wechat: wechatAuthProvider.isConfigured()
    }
  };
}
