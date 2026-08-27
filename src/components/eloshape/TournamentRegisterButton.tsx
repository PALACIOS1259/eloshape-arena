import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
      <Button asChild>
        <Link to="/auth" search={{ mode: "signin" }}>
          Sign in to register
        </Link>
      </Button>
    );
  }

  if (entryQuery.isPending) {
    return (
      <Button variant="outline" disabled>
        Checking entry…
      </Button>
    );
  }

  const entry = entryQuery.data;

  if (entry?.status === "checked_in") {
    return (
      <Button variant="outline" disabled>
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
          onClick={() => (isTeam ? teamCheckInMutation.mutate() : soloCheckInMutation.mutate())}
          disabled={pending}
        >
          {pending ? "Checking in…" : isTeam ? "Check in team" : "Check in"}
        </Button>
      );
    }

    return (
      <Button variant="outline" disabled>
        {isTeam ? "Team registered" : "Registered"}
      </Button>
    );
  }

  if (status === "registration_open") {
    const pending = isTeam ? teamRegisterMutation.isPending : soloRegisterMutation.isPending;
    return (
      <Button
        onClick={() => (isTeam ? teamRegisterMutation.mutate() : soloRegisterMutation.mutate())}
        disabled={pending}
      >
        {pending ? "Registering…" : isTeam ? "Register team" : "Register"}
      </Button>
    );
  }

  return null;
}
