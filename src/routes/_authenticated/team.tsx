import { divisionLabel, statusLabel } from "@/lib/format";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Crown,
  ExternalLink,
  Search,
  ShieldCheck,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  TEAM_LANES,
  TeamLaneBadge,
  TeamLaneIcon,
  type TeamLaneRole,
} from "@/components/eloshape/TeamLaneRole";
import { TeamWorkspaceNav } from "@/components/eloshape/TeamWorkspaceNav";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  transferMyTeamCaptain,
  updateMyTeamMemberLaneRole,
  updateMyTeamMemberRole,
} from "@/lib/team-management.functions";
import {
  cancelMyTeamInvite,
  createMyTeam,
  getMyTeamHub,
  inviteMyTeamMember,
  leaveMyTeam,
  removeMyTeamMember,
  respondMyTeamInvite,
  type TeamHub,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Panel del equipo — EloShape" },
      {
        name: "description",
        content: "Armá, organizá y prepará tu plantel de EloShape para competir 5 contra 5.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamHubPage,
});

function TeamHubPage() {
  const getHub = useServerFn(getMyTeamHub);
  const { data, isPending, error } = useQuery({
    queryKey: ["my-team-hub"],
    queryFn: () => getHub(),
    retry: false,
  });

  return (
    <div>
      <PageHeading
        eyebrow="EloShape 5 contra 5"
        title="Panel del equipo"
        description="Armá los cinco titulares, asigná posiciones, reclutá suplentes y revisá qué necesita tu plantel antes de competir."
        aside={
          data?.team ? (
            <Button asChild variant="outline">
              <Link to="/teams/$slug" params={{ slug: data.team.slug }}>
                <ExternalLink className="mr-2 size-4" /> Perfil público
              </Link>
            </Button>
          ) : undefined
        }
      />

      <PageContainer className="py-7 sm:py-9">
        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : error || !data ? (
          <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            No se pudo cargar el espacio de tu equipo.
          </div>
        ) : (
          <TeamHubContent hub={data} />
        )}
      </PageContainer>
    </div>
  );
}

function TeamHubContent({ hub }: { hub: TeamHub }) {
  return (
    <div className="space-y-6">
      <TeamWorkspaceNav
        active="overview"
        hasTeam={Boolean(hub.team)}
        isCaptain={Boolean(hub.team?.isCaptain)}
      />

      {hub.incomingInvites.length ? <IncomingInvites invites={hub.incomingInvites} /> : null}
      {hub.team ? <ExistingTeam hub={hub} /> : <CreateTeamExperience />}
    </div>
  );
}

