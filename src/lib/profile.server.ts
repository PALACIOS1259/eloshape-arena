/**
 * Trusted profile logic — SERVER ONLY.
 *
 * Normal player self-service uses the authenticated Supabase client from
 * `requireSupabaseAuth`, so RLS + column grants remain the primary boundary and
 * local development does not need the service-role secret. Privileged callers
 * (Riot sync / admin flows) may still use the service-role client explicitly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type AuthenticatedSupabaseClient = SupabaseClient<Database>;
type RpcError = { message: string };
type RpcResult<T> = { data: T | null; error: RpcError | null };

function callAuthenticatedRpc<T>(
  supabase: AuthenticatedSupabaseClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult<T>>;
  return rpc(fn, args);
}

export const RESERVED_HANDLES = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "staff",
  "support",
  "help",
  "riot",
  "riotgames",
  "riotsupport",
  "eloshape",
  "official",
  "system",
  "root",
  "api",
  "null",
  "undefined",
];

export type OnboardingStep = {
  key: string;
  label: string;
  done: boolean;
};

/**
 * Idempotently ensure the signed-in user has a profile.
 *
 * When an authenticated client is supplied, the DB wrapper derives auth.uid()
 * itself and can never provision another user's profile. The service-role
 * fallback exists only for trusted server modules that already require it.
 */
export async function ensureProfile(userId: string, supabase?: AuthenticatedSupabaseClient) {
  if (supabase) {
    const { data, error } = await callAuthenticatedRpc<string>(supabase, "ensure_my_profile");
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not provision your EloShape profile.");
    return data;
  }

  const existing = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id;

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authError) throw new Error(authError.message);

  const meta = (authUser.user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    String(meta["display_name"] ?? meta["full_name"] ?? meta["name"] ?? "").trim() ||
    (authUser.user?.email ?? "").split("@")[0] ||
    "Player";

  const handle = await uniqueHandleFor(userId);
  const inserted = await supabaseAdmin
    .from("profiles")
    .insert({
      user_id: userId,
      handle,
      display_name: displayName.slice(0, 40),
      eligibility: "pending_review",
      profile_completion: 20,
      is_demo: false,
    })
    .select("id")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "player" }, { onConflict: "user_id,role" });

  return inserted.data.id;
}

