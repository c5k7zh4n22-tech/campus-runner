import "server-only";

import { maybeOne, query } from "@/lib/db";
import { storageService } from "./storage";
import type { Profile } from "@/lib/types";

export async function getProfileByUserId(userId: string) {
  return maybeOne<Profile>("select * from profiles where id = $1", [userId]);
}

export async function updateProfile(userId: string, input: { displayName: string; campusId: string }) {
  await query("update profiles set display_name = $1, campus_id = $2, updated_at = now() where id = $3", [
    input.displayName,
    input.campusId,
    userId
  ]);
}

export async function submitVerification(userId: string, input: { studentId: string; phone: string }) {
  await query(
    "update profiles set student_id = $1, phone = $2, verification_status = 'pending', updated_at = now() where id = $3",
    [input.studentId, input.phone, userId]
  );
}

export async function uploadAvatar(input: {
  userId: string;
  data: ArrayBuffer;
  contentType: string;
  extension: string;
}) {
  const storagePath = `${input.userId}/avatar-${Date.now()}.${input.extension}`;
  const { publicUrl } = await storageService.uploadFile({
    bucket: "avatars",
    path: storagePath,
    data: input.data,
    contentType: input.contentType,
    upsert: true
  });
  await query("update profiles set avatar_url = $1, updated_at = now() where id = $2", [publicUrl, input.userId]);
  return { publicUrl };
}
