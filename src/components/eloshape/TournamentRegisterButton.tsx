import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, LoaderCircle, LogIn, ShieldCheck, Swords } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { checkInMyTeamToTournament, registerMyTeamForTournament } from "@/lib/team.functions";
import {
  checkInToTournament,
  getMyTournamentEntry,
  registerForTournament,
} from "@/lib/tournament.functions";

/**
 * All validation (eligibility, roster, division, region, capacity, duplicates)
 * happens server-side. The browser only sends the tournament slug.
 */
export function TournamentRegisterButton({
  slug,
  status,
  mode,
}: {
  slug: string;
  status: string;
  mode?: string;
}) {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const registerSolo = useServerFn(registerForTournament);
  const checkInSolo = useServerFn(checkInToTournament);
  const registerTeam = useServerFn(registerMyTeamForTournament);
  const checkInTeam = useServerFn(checkInMyTeamToTournament);
  const getEntry = useServerFn(getMyTournamentEntry);

  const entryQuery = useQuery({
    queryKey: ["my-tournament-entry", slug],
    queryFn: () => getEntry({ data: { slug } }),
    enabled: Boolean(session),
    retry: false,
  });

  const effectiveMode = mode ?? entryQuery.data?.mode ?? "solo";
  const isTeam = effectiveMode === "team";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tournament", slug] });
    void queryClient.invalidateQueries({ queryKey: ["my-tournament-entry", slug] });
    void queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
  };

  const soloRegisterMutation = useMutation({
    mutationFn: () => registerSolo({ data: { slug } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Registered for ${result.entry.tournamentName}.`);
      invalidate();
    },
    onError: () => {
      toast.error("Could not register for this tournament.");
    },
  });

  const teamRegisterMutation = useMutation({
    mutationFn: () => registerTeam({ data: { slug } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Team registered.");
      invalidate();
    },
    onError: () => {
      toast.error("Could not register your team.");
    },
  });

  const soloCheckInMutation = useMutation({
    mutationFn: () => checkInSolo({ data: { slug } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Checked in.");
      invalidate();
    },
    onError: () => {
      toast.error("Could not check in.");
    },
  });

  const teamCheckInMutation = useMutation({
    mutationFn: () => checkInTeam({ data: { slug } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Team checked in.");
      invalidate();
    },
    onError: () => {
      toast.error("Could not check in your team.");
    },
  });

  if (loading) return null;

  if (!session) {
    return (
      <Button
        asChild
        className="group h-11 rounded-xl px-5 font-black shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <Link to="/auth" search={{ mode: "signin" }}>
          <LogIn className="size-4 transition-transform group-hover:translate-x-0.5" />
          Sign in to compete
        </Link>
      </Button>
    );
  }

  if (entryQuery.isPending) {
    return (
      <Button variant="outline" disabled className="h-11 rounded-xl px-5 font-black">
        <LoaderCircle className="size-4 animate-spin" />
        Checking eligibility…
      </Button>
    );
  }

  const entry = entryQuery.data;

  if (entry?.status === "checked_in") {
    return (
      <Button
        variant="outline"
        disabled
        className="h-11 rounded-xl border-primary/25 bg-primary/8 px-5 font-black text-primary opacity-100"
      >
        <Check className="size-4" />
        {isTeam ? "Team checked in" : "Checked in"}
      </Button>
    );
  }

  if (entry?.status === "registered") {
    if (entry.canCheckIn) {
      const pending = isTeam ? teamCheckInMutation.isPending : soloCheckInMutation.isPending;
      return (
        <Button
          variant="outline"
          className="group h-11 rounded-xl border-primary/30 bg-primary/8 px-5 font-black text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/12"
          onClick={() => (isTeam ? teamCheckInMutation.mutate() : soloCheckInMutation.mutate())}
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {pending ? "Checking in…" : isTeam ? "Check in team" : "Check in now"}
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        disabled
        className="h-11 rounded-xl border-gold/25 bg-gold/8 px-5 font-black text-gold opacity-100"
      >
        <Check className="size-4" />
        {isTeam ? "Team registered" : "Registered"}
      </Button>
    );
  }

  if (status === "registration_open") {
    const pending = isTeam ? teamRegisterMutation.isPending : soloRegisterMutation.isPending;
    return (
      <Button
        className="group h-11 rounded-xl px-5 font-black shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
        onClick={() => (isTeam ? teamRegisterMutation.mutate() : soloRegisterMutation.mutate())}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Swords className="size-4 transition-transform group-hover:rotate-6" />
        )}
        {pending ? "Registering…" : isTeam ? "Register my team" : "Enter tournament"}
      </Button>
    );
  }

  return null;
}
