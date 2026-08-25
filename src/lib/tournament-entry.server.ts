/**
 * Tournament registration and check-in — SERVER ONLY.
 *
 * Players have no direct write access to `tournament_entries`. Every field that
 * affects competition (seed, placement, points_awarded, status) is set here,
 * never by the browser.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { ensureProfile } from "./profile.server";

const CHECK_IN_WINDOW_MS = 60 * 60 * 1000; // one hour before start

export type RegistrationResult = {
  entryId: string;
  status: string;
  tournamentSlug: string;
  tournamentName: string;
};

export async function registerForTournament(
  userId: string,
  tournamentSlug: string,
): Promise<RegistrationResult> {
  const profileId = await ensureProfile(userId);

  const profile = await supabaseAdmin
    .from("profiles")
    .select("id, eligibility, division_id, city_id, province_id, country_id, region_id")
    .eq("id", profileId)
    .single();
  if (profile.error) throw new Error(profile.error.message);

  if (profile.data.eligibility === "suspended") throw new Error("Your account is suspended.");
  if (profile.data.eligibility === "rejected") {
    throw new Error("Your competitive eligibility was rejected. Contact moderation.");
  }
  if (profile.data.eligibility !== "eligible") {
    throw new Error("Your competitive eligibility is still pending review.");
  }

  const riot = await supabaseAdmin
    .from("riot_accounts")
    .select("id, data_verified")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!riot.data?.data_verified) {
    throw new Error("Connect your Riot account before registering.");
  }

  const tournament = await supabaseAdmin
    .from("tournaments")
    .select(
      "id, slug, name, status, division_id, region_id, max_participants, participants_count, registration_closes_at",
    )
    .eq("slug", tournamentSlug)
    .maybeSingle();
  if (tournament.error) throw new Error(tournament.error.message);
  if (!tournament.data) throw new Error("Tournament not found.");

  const t = tournament.data;
  if (t.status !== "registration_open") throw new Error("Registration is not open.");
  if (t.registration_closes_at && Date.parse(t.registration_closes_at) < Date.now()) {
    throw new Error("Registration has closed.");
  }
  if (t.division_id && t.division_id !== profile.data.division_id) {
    throw new Error("This bracket is for another division.");
  }
  if (t.region_id) {
    const geography = [
      profile.data.city_id,
      profile.data.province_id,
      profile.data.country_id,
      profile.data.region_id,
    ];
    if (!geography.includes(t.region_id)) {
      throw new Error("This bracket is restricted to another region.");
    }
  }

  const existing = await supabaseAdmin
    .from("tournament_entries")
    .select("id, status")
    .eq("tournament_id", t.id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing.data && existing.data.status !== "withdrawn") {
    throw new Error("You are already registered for this tournament.");
  }

  const { count } = await supabaseAdmin
    .from("tournament_entries")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", t.id)
    .in("status", ["registered", "checked_in"]);
  if ((count ?? 0) >= t.max_participants) throw new Error("This tournament is full.");

  const inserted = await supabaseAdmin
    .from("tournament_entries")
    .upsert(
      {
        ...(existing.data ? { id: existing.data.id } : {}),
        tournament_id: t.id,
        profile_id: profileId,
        status: "registered",
        seed: null,
        placement: null,
        points_awarded: 0,
        checked_in_at: null,
      },
      { onConflict: "id" },
    )
    .select("id, status")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);

  await supabaseAdmin
    .from("tournaments")
    .update({ participants_count: (count ?? 0) + 1 })
    .eq("id", t.id);

  return {
    entryId: inserted.data.id,
    status: inserted.data.status,
    tournamentSlug: t.slug,
    tournamentName: t.name,
  };
}

export async function checkInToTournament(userId: string, tournamentSlug: string) {
  const profileId = await ensureProfile(userId);

  const tournament = await supabaseAdmin
    .from("tournaments")
    .select("id, slug, status, starts_at")
    .eq("slug", tournamentSlug)
    .maybeSingle();
  if (!tournament.data) throw new Error("Tournament not found.");

  const startsAt = Date.parse(tournament.data.starts_at);
  const now = Date.now();
  if (now < startsAt - CHECK_IN_WINDOW_MS) throw new Error("Check-in has not opened yet.");
  if (now > startsAt) throw new Error("Check-in has closed.");

  const entry = await supabaseAdmin
    .from("tournament_entries")
    .select("id, status")
    .eq("tournament_id", tournament.data.id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!entry.data) throw new Error("You are not registered for this tournament.");
  if (entry.data.status !== "registered") throw new Error("This entry cannot be checked in.");

  const updated = await supabaseAdmin
    .from("tournament_entries")
    .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("id", entry.data.id)
    .select("id, status")
    .single();
  if (updated.error) throw new Error(updated.error.message);

  return { entryId: updated.data.id, status: updated.data.status };
}
