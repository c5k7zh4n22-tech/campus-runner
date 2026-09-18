import "server-only";

import { SupabaseAuthService } from "./supabase-auth-service";
import { SupabaseAuthAdminService } from "./supabase-auth-admin-service";
import { OfficialAccountWechatProvider } from "./wechat-provider";

export const authService = new SupabaseAuthService();
export const authAdminService = new SupabaseAuthAdminService();
export const wechatAuthProvider = new OfficialAccountWechatProvider();

export type {
  AppUser,
  AuthAdminService,
  AuthResult,
  AuthService
} from "./types";
export {
  isWechatBrowser,
  sanitizeNextPath,
  type WechatAuthProvider,
  type WechatIdentity
} from "./wechat-provider";
