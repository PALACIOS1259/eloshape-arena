import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  Check,
  Clock3,
  Gamepad2,
  Handshake,
  LoaderCircle,
  ShieldCheck,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";
import {
  cancelMyScrim,
  challengeScrim,
  createMyScrim,
  getMyScrimHub,
  listScrims,
  reportMyScrimResult,
  respondScrimChallenge,
  type ScrimHub,
  type ScrimPost,
} from "@/lib/scrim.functions";
import { cn } from "@/lib/utils";

export function ScrimBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const list = useServerFn(listScrims);
  const getHub = useServerFn(getMyScrimHub);

  const scrimsQuery = useQuery({
    queryKey: ["scrims"],
    queryFn: () => list(),
  });
  const hubQuery = useQuery({
    queryKey: ["my-scrim-hub"],
    queryFn: () => getHub(),
    enabled: Boolean(user),
    retry: false,
  });

  const scrims = scrimsQuery.data ?? [];
  const hub = hubQuery.data;
  const myTeam = hub?.team ?? null;
  const isCaptain = Boolean(myTeam?.isCaptain);

  const outgoingByScrim = useMemo(
    () => new Map((hub?.outgoingChallenges ?? []).map((row) => [row.scrimId, row])),
    [hub?.outgoingChallenges],
  );

  const openCount = scrims.filter((scrim) => scrim.status === "open").length;
  const matchedCount = scrims.filter((scrim) => scrim.status === "matched").length;
  const completedCount = scrims.filter((scrim) => scrim.status === "completed").length;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["scrims"] });
    void queryClient.invalidateQueries({ queryKey: ["my-scrim-hub"] });
  };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/95 via-card/80 to-primary/[0.035] p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Buscar partidas de práctica</p>
              <Badge variant="outline">Solo práctica</Badge>
              <Badge variant="secondary">Sin puntos del circuito</Badge>
            </div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Encontrá una partida de práctica
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Publicá un horario, desafiá a otro plantel y guardá el resultado como historial de
              práctica. No modifica la clasificación oficial, los cupos ni el orden de los
              Semi-Splits.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <ScrimMetric label="Abierto" value={openCount} />
            <ScrimMetric label="Emparejado" value={matchedCount} />
            <ScrimMetric label="Jugado" value={completedCount} gold />
          </div>
        </div>
      </section>

      {user ? (
        hubQuery.isPending ? (
          <div className="rounded-2xl border border-border bg-background/30 p-5 text-sm text-muted-foreground">
            Cargando tus controles de práctica…
          </div>
        ) : isCaptain ? (
          <CreateScrimCard invalidate={invalidate} />
        ) : (
          <div className="rounded-2xl border border-border bg-background/30 p-5">
            <p className="font-black text-foreground">
              {myTeam
                ? "Los controles de capitán están bloqueados"
                : "Primero unite a un equipo o creá uno"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {myTeam
                ? "Podés consultar las propuestas, pero solo tu capitán puede publicar o desafiar a otro equipo."
                : "Las prácticas son entre equipos. Armá un plantel antes de publicar disponibilidad."}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/team">
                {myTeam ? "Abrir panel del equipo" : "Crear un equipo o unirse"}
              </Link>
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/30 p-5">
          <div>
            <p className="font-black text-foreground">¿Querés desafiar a un equipo?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Iniciá sesión con un plantel para publicar disponibilidad y enviar desafíos.
            </p>
          </div>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signin" }}>
              Iniciar sesión
            </Link>
          </Button>
        </div>
      )}

      {isCaptain && hub?.incomingChallenges.length ? (
        <IncomingChallenges challenges={hub.incomingChallenges} invalidate={invalidate} />
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Tablero de práctica</p>
            <h3 className="mt-1 text-2xl font-black text-foreground">Prácticas disponibles</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Primero se muestran las propuestas abiertas, luego las emparejadas y las prácticas
              completadas recientemente.
            </p>
          </div>
          <Badge variant="outline">{scrims.length} publicaciones</Badge>
        </div>

        {scrimsQuery.isPending ? (
          <div className="mt-5 rounded-2xl border border-border bg-background/30 p-8 text-center text-sm text-muted-foreground">
            Cargando tablero de práctica…
          </div>
        ) : scrims.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {scrims.map((scrim) => (
              <ScrimCard
                key={scrim.id}
                scrim={scrim}
                myTeamId={myTeam?.id ?? null}
                isCaptain={isCaptain}
                outgoingStatus={outgoingByScrim.get(scrim.id)?.status ?? null}
                invalidate={invalidate}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              title="Todavía no hay prácticas publicadas"
              description="El primer capitán que publique disponibilidad aparecerá acá."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function CreateScrimCard({ invalidate }: { invalidate: () => void }) {
  const create = useServerFn(createMyScrim);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          bestOf,
          note,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Disponibilidad de práctica publicada.");
      setStartsAt("");
      setEndsAt("");
      setNote("");
      invalidate();
    },
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.035] shadow-card">
      <div className="flex items-center gap-3 border-b border-primary/15 px-5 py-4">
        <span className="grid size-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <CalendarClock className="size-4" />
        </span>
        <div>
          <p className="font-black text-foreground">Publicar un horario de práctica</p>
          <p className="text-xs text-muted-foreground">
            Otros capitanes podrán desafiar a tu equipo para este horario.
          </p>
        </div>
      </div>
      <div className="grid gap-3 p-5 lg:grid-cols-[1fr_1fr_8rem_minmax(0,1.2fr)_auto] lg:items-end">
        <label className="space-y-2 text-xs font-semibold text-foreground">
          Inicio
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-xs font-semibold text-foreground">
          Fin <span className="font-normal text-muted-foreground">(opcional)</span>
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-xs font-semibold text-foreground">
          Formato
          <select
            value={bestOf}
            onChange={(event) => setBestOf(Number(event.target.value) as 1 | 3 | 5)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={1}>Bo1</option>
            <option value={3}>Bo3</option>
            <option value={5}>Bo5</option>
          </select>
        </label>
        <label className="space-y-2 text-xs font-semibold text-foreground">
          Nota
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={240}
            placeholder="Práctica para torneo · comunicación seria"
          />
        </label>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!startsAt || mutation.isPending}
          className="font-black"
        >
          {mutation.isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Gamepad2 className="size-4" />
          )}
          Publicar
        </Button>
      </div>
    </section>
  );
}

function IncomingChallenges({
  challenges,
  invalidate,
}: {
  challenges: ScrimHub["incomingChallenges"];
  invalidate: () => void;
}) {
  const respond = useServerFn(respondScrimChallenge);
  const mutation = useMutation({
    mutationFn: (input: { challengeId: string; accept: boolean }) => respond({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.status === "matched" ? "Práctica emparejada." : "Desafío rechazado.",
      );
      invalidate();
    },
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-gold/25 bg-gold/[0.035] shadow-card">
      <div className="border-b border-gold/15 px-5 py-4">
        <p className="eyebrow text-gold">Desafíos recibidos</p>
        <h3 className="mt-1 text-lg font-black text-foreground">
          Equipos interesados en tu horario
        </h3>
      </div>
      <div className="divide-y divide-border/70">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <div>
              <Link
                to="/teams/$slug"
                params={{ slug: challenge.challenger.slug }}
                className="font-black text-foreground hover:text-primary"
              >
                [{challenge.challenger.tag}] {challenge.challenger.name}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                Desafío enviado {formatDateTime(challenge.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => mutation.mutate({ challengeId: challenge.id, accept: true })}
                disabled={mutation.isPending}
              >
                <Check className="size-4" /> Aceptar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => mutation.mutate({ challengeId: challenge.id, accept: false })}
                disabled={mutation.isPending}
              >
                <X className="size-4" /> Rechazar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScrimCard({
  scrim,
  myTeamId,
  isCaptain,
  outgoingStatus,
  invalidate,
}: {
  scrim: ScrimPost;
  myTeamId: string | null;
  isCaptain: boolean;
  outgoingStatus: string | null;
  invalidate: () => void;
}) {
  const challenge = useServerFn(challengeScrim);
  const cancel = useServerFn(cancelMyScrim);
  const report = useServerFn(reportMyScrimResult);
  const [scoreHost, setScoreHost] = useState("");
  const [scoreOpponent, setScoreOpponent] = useState("");

  const isHost = myTeamId === scrim.team.id;
  const isOpponent = myTeamId != null && myTeamId === scrim.opponent?.id;
  const isParticipant = isHost || isOpponent;

  const challengeMutation = useMutation({
    mutationFn: () => challenge({ data: { scrimId: scrim.id } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Desafío enviado.");
      invalidate();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancel({ data: { scrimId: scrim.id } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Práctica cancelada.");
      invalidate();
    },
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      report({
        data: {
          scrimId: scrim.id,
          scoreTeam: Number(scoreHost),
          scoreOpponent: Number(scoreOpponent),
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Resultado de práctica guardado.");
      invalidate();
    },
  });

  const statusLabel =
    scrim.status === "open"
      ? "Buscando rival"
      : scrim.status === "matched"
        ? "Emparejado"
        : "Jugado";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface-gradient shadow-card",
        scrim.status === "open" && "border-primary/20",
        scrim.status === "completed" && "opacity-90",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/25 px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant={scrim.status === "open" ? "default" : "outline"}>{statusLabel}</Badge>
          <Badge variant="secondary">Mejor de{scrim.bestOf}</Badge>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Clock3 className="size-3.5" />
          {formatDateTime(scrim.startsAt)}
        </span>
      </div>

      <div className="p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <TeamSide team={scrim.team} winner={scrim.winnerTeamId === scrim.team.id} />
          <span className="mx-auto grid size-10 place-items-center rounded-full border border-border bg-background/40 text-[10px] font-black text-muted-foreground">
            VS
          </span>
          {scrim.opponent ? (
            <TeamSide
              team={scrim.opponent}
              winner={scrim.winnerTeamId === scrim.opponent.id}
              right
            />
          ) : (
            <div className="text-center sm:text-right">
              <p className="font-black text-muted-foreground">Horario disponible</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {scrim.challengeCount} desafío pendiente{scrim.challengeCount === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>

        {scrim.note ? (
          <p className="mt-4 border-l-2 border-primary/25 pl-3 text-xs leading-relaxed text-muted-foreground">
            {scrim.note}
          </p>
        ) : null}

        {scrim.status === "completed" ? (
          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
            <Trophy className="size-4 text-gold" />
            <span className="text-sm font-black tabular-nums text-foreground">
              {scrim.scoreTeam} – {scrim.scoreOpponent}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              Resultado de práctica
            </span>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Los resultados de práctica no afectan la clasificación oficial de EloShape.
          </p>

          <div className="flex flex-wrap gap-2">
            {scrim.status === "open" && isCaptain && !isHost ? (
              <Button
                size="sm"
                onClick={() => challengeMutation.mutate()}
                disabled={challengeMutation.isPending || outgoingStatus === "pending"}
              >
                {challengeMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Handshake className="size-4" />
                )}
                {outgoingStatus === "pending" ? "Desafío enviado" : "Desafiar al equipo"}
              </Button>
            ) : null}

            {isCaptain && isHost && scrim.status !== "completed" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>

        {scrim.status === "matched" && isCaptain && isParticipant ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4 sm:grid-cols-[1fr_5rem_5rem_auto] sm:items-end">
            <div>
              <p className="text-xs font-black text-foreground">Guardar resultado de práctica</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                El marcador siempre se muestra como {scrim.team.tag} vs {scrim.opponent?.tag}.
              </p>
            </div>
            <Input
              type="number"
              min={0}
              value={scoreHost}
              onChange={(event) => setScoreHost(event.target.value)}
              aria-label={scrim.team.name + " marcador"}
              placeholder="0"
            />
            <Input
              type="number"
              min={0}
              value={scoreOpponent}
              onChange={(event) => setScoreOpponent(event.target.value)}
              aria-label={(scrim.opponent?.name ?? "Rival") + " marcador"}
              placeholder="0"
            />
            <Button
              size="sm"
              onClick={() => reportMutation.mutate()}
              disabled={!scoreHost || !scoreOpponent || reportMutation.isPending}
            >
              <Swords className="size-4" />
              Guardar
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function TeamSide({
  team,
  winner,
  right = false,
}: {
  team: ScrimPost["team"];
  winner: boolean;
  right?: boolean;
}) {
  const meta = ["[" + team.tag + "]", team.division?.name ?? null, winner ? "Ganador" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex items-center gap-3", right && "sm:flex-row-reverse sm:text-right")}>
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background/40 text-xs font-black text-primary",
          winner && "border-gold/30 bg-gold/10 text-gold",
        )}
      >
        {team.logoUrl ? (
          <img src={team.logoUrl} alt="" className="size-full object-cover" />
        ) : (
          team.tag
        )}
      </span>
      <div className="min-w-0">
        <Link
          to="/teams/$slug"
          params={{ slug: team.slug }}
          className="block truncate font-black text-foreground hover:text-primary"
        >
          {team.name}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function ScrimMetric({
  label,
  value,
  gold = false,
}: {
  label: string;
  value: number;
  gold?: boolean;
}) {
  return (
    <div className="min-w-14">
      <p className={cn("text-lg font-black tabular-nums text-foreground", gold && "text-gold")}>
        {value}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
