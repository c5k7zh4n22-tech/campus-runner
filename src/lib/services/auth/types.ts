export interface AppUser {
  id: string;
  email: string | null;
}

export interface AuthResult {
  error?: string;
}

export interface AuthService {
  isConfigured(): boolean;
  getCurrentUser(): Promise<AppUser | null>;
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  signUpWithPassword(input: {
    email: string;
    password: string;
    displayName: string;
    redirectTo: string;
  }): Promise<AuthResult & { sessionCreated: boolean }>;
  signOut(): Promise<AuthResult>;
  exchangeCodeForSession(code: string): Promise<AuthResult>;
}

export interface AuthAdminService {
  isConfigured(): boolean;
  findUserByEmail(email: string): Promise<{
    id: string;
    email: string | null;
    metadata: Record<string, unknown>;
  } | null>;
  createConfirmedUser(input: {
    email: string;
    password: string;
    metadata: Record<string, unknown>;
  }): Promise<{ id: string; email: string | null; metadata: Record<string, unknown> }>;
  updateUserMetadata(userId: string, metadata: Record<string, unknown>): Promise<void>;
  generateMagicLinkToken(email: string, redirectTo: string): Promise<string>;
}
