import type { UserIdentity } from "@supabase/supabase-js";

export const DISCORD_LINK_REQUEST = "eloshape.discord-link-request";

export function discordIdentity(identities: UserIdentity[]) {
  return identities.find((identity) => identity.provider === "discord") ?? null;
}

// Display only. Role authorization reads auth.identities directly in the backend.
export function discordLabel(identity: UserIdentity) {
  const data = identity.identity_data;
  return typeof data?.["full_name"] === "string"
    ? data["full_name"]
    : typeof data?.["sub"] === "string"
      ? data["sub"]
      : "Discord";
}

export function validDiscordLinkRequest(value: string | null, userId: string, now = Date.now()) {
  try {
    const request = JSON.parse(value ?? "null");
    return (
      request?.userId === userId &&
      typeof request.startedAt === "number" &&
      Number.isFinite(request.startedAt) &&
      now >= request.startedAt &&
      now - request.startedAt < 10 * 60_000
    );
  } catch {
    return false;
  }
}
