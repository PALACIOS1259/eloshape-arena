import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { divisionLabel, formatDateTime, riotRankLabel, winRate } from "@/lib/format";
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
  "Tu rango de Riot determina en qué división de EloShape podés participar. Los puntos se obtienen únicamente en torneos de EloShape.";

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
      toast.success("Cuenta de Riot vinculada. Datos de rango sincronizados.");
      invalidate();
    },
    onError: () => toast.error("La sincronización de Riot no está disponible temporalmente."),
  });

  const refresh = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.account.notice ?? "Datos de Riot actualizados.");
      invalidate();
    },
    onError: () => toast.error("La sincronización de Riot no está disponible temporalmente."),
  });

  return (
    <div className="border-y border-border/65 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Cuenta de Riot</p>
        {account ? (
          <Badge variant="outline" className="border-success/40 text-success">
            Cuenta de Riot vinculada
          </Badge>
        ) : null}
      </div>

      {!service.configured ? (
        <p className="mt-4 border-l-2 border-border pl-4 text-sm text-muted-foreground">
          La integración con Riot todavía no está configurada. Tu perfil y tu historial de torneos
          se conservan.
        </p>
      ) : !service.trustedWritesConfigured ? (
        <p className="mt-4 border-l-2 border-gold/35 pl-4 text-sm text-gold">
          La vinculación con Riot no está disponible en este entorno. Usá la web publicada de
          EloShape para conectar tu cuenta.
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
              label="Clasificatoria Solo/Dúo"
              value={
                account.ranked
                  ? `${riotRankLabel(account.ranked.tier, account.ranked.rank)} — ${account.ranked.leaguePoints} LP`
                  : "Sin rango"
              }
            />
            <Field
              label="Historial clasificatorio"
              value={
                account.ranked
                  ? `${account.ranked.wins} G / ${account.ranked.losses} P · ${winRate(account.ranked.wins, account.ranked.losses)}`
                  : "—"
              }
            />
            <Field
              label="División de EloShape"
              value={
                account.divisionName
                  ? divisionLabel({ code: account.divisionCode, name: account.divisionName })
                  : "Sin asignar"
              }
            />
            <Field
              label="Nivel de la cuenta de Riot"
              value={
                account.accountLevel !== null ? `Nivel ${account.accountLevel}` : "No disponible"
              }
            />
            <Field label="Última sincronización" value={formatDateTime(account.lastSyncedAt)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5 border-success/40 text-success">
              <ShieldCheck className="size-3.5" aria-hidden /> Rango sincronizado
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <ShieldQuestion className="size-3.5" aria-hidden />
              {account.ownershipVerified
                ? "Titularidad verificada por Riot"
                : "Verificación de titularidad no disponible"}
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
                  ? "Cumple el requisito de nivel 30"
                  : `Nivel ${account.accountLevel} — se requiere nivel 30`}
              </Badge>
            ) : null}
          </div>

          {account.notice ? (
            <p className="border-l-2 border-gold/35 pl-4 text-sm text-gold">{account.notice}</p>
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
            {refresh.isPending ? "Consultando Riot…" : "Actualizar datos de Riot"}
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
              <Label htmlFor="gameName">Nombre de juego</Label>
              <Input
                id="gameName"
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
                placeholder="NombreDeJugador"
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="tagLine">Etiqueta de Riot ID</Label>
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
              <Label>Servidor</Label>
              <p className="mt-2 flex h-10 items-center border-b border-border px-1 text-sm text-muted-foreground">
                LAS / LA2
              </p>
            </div>
          </div>
          <Button
            type="submit"
            disabled={connect.isPending || !service.configured || !service.trustedWritesConfigured}
          >
            {connect.isPending ? "Consultando Riot…" : "Vincular cuenta de Riot"}
          </Button>
        </form>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