async function uniqueHandleFor(userId: string) {
  const base = `player_${userId.replace(/-/g, "").slice(0, 10)}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}_${attempt}`;
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("handle", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

export function validateHandle(raw: string) {
  const handle = (raw ?? "").trim().toLowerCase();
  if (handle.length < 3 || handle.length > 20) {
    throw new Error("Handle must be between 3 and 20 characters.");
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    throw new Error("Handle may only contain lowercase letters, numbers and underscores.");
  }
  const normalized = handle.replace(/[_0]/g, (char) => (char === "0" ? "o" : ""));
  if (RESERVED_HANDLES.includes(handle) || RESERVED_HANDLES.includes(normalized)) {
    throw new Error("That handle is reserved.");
  }
  return handle;
}

/** Update only the identity fields a player is allowed to control. */
export async function updateMyProfile(
  userId: string,
  supabase: AuthenticatedSupabaseClient,
  input: { handle?: string; displayName?: string; bio?: string; avatarUrl?: string },
) {
  const profileId = await ensureProfile(userId, supabase);
  const patch: ProfileUpdate = {};

  if (input.handle !== undefined) {
    const handle = validateHandle(input.handle);
    const taken = await supabase
      .from("profiles")
      .select("id")
      .ilike("handle", handle)
      .neq("id", profileId)
      .maybeSingle();
    if (taken.error) throw new Error(taken.error.message);
    if (taken.data) throw new Error("That handle is already taken.");
    patch["handle"] = handle;
  }

  if (input.displayName !== undefined) {
    const name = input.displayName.trim();
    if (name.length < 2 || name.length > 40)
      throw new Error("Display name must be 2-40 characters.");
    patch["display_name"] = name;
  }

  if (input.bio !== undefined) patch["bio"] = input.bio.trim().slice(0, 280) || null;
  if (input.avatarUrl !== undefined) patch["avatar_url"] = input.avatarUrl.trim() || null;

  if (Object.keys(patch).length) {
    // RLS verifies ownership and column grants allow only identity fields.
    const { error } = await supabase.from("profiles").update(patch).eq("id", profileId);
    if (error) throw new Error(error.message);
  }

  const completion = await callAuthenticatedRpc<number>(supabase, "recalculate_my_profile_completion");
  if (completion.error) throw new Error(completion.error.message);

  return loadProfileState(profileId, supabase);
}

/** Resolve a city to its full, consistent geography chain and store all four ids. */
export async function updateMyLocation(
  userId: string,
  supabase: AuthenticatedSupabaseClient,
  cityId: string,
) {
  await ensureProfile(userId, supabase);

  // SECURITY DEFINER wrapper derives auth.uid(), validates the full geography
  // chain, and updates only the current user's location columns.
  const { data, error } = await callAuthenticatedRpc<Record<string, unknown>>(
    supabase,
    "update_my_location",
    { p_city_id: cityId },
  );
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Could not update your location.");
  }

  const result = data as Record<string, unknown>;
  return {
    city: typeof result["city"] === "string" ? result["city"] : null,
    province: typeof result["province"] === "string" ? result["province"] : null,
    country: typeof result["country"] === "string" ? result["country"] : null,
    region: typeof result["region"] === "string" ? result["region"] : null,
  };
}

/** profile_completion is derived server-side; clients can never set it. */
export async function recalculateProfileCompletion(profileId: string) {
  const profile = await supabaseAdmin
    .from("profiles")
    .select("handle, display_name, city_id, division_id, riot_tier, bio")
    .eq("id", profileId)
    .maybeSingle();
  if (profile.error) throw new Error(profile.error.message);
  if (!profile.data) return 0;

  const riot = await supabaseAdmin
    .from("riot_accounts")
    .select("id, data_verified")
    .eq("profile_id", profileId)
    .maybeSingle();

  const steps = [
    true,
    !profile.data.handle.startsWith("player_"),
    Boolean(profile.data.city_id),
    Boolean(riot.data?.data_verified),
    Boolean(profile.data.division_id),
  ];
  const completion = Math.round((steps.filter(Boolean).length / steps.length) * 100);

  await supabaseAdmin
    .from("profiles")
    .update({ profile_completion: completion })
    .eq("id", profileId);
  return completion;
}

export async function loadProfileState(
  profileId: string,
  supabase: AuthenticatedSupabaseClient = supabaseAdmin,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, handle, display_name, avatar_url, bio, profile_completion, eligibility,
       division:divisions!profiles_division_id_fkey(code, name, accent),
       city:regions!profiles_city_id_fkey(id, name),
       province:regions!profiles_province_id_fkey(name),
       country:regions!profiles_country_id_fkey(name),
       region:regions!profiles_region_id_fkey(name)`,
    )
    .eq("id", profileId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export function onboardingSteps(input: {
  handle: string;
  cityId: string | null;
  riotLinked: boolean;
  riotTier: string | null;
  divisionCode: string | null;
  eligibility: string;
}): OnboardingStep[] {
  return [
    { key: "account", label: "Create EloShape account", done: true },
    {
      key: "handle",
      label: "Choose your handle & display name",
      done: !input.handle.startsWith("player_"),
    },
    { key: "location", label: "Select your location", done: Boolean(input.cityId) },
    { key: "riot", label: "Connect your Riot account", done: input.riotLinked },
    { key: "rank", label: "Riot rank detected", done: Boolean(input.riotTier) },
    {
      key: "eligibility",
      label:
        input.eligibility === "eligible"
          ? "Competitive eligibility confirmed"
          : "Competitive eligibility pending review",
      done: input.eligibility === "eligible" && Boolean(input.divisionCode),
    },
  ];
}
