import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StorageBucket = "avatars" | "marketplace";

export interface UploadFileInput {
  bucket: StorageBucket;
  path: string;
  data: ArrayBuffer;
  contentType: string;
  upsert?: boolean;
}

export interface StorageService {
  isConfigured(): boolean;
  uploadFile(input: UploadFileInput): Promise<{ publicUrl: string }>;
  deleteFile(bucket: StorageBucket, path: string): Promise<void>;
  getPublicUrl(bucket: StorageBucket, path: string): string;
}

class SupabaseStorageService implements StorageService {
  isConfigured() {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  async uploadFile(input: UploadFileInput) {
    const supabase = await createClient();
    if (!supabase) throw new Error("Storage service is not configured");
    const { error } = await supabase.storage.from(input.bucket).upload(input.path, input.data, {
      contentType: input.contentType,
      upsert: input.upsert ?? false
    });
    if (error) throw error;
    const { data } = supabase.storage.from(input.bucket).getPublicUrl(input.path);
    return { publicUrl: data.publicUrl };
  }

  async deleteFile(bucket: StorageBucket, path: string) {
    const supabase = await createClient();
    if (!supabase) throw new Error("Storage service is not configured");
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }

  getPublicUrl(bucket: StorageBucket, path: string) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return "";
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    return `${base}/storage/v1/object/public/${bucket}/${path}`;
  }
}

export const storageService: StorageService = new SupabaseStorageService();
