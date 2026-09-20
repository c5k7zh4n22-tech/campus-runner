import "server-only";

import { siteUrl } from "@/lib/config";
import { isDatabaseConfigured } from "@/lib/db";
import { authService, wechatAuthProvider } from "./auth";
import { smsService } from "./sms";
import { storageService } from "./storage";

export const runtimeConfig = {
  appUrl: process.env.APP_URL || siteUrl,
  authProvider: process.env.AUTH_PROVIDER || "postgres-cookie",
  databaseProvider: process.env.DATABASE_PROVIDER || "postgres",
  storageProvider: process.env.STORAGE_PROVIDER || "local-storage",
  smsProvider: process.env.SMS_PROVIDER || "disabled",
  wechatProvider:
    process.env.WECHAT_PROVIDER || "official-account"
} as const;

export function getRuntimeCapabilities() {
  return {
    appUrl: runtimeConfig.appUrl,
    providers: runtimeConfig,
    configured: {
      database: isDatabaseConfigured(),
      auth: authService.isConfigured(),
      storage: storageService.isConfigured(),
      sms: smsService.isConfigured(),
      wechat: wechatAuthProvider.isConfigured()
    }
  };
}
