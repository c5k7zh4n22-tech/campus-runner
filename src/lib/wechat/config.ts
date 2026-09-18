import {
  isWechatBrowser,
  sanitizeNextPath,
  wechatAuthProvider
} from "@/lib/services/auth";

export { isWechatBrowser, sanitizeNextPath, wechatAuthProvider };

export function isWechatLoginConfigured() {
  return wechatAuthProvider.isConfigured();
}
