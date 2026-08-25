import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { checkInToTournament, registerForTournament } from "@/lib/tournament.functions";

/**
 * All validation (eligibility, division, region, capacity, duplicates) happens
 * server-side. This button only sends the tournament slug.
 */
export function TournamentRegisterButton({ slug, status }: { slug: string; status: string }) {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const register = useServerFn(registerForTournament);
  const checkIn = useServerFn(checkInToTournament);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tournament", slug] });
    void queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
  };

  const registerMutation = useMutation({
    mutationFn: () => register({ data: { slug } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Registered for ${result.entry.tournamentName}.`);
      invalidate();
    },
    onError: () => toast.error("Could not register for this tournament."),
  });

  const checkInMutation = useMutation({
    mutationFn: () => checkIn({ data: { slug } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Checked in.");
      invalidate();
    },
    onError: () => toast.error("Could not check in."),
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

  if (status === "registration_open") {
    return (
      <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
        {registerMutation.isPending ? "Registering…" : "Register"}
      </Button>
    );
  }

  if (status === "registration_closed") {
    return (
      <Button
        variant="outline"
        onClick={() => checkInMutation.mutate()}
        disabled={checkInMutation.isPending}
      >
        {checkInMutation.isPending ? "Checking in…" : "Check in"}
      </Button>
    );
  }

  return null;
}
