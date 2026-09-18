import "server-only";

import { createSupabaseAdminClient, isAdminClientConfigured } from "@/lib/services/admin-client";
import type { AuthAdminService } from "./types";

export class SupabaseAuthAdminService implements AuthAdminService {
  isConfigured() {
    return isAdminClientConfigured();
  }

  private client() {
    return createSupabaseAdminClient();
  }

  async findUserByEmail(email: string) {
    const admin = this.client();
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        return {
          id: user.id,
          email: user.email ?? null,
          metadata: (user.user_metadata ?? {}) as Record<string, unknown>
        };
      }
      if (data.users.length < 1000) break;
    }
    return null;
  }

  async createConfirmedUser(input: {
    email: string;
    password: string;
    metadata: Record<string, unknown>;
  }) {
    const admin = this.client();
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: input.metadata
    });
    if (error) throw error;
    if (!data.user) throw new Error("User creation failed");
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      metadata: (data.user.user_metadata ?? {}) as Record<string, unknown>
    };
  }

  async updateUserMetadata(userId: string, metadata: Record<string, unknown>) {
    const admin = this.client();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: metadata
    });
    if (error) throw error;
  }

  async generateMagicLinkToken(email: string, redirectTo: string) {
    const admin = this.client();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo }
    });
    if (error) throw error;
    const token = data.properties?.hashed_token;
    if (!token) throw new Error("Magic link token was not generated");
    return token;
  }
}
