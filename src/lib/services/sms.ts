import "server-only";

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

export const smsService: SmsService = new DisabledSmsService();