function IncomingInvites({ invites }: { invites: TeamHub["incomingInvites"] }) {
  const queryClient = useQueryClient();
  const respond = useServerFn(respondMyTeamInvite);
  const mutation = useMutation({
    mutationFn: (input: { inviteId: string; accept: boolean }) => respond({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitación de equipo actualizada.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.035]">
      <div className="flex items-center gap-3 border-b border-primary/20 px-4 py-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <UserPlus className="size-4" />
        </span>
        <div>
          <p className="text-sm font-black text-foreground">Tenés una invitación de equipo</p>
          <p className="text-xs text-muted-foreground">
            Aceptar una invitación te agrega inmediatamente a ese plantel.
          </p>
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{invite.teamTag}</Badge>
                <p className="truncate font-black text-foreground">{invite.teamName}</p>
                <Badge variant={invite.role === "player" ? "default" : "secondary"}>
                  {invite.role === "substitute" ? "Suplente" : "Titular"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Invitado por {invite.invitedBy ?? "el capitán del equipo"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => mutation.mutate({ inviteId: invite.id, accept: true })}
                disabled={mutation.isPending}
              >
                Aceptar invitación
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => mutation.mutate({ inviteId: invite.id, accept: false })}
                disabled={mutation.isPending}
              >
                Rechazar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateTeamExperience() {
  const queryClient = useQueryClient();
  const create = useServerFn(createMyTeam);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const mutation = useMutation({
    mutationFn: () => create({ data: { name, tag } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Equipo creado. Sos el capitán.");
      setName("");
      setTag("");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  const previewName = name.trim() || "Tu equipo";
  const previewTag = tag.trim().toUpperCase() || "TAG";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_minmax(0,0.9fr)]">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/90 to-background/55 p-5 sm:p-6">
        <p className="eyebrow">Creá tu plantel</p>
        <h2 className="mt-2 max-w-xl text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Armá el equipo con el que querés competir.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Elegí su identidad. Después podrás reclutar jugadores, asignar superior, jungla, central,
          tirador y soporte, y preparar el plantel para los torneos de EloShape.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Nombre del equipo</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Golden Nest eSports"
              maxLength={40}
            />
            <span className="block text-xs text-muted-foreground">De 3 a 40 caracteres</span>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Sigla del equipo</span>
            <Input
              value={tag}
              onChange={(event) => setTag(event.target.value.toUpperCase())}
              placeholder="NGE"
              maxLength={6}
            />
            <span className="block text-xs text-muted-foreground">De 2 a 6 caracteres</span>
          </label>
        </div>

        <Button
          className="mt-5"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim() || !tag.trim()}
        >
          {mutation.isPending ? "Creando equipo…" : "Crear equipo"}
        </Button>
      </section>

      <aside className="space-y-4">
        <div className="border-t border-border/60 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="eyebrow">Vista previa de la identidad</p>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-lg font-black text-primary">
              {previewTag.slice(0, 6)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-black text-foreground">{previewName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                [{previewTag}] · EloShape 5 contra 5
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/30 p-5">
          <p className="eyebrow">Qué sigue</p>
          <div className="mt-4 space-y-4">
            {[
              [
                "1",
                "Reclutá a tus cinco jugadores",
                "Buscá jugadores libres o invitá amigos por su nombre de usuario.",
              ],
              ["2", "Definí la formación", "Asigná una posición de juego distinta a cada titular."],
              [
                "3",
                "Preparate para el torneo",
                "Riot y la elegibilidad se verifican automáticamente.",
              ],
            ].map(([step, title, description]) => (
              <div key={step} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 text-xs font-black text-primary">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ExistingTeam({ hub }: { hub: TeamHub }) {
  const team = hub.team!;
  const starters = team.members.filter((member) => member.role !== "substitute");
  const substitutes = team.members.filter((member) => member.role === "substitute");
  const assignedRoles = starters.filter((member) => member.laneRole).length;
  const uniqueRoles = new Set(
    starters.flatMap((member) => (member.laneRole ? [member.laneRole] : [])),
  ).size;

  return (
    <div className="space-y-6">
      <TeamIdentityHero
        team={team}
        starters={starters.length}
        substitutes={substitutes.length}
        assignedRoles={assignedRoles}
      />

      <ReadinessPanel team={team} starters={starters} uniqueRoles={uniqueRoles} />
      <StartingLineup team={team} starters={starters} />
      <RosterManagement team={team} />
      {team.isCaptain ? <CaptainRecruiting team={team} /> : <MemberTools />}
    </div>
  );
}

function TeamIdentityHero({
  team,
  starters,
  substitutes,
  assignedRoles,
}: {
  team: NonNullable<TeamHub["team"]>;
  starters: number;
  substitutes: number;
  assignedRoles: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/90 to-background/55 p-5 sm:p-6">
      <div className="absolute right-0 top-0 size-48 translate-x-16 -translate-y-20 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 text-lg font-black text-primary shadow-sm sm:size-20">
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={team.name} className="size-full object-cover" />
            ) : (
              team.tag
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">[{team.tag}]</Badge>
              {team.division ? <Badge>{divisionLabel(team.division)}</Badge> : null}
              {team.city ? <Badge variant="outline">{team.city.name}</Badge> : null}
              {team.isCaptain ? (
                <Badge variant="secondary">
                  <Crown className="mr-1 size-3" /> Vista del capitán
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-3 truncate text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {team.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {team.bio ||
                "Tu plantel competitivo, preparación y controles de reclutamiento están acá."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {team.isCaptain ? (
            <Button asChild>
              <Link to="/team/players">
                <Search className="mr-2 size-4" /> Reclutar jugadores
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/teams/$slug" params={{ slug: team.slug }}>
              Perfil público
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <HeroStat label="Puntos de temporada" value={String(team.pointsSeason)} />
        <HeroStat label="Historial" value={`${team.wins}-${team.losses}`} />
        <HeroStat
          label="Títulos"
          value={String(team.championships)}
          icon={<Trophy className="size-4" />}
        />
        <HeroStat label="Titulares" value={`${starters}/5`} />
        <HeroStat label="Posiciones" value={`${assignedRoles}/5`} />
        <HeroStat label="Suplentes" value={String(substitutes)} />
      </div>
    </section>
  );
}

function HeroStat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/25 p-3">
      <p className="flex items-center gap-1.5 text-lg font-black tabular-nums text-foreground">
        {icon}
        {value}
      </p>
      <p className="eyebrow mt-1">{label}</p>
    </div>
  );
}

function ReadinessPanel({
  team,
  starters,
  uniqueRoles,
}: {
  team: NonNullable<TeamHub["team"]>;
  starters: NonNullable<TeamHub["team"]>["members"];
  uniqueRoles: number;
}) {
  const assignedRoles = starters.filter((member) => member.laneRole).length;
  const checks = [
    {
      label: "Los cinco titulares",
      done: starters.length === 5,
      detail: `${starters.length}/5 titulares seleccionados`,
    },
    {
      label: "Posiciones de juego",
      done: starters.length === 5 && assignedRoles === 5 && uniqueRoles === 5,
      detail:
        assignedRoles === 5 && uniqueRoles === 5
          ? "Superior, Jungla, Central, ADC y Soporte cubiertos"
          : `${assignedRoles}/5 asignados · ${uniqueRoles}/5 distintos`,
    },
    {
      label: "Verificación de Riot",
      done: starters.length === 5 && starters.every((member) => member.riotVerified),
      detail: `${starters.filter((member) => member.riotVerified).length}/${starters.length || 5} verificados`,
    },
    {
      label: "Elegibilidad competitiva",
      done: starters.length === 5 && starters.every((member) => member.eligibility === "eligible"),
      detail: `${starters.filter((member) => member.eligibility === "eligible").length}/${starters.length || 5} elegibles`,
    },
    {
      label: "Nivel de cuenta",
      done:
        starters.length === 5 &&
        starters.every((member) => member.accountLevel != null && member.accountLevel >= 30),
      detail: `${starters.filter((member) => (member.accountLevel ?? 0) >= 30).length}/${starters.length || 5} de nivel 30 o más`,
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-background/25 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Preparación competitiva</p>
          <h3 className="mt-1 text-xl font-black text-foreground">¿Está listo este plantel?</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            EloShape vuelve a validar el plantel al inscribirse y confirmar asistencia. Esta vista
            muestra los problemas más importantes antes del día del torneo.
          </p>
        </div>
        <Badge className="w-fit" variant={team.eligibility.eligible ? "default" : "outline"}>
          {team.eligibility.eligible ? (
            <>
              <CheckCircle2 className="mr-1 size-3.5" /> Habilitado para torneos
            </>
          ) : (
            <>
              <CircleAlert className="mr-1 size-3.5" /> Requiere atención
            </>
          )}
        </Badge>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`rounded-lg border p-3 ${
              check.done ? "border-primary/20 bg-primary/5" : "border-border bg-background/35"
            }`}
          >
            <div className="flex items-center gap-2">
              {check.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-muted-foreground" />
              )}
              <p className="text-sm font-bold text-foreground">{check.label}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StartingLineup({
  team,
  starters,
}: {
  team: NonNullable<TeamHub["team"]>;
  starters: NonNullable<TeamHub["team"]>["members"];
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Los cinco titulares</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Alineación</h3>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          Cada posición debe tener un titular. Acá podés detectar posiciones vacías o duplicadas.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {TEAM_LANES.map((lane) => {
          const assigned = starters.filter((member) => member.laneRole === lane.value);
          const member = assigned[0];
          const duplicate = assigned.length > 1;

          return (
            <div
              key={lane.value}
              className={`min-h-40 rounded-xl border p-4 ${
                member ? "bg-card/35" : "border-dashed bg-background/20"
              } ${duplicate ? "border-destructive/45" : "border-border/70"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <TeamLaneIcon role={lane.value} />
                <span className="eyebrow">{lane.short}</span>
              </div>
              <p className="mt-3 font-black text-foreground">{lane.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{lane.description}</p>

              {member ? (
                <div className="mt-4 border-t border-border pt-3">
                  <Link
                    to="/players/$handle"
                    params={{ handle: member.handle }}
                    className="block truncate text-sm font-bold text-foreground hover:text-brand"
                  >
                    {member.displayName}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">@{member.handle}</p>
                  {member.isCaptain ? (
                    <Badge className="mt-2" variant="secondary">
                      <Crown className="mr-1 size-3" /> Capitán
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Sin titular asignado
                </div>
              )}

              {duplicate ? (
                <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-destructive">
                  <CircleAlert className="size-3.5" /> {assigned.length} titulares ocupan esta
                  posición
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {team.isCaptain ? (
        <div className="mt-3 flex justify-end">
          <Button asChild size="sm" variant="outline">
            <a href="#roster-management">
              Editar alineación <ChevronRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function RosterManagement({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const updateRole = useServerFn(updateMyTeamMemberRole);
  const updateLaneRole = useServerFn(updateMyTeamMemberLaneRole);
  const transferCaptain = useServerFn(transferMyTeamCaptain);
  const remove = useServerFn(removeMyTeamMember);
  const starters = team.members.filter((member) => member.role !== "substitute");
  const substitutes = team.members.filter((member) => member.role === "substitute");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };

  const roleMutation = useMutation({
    mutationFn: (input: { handle: string; role: "player" | "substitute" }) =>
      updateRole({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Estado del plantel actualizado.");
      refresh();
    },
  });

  const laneMutation = useMutation({
    mutationFn: (input: { handle: string; laneRole: TeamLaneRole | null }) =>
      updateLaneRole({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Posición de juego actualizada.");
      refresh();
    },
  });

  const captainMutation = useMutation({
    mutationFn: (handle: string) => transferCaptain({ data: { handle } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Capitanía transferida.");
      refresh();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (handle: string) => remove({ data: { handle } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Jugador retirado del plantel.");
      refresh();
    },
  });

  const busy =
    roleMutation.isPending ||
    laneMutation.isPending ||
    captainMutation.isPending ||
    removeMutation.isPending;

  return (
    <section id="roster-management" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Gestión del plantel</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Jugadores y suplentes</h3>
        </div>
        {team.isCaptain ? (
          <Button asChild size="sm">
            <Link to="/team/players">
              <UserPlus className="mr-2 size-4" /> Agregar jugador
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <RosterGroup
          title="Plantel titular"
          description="Estos cinco jugadores se usan para validar la elegibilidad del equipo en los torneos."
          members={starters}
          empty="Todavía no hay titulares."
          team={team}
          busy={busy}
          onLaneRole={(handle, laneRole) => laneMutation.mutate({ handle, laneRole })}
          onRosterRole={(handle, role) => roleMutation.mutate({ handle, role })}
          onCaptain={(member) => {
            if (window.confirm(`¿Transferir la capitanía del equipo a ${member.displayName}?`)) {
              captainMutation.mutate(member.handle);
            }
          }}
          onRemove={(member) => {
            if (window.confirm(`¿Quitar a ${member.displayName} del equipo?`)) {
              removeMutation.mutate(member.handle);
            }
          }}
        />

        <RosterGroup
          title="Suplentes"
          description="Los suplentes permanecen en el equipo sin ocupar un lugar de titular."
          members={substitutes}
          empty={
            team.isCaptain
              ? "Todavía no hay suplentes. Reclutá refuerzos para el día del torneo."
              : "Sin suplentes."
          }
          team={team}
          busy={busy}
          onLaneRole={(handle, laneRole) => laneMutation.mutate({ handle, laneRole })}
          onRosterRole={(handle, role) => roleMutation.mutate({ handle, role })}
          onCaptain={(member) => {
            if (window.confirm(`¿Transferir la capitanía del equipo a ${member.displayName}?`)) {
              captainMutation.mutate(member.handle);
            }
          }}
          onRemove={(member) => {
            if (window.confirm(`¿Quitar a ${member.displayName} del equipo?`)) {
              removeMutation.mutate(member.handle);
            }
          }}
        />
      </div>
    </section>
  );
}

type HubMember = NonNullable<TeamHub["team"]>["members"][number];

function RosterGroup({
  title,
  description,
  members,
  empty,
  team,
  busy,
  onLaneRole,
  onRosterRole,
  onCaptain,
  onRemove,
}: {
  title: string;
  description: string;
  members: HubMember[];
  empty: string;
  team: NonNullable<TeamHub["team"]>;
  busy: boolean;
  onLaneRole: (handle: string, role: TeamLaneRole | null) => void;
  onRosterRole: (handle: string, role: "player" | "substitute") => void;
  onCaptain: (member: HubMember) => void;
  onRemove: (member: HubMember) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/20">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-black text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline">{members.length}</Badge>
        </div>
      </div>

      {members.length ? (
        <div className="divide-y divide-border">
          {members.map((member) => (
            <RosterMemberRow
              key={member.profileId}
              member={member}
              isCaptainView={team.isCaptain}
              busy={busy}
              onLaneRole={onLaneRole}
              onRosterRole={onRosterRole}
              onCaptain={onCaptain}
              onRemove={onRemove}
            />
          ))}
        </div>
      ) : (
        <div className="p-6 text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );
}

function RosterMemberRow({
  member,
  isCaptainView,
  busy,
  onLaneRole,
  onRosterRole,
  onCaptain,
  onRemove,
}: {
  member: HubMember;
  isCaptainView: boolean;
  busy: boolean;
  onLaneRole: (handle: string, role: TeamLaneRole | null) => void;
  onRosterRole: (handle: string, role: "player" | "substitute") => void;
  onCaptain: (member: HubMember) => void;
  onRemove: (member: HubMember) => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/players/$handle"
                params={{ handle: member.handle }}
                className="truncate font-bold text-foreground hover:text-brand"
              >
                {member.displayName}
              </Link>
              {member.isCaptain ? (
                <Badge variant="secondary">
                  <Crown className="mr-1 size-3" /> Capitán
                </Badge>
              ) : null}
              <TeamLaneBadge role={member.laneRole} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              @{member.handle} · {member.riotTier ?? "Sin rango"} {member.riotRank ?? ""}
              {member.accountLevel != null ? ` · nivel ${member.accountLevel}` : ""}
            </p>
          </div>
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full border ${
              member.riotVerified && member.eligibility === "eligible"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border bg-background/40 text-muted-foreground"
            }`}
            title={
              member.riotVerified && member.eligibility === "eligible"
                ? "Controles competitivos aprobados"
                : "Controles competitivos incompletos"
            }
          >
            {member.riotVerified && member.eligibility === "eligible" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <CircleAlert className="size-4" />
            )}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={member.riotVerified ? "default" : "outline"}>
            {member.riotVerified ? "Riot verificado" : "Falta vincular Riot"}
          </Badge>
          <Badge variant={member.eligibility === "eligible" ? "default" : "outline"}>
            {statusLabel(member.eligibility)}
          </Badge>
          <Badge variant={(member.accountLevel ?? 0) >= 30 ? "default" : "outline"}>
            {(member.accountLevel ?? 0) >= 30 ? "Nivel 30 o más" : "Falta verificar el nivel"}
          </Badge>
        </div>

        {isCaptainView ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label={`Posición de juego de ${member.displayName}`}
              value={member.laneRole ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onLaneRole(member.handle, value ? (value as TeamLaneRole) : null);
              }}
              disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Posición de juego</option>
              {TEAM_LANES.map((lane) => (
                <option key={lane.value} value={lane.value}>
                  {lane.label}
                </option>
              ))}
            </select>

            {!member.isCaptain ? (
              <select
                aria-label={`Estado en el plantel de ${member.displayName}`}
                value={member.role}
                onChange={(event) =>
                  onRosterRole(member.handle, event.target.value as "player" | "substitute")
                }
                disabled={busy}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="player">Titular</option>
                <option value="substitute">Suplente</option>
              </select>
            ) : (
              <div className="flex h-9 items-center rounded-md border border-border bg-background/30 px-3 text-sm text-muted-foreground">
                Capitán · Titular
              </div>
            )}
          </div>
        ) : null}

        {isCaptainView && !member.isCaptain ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" onClick={() => onCaptain(member)} disabled={busy}>
              <ShieldCheck className="mr-2 size-4" /> Nombrar capitán
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(member)} disabled={busy}>
              <X className="mr-1 size-4" /> Quitar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CaptainRecruiting({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteMyTeamMember);
  const cancel = useServerFn(cancelMyTeamInvite);
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"player" | "substitute">("player");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { handle, role } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitación enviada.");
      setHandle("");
      refresh();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (inviteId: string) => cancel({ data: { inviteId } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitación cancelada.");
      refresh();
    },
  });

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
      <div className="rounded-2xl border border-border/70 bg-card/35 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Reclutamiento</p>
            <h3 className="mt-1 text-xl font-black text-foreground">Sumá otro jugador</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Buscá candidatos verificados entre los jugadores libres o invitá a un amigo con su
              identificador de EloShape.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/team/players">
              <Search className="mr-2 size-4" /> Buscar jugadores
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="Identificador del jugador"
            onKeyDown={(event) => {
              if (event.key === "Ingresar" && handle.trim() && !inviteMutation.isPending) {
                inviteMutation.mutate();
              }
            }}
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "player" | "substitute")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="player">Titular</option>
            <option value="substitute">Suplente</option>
          </select>
          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending || !handle.trim()}
          >
            <UserPlus className="mr-2 size-4" />
            {inviteMutation.isPending ? "Enviando…" : "Invitar"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background/20">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <p className="font-black text-foreground">Invitaciones pendientes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Esperando la respuesta del jugador.
            </p>
          </div>
          <Badge variant="outline">{team.pendingInvites.length}</Badge>
        </div>

        {team.pendingInvites.length ? (
          <div className="divide-y divide-border">
            {team.pendingInvites.map((pending) => (
              <div key={pending.id} className="flex items-center justify-between gap-3 p-4 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">@{pending.handle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pending.role === "substitute" ? "Suplente" : "Titular"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancelMutation.mutate(pending.id)}
                  disabled={cancelMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 text-sm text-muted-foreground">No hay invitaciones pendientes.</div>
        )}
      </div>
    </section>
  );
}

function MemberTools() {
  const queryClient = useQueryClient();
  const leave = useServerFn(leaveMyTeam);
  const mutation = useMutation({
    mutationFn: () => leave(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saliste del equipo.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  return (
    <section className="rounded-xl border border-border bg-background/20 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-foreground">Pertenencia al equipo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            El capitán administra las inscripciones a torneos, las posiciones del plantel y las
            invitaciones.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm("¿Salir de este equipo?")) mutation.mutate();
          }}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Saliendo…" : "Salir del equipo"}
        </Button>
      </div>
    </section>
  );
}
