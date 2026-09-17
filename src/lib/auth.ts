import "server-only";

import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "./data";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireVerifiedProfile() {
  const profile = await requireProfile();
  if (profile.verification_status !== "verified") redirect("/profile?verification=required");
  return profile;
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin" || profile.status !== "active") redirect("/403");
  return profile;
}
