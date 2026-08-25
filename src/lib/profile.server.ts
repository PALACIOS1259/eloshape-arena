/**
 * Trusted profile logic — SERVER ONLY.
 *
 * Every mutation derives the profile from the signed-in user id. Nothing here
 * accepts a client-supplied profile id. Competitive columns (points, wins,
 * division, eligibility, riot_*) are never written from user input.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

/** Idempotently make sure the signed-in auth user owns exactly one profile. */
export async function ensureProfile(userId: string) {
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
  input: { handle?: string; displayName?: string; bio?: string; avatarUrl?: string },
) {
  const profileId = await ensureProfile(userId);
  const patch: Record<string, string | null> = {};

  if (input.handle !== undefined) {
    const handle = validateHandle(input.handle);
    const taken = await supabaseAdmin
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
    if (name.length < 2 || name.length > 40) throw new Error("Display name must be 2-40 characters.");
    patch["display_name"] = name;
  }

  if (input.bio !== undefined) patch["bio"] = input.bio.trim().slice(0, 280) || null;
  if (input.avatarUrl !== undefined) patch["avatar_url"] = input.avatarUrl.trim() || null;

  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", profileId);
    if (error) throw new Error(error.message);
  }

  await recalculateProfileCompletion(profileId);
  return loadProfileState(profileId);
}

/** Resolve a city to its full, consistent geography chain and store all four ids. */
export async function updateMyLocation(userId: string, cityId: string) {
  const profileId = await ensureProfile(userId);

  const city = await supabaseAdmin
    .from("regions")
    .select("id, name, parent_id, kind")
    .eq("id", cityId)
    .eq("kind", "city")
    .maybeSingle();
  if (city.error) throw new Error(city.error.message);
  if (!city.data) throw new Error("Unknown city.");

  const province = city.data.parent_id
    ? await supabaseAdmin
        .from("regions")
        .select("id, name, parent_id, kind")
        .eq("id", city.data.parent_id)
        .maybeSingle()
    : null;
  const provinceRow = province?.data?.kind === "province" ? province.data : null;

  const country = provinceRow?.parent_id
    ? await supabaseAdmin
        .from("regions")
        .select("id, name, parent_id, kind")
        .eq("id", provinceRow.parent_id)
        .maybeSingle()
    : null;
  const countryRow = country?.data?.kind === "country" ? country.data : null;

  const region = countryRow?.parent_id
    ? await supabaseAdmin
        .from("regions")
        .select("id, name, kind")
        .eq("id", countryRow.parent_id)
        .maybeSingle()
    : null;
  const regionRow = region?.data?.kind === "region" ? region.data : null;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      city_id: city.data.id,
      province_id: provinceRow?.id ?? null,
      country_id: countryRow?.id ?? null,
      region_id: regionRow?.id ?? null,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);

  await recalculateProfileCompletion(profileId);

  return {
    city: city.data.name,
    province: provinceRow?.name ?? null,
    country: countryRow?.name ?? null,
    region: regionRow?.name ?? null,
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
    true, // account exists
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

export async function loadProfileState(profileId: string) {
  const { data, error } = await supabaseAdmin
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
    { key: "handle", label: "Choose your handle & display name", done: !input.handle.startsWith("player_") },
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
