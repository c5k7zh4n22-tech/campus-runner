import "server-only";

import { PostgresAuthService } from "./postgres-auth-service";
import { OfficialAccountWechatProvider } from "./wechat-provider";

export const authService = new PostgresAuthService();
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
