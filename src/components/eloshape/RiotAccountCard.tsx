import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, riotRankLabel, winRate } from "@/lib/format";
import { connectRiotAccount, refreshRiotAccount } from "@/lib/riot.functions";

type RiotAccount = {
  riotId: string;
  gameName: string;
  tagLine: string;
  platform: string;
  ranked: {
    tier: string;
    rank: string | null;
    leaguePoints: number;
    wins: number;
    losses: number;
    queueType: string | null;
  } | null;
  divisionCode: string | null;
  divisionName: string | null;
  tierSupported: boolean;
  accountLevel: number | null;
  accountLevelSyncedAt: string | null;
  dataVerified: boolean;
  ownershipVerified: boolean;
  verificationMethod: string;
  lastSyncedAt: string | null;
  eligibility: string;
  notice: string | null;
};

const HELPER_TEXT =
  "Your Riot rank determines which EloShape division you can enter. EloShape points come only from EloShape tournaments.";

export function RiotAccountCard({
  account,
  service,
}: {
  account: RiotAccount | null;
  service: { configured: boolean; trustedWritesConfigured: boolean; rsoEnabled: boolean };
}) {
  const queryClient = useQueryClient();
  const connectFn = useServerFn(connectRiotAccount);
  const refreshFn = useServerFn(refreshRiotAccount);
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("LAS");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
  };

  const connect = useMutation({
    mutationFn: () => connectFn({ data: { gameName, tagLine } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Riot account linked. Rank data synced.");
      invalidate();
    },
    onError: () => toast.error("Riot data sync is temporarily unavailable."),
  });

  const refresh = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.account.notice ?? "Riot data refreshed.");
      invalidate();
    },
    onError: () => toast.error("Riot data sync is temporarily unavailable."),
  });

  return (
    <div className="bg-surface-gradient shadow-card rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Riot account</p>
        {account ? (
          <Badge variant="outline" className="border-success/40 text-success">
            Riot account linked
          </Badge>
        ) : null}
      </div>

      {!service.configured ? (
        <p className="mt-4 rounded-md border border-border bg-surface/60 p-4 text-sm text-muted-foreground">
          Riot integration is not configured yet. Your EloShape profile and tournament history are
          unaffected.
        </p>
      ) : !service.trustedWritesConfigured ? (
        <p className="mt-4 rounded-md border border-gold/30 bg-gold/10 p-4 text-sm text-gold">
          Riot lookups are configured, but secure Riot linking is unavailable in this local
          environment because the trusted database credential is intentionally not exposed. Use the
          published EloShape app for real account linking.
        </p>
      ) : null}

      {account ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-lg font-black tracking-tight text-foreground">{account.riotId}</p>
            <p className="eyebrow mt-1">
              {account.platform} · {account.platform === "LA2" ? "LAS" : account.platform}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Solo Queue"
              value={
                account.ranked
                  ? `${riotRankLabel(account.ranked.tier, account.ranked.rank)} — ${account.ranked.leaguePoints} LP`
                  : "Unranked"
              }
            />
            <Field
              label="Ranked record"
              value={
                account.ranked
                  ? `${account.ranked.wins} W / ${account.ranked.losses} L · ${winRate(account.ranked.wins, account.ranked.losses)}`
                  : "—"
              }
            />
            <Field label="EloShape division" value={account.divisionName ?? "Not assigned"} />
            <Field
              label="Riot account level"
              value={account.accountLevel !== null ? `Level ${account.accountLevel}` : "Unavailable"}
            />
            <Field label="Last synced" value={formatDateTime(account.lastSyncedAt)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5 border-success/40 text-success">
              <ShieldCheck className="size-3.5" aria-hidden /> Rank data synced
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <ShieldQuestion className="size-3.5" aria-hidden />
              {account.ownershipVerified
                ? "Ownership verified via Riot"
                : "Ownership verification unavailable"}
            </Badge>
            {account.accountLevel !== null ? (
              <Badge
                variant="outline"
                className={
                  account.accountLevel >= 30
                    ? "border-success/40 text-success"
                    : "border-destructive/40 text-destructive"
                }
              >
                {account.accountLevel >= 30
                  ? "Level 30 requirement met"
                  : `Level ${account.accountLevel} — level 30 required`}
              </Badge>
            ) : null}
          </div>

          {account.notice ? (
            <p className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
              {account.notice}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">{HELPER_TEXT}</p>

          <Button
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || !service.configured || !service.trustedWritesConfigured}
          >
            <RefreshCw
              className={refresh.isPending ? "size-4 animate-spin" : "size-4"}
              aria-hidden
            />
            {refresh.isPending ? "Checking Riot…" : "Refresh Riot data"}
          </Button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!connect.isPending) connect.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">{HELPER_TEXT}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <Label htmlFor="gameName">Game name</Label>
              <Input
                id="gameName"
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
                placeholder="PlayerName"
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="tagLine">Tag line</Label>
              <Input
                id="tagLine"
                value={tagLine}
                onChange={(event) => setTagLine(event.target.value)}
                placeholder="LAS"
                className="mt-2 sm:w-28"
                required
              />
            </div>
            <div>
              <Label>Server</Label>
              <p className="mt-2 flex h-10 items-center rounded-md border border-border px-3 text-sm text-muted-foreground">
                LAS / LA2
              </p>
            </div>
          </div>
          <Button
            type="submit"
            disabled={connect.isPending || !service.configured || !service.trustedWritesConfigured}
          >
            {connect.isPending ? "Checking Riot…" : "Connect Riot account"}
          </Button>
        </form>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface/40 p-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
