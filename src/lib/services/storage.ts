import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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

class LocalStorageService implements StorageService {
  private readonly root = process.env.LOCAL_STORAGE_ROOT
    ? path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_STORAGE_ROOT)
    : path.join(process.cwd(), "public", "uploads");
  private readonly publicBaseUrl =
    process.env.STORAGE_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL ||
    "/uploads";

  isConfigured() {
    return true;
  }

  async uploadFile(input: UploadFileInput) {
    const destination = this.resolvePath(input.bucket, input.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(input.data), { flag: input.upsert ? "w" : "wx" });
    return { publicUrl: this.getPublicUrl(input.bucket, input.path) };
  }

  async deleteFile(bucket: StorageBucket, path: string) {
    await rm(this.resolvePath(bucket, path), { force: true });
  }

  getPublicUrl(bucket: StorageBucket, path: string) {
    if (!this.publicBaseUrl) return "";
    return `${this.publicBaseUrl.replace(/\/$/, "")}/${bucket}/${path}`;
  }

  private resolvePath(bucket: StorageBucket, filePath: string) {
    const target = path.resolve(this.root, bucket, filePath);
    const bucketRoot = path.resolve(this.root, bucket);
    if (!target.startsWith(bucketRoot + path.sep)) throw new Error("Invalid storage path");
    return target;
  }
}

export const storageService: StorageService = new LocalStorageService();
