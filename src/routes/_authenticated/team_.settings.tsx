import { divisionLabel } from "@/lib/format";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Eye, Save, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/eloshape/EmptyState";
import { TeamWorkspaceNav } from "@/components/eloshape/TeamWorkspaceNav";
import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { archiveMyTeam } from "@/lib/team-management.functions";
import { getMyTeamHub, updateMyTeam, type TeamHub } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team_/settings")({
  head: () => ({
    meta: [
      { title: "Configuración del equipo — EloShape" },
      {
        name: "description",
        content: "Administrá la identidad y la configuración de tu equipo de EloShape.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamSettingsPage,
});

function TeamSettingsPage() {
  const fetchHub = useServerFn(getMyTeamHub);
  const query = useQuery({
    queryKey: ["my-team-hub"],
    queryFn: () => fetchHub(),
    retry: false,
  });

  return (
    <div>
      <PageHeading
        eyebrow="Espacio del equipo"
        title="Configuración del equipo"
        description="Administrá la identidad que los jugadores ven en las clasificaciones, cuadros y perfil público de tu equipo."
        aside={
          <Button asChild variant="outline">
            <Link to="/team">Volver al panel del equipo</Link>
          </Button>
        }
      />
      <PageContainer className="py-7 sm:py-9">
        {query.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : query.error || !query.data ? (
          <EmptyState title="No se pudo cargar la configuración del equipo" />
        ) : (
          <div className="space-y-6">
            <TeamWorkspaceNav
              active="settings"
              hasTeam={Boolean(query.data.team)}
              isCaptain={Boolean(query.data.team?.isCaptain)}
            />

            {!query.data.team ? (
              <EmptyState
                title="Sin equipo activo"
                description="Creá un equipo o unite a uno antes de abrir su configuración."
                action={
                  <Button asChild>
                    <Link to="/team">Abrir panel del equipo</Link>
                  </Button>
                }
              />
            ) : !query.data.team.isCaptain ? (
              <EmptyState
                title="Se requiere acceso de capitán"
                description="Solo el capitán actual puede editar la identidad del equipo o disolver el plantel."
                action={
                  <Button asChild variant="outline">
                    <Link to="/team">Volver al panel del equipo</Link>
                  </Button>
                }
              />
            ) : (
              <CaptainSettings team={query.data.team} />
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function CaptainSettings({ team }: { team: NonNullable<TeamHub["team"]> }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        <IdentitySettings team={team} />
        <DangerZone team={team} />
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/85 to-background/50 p-5">
          <div className="absolute right-0 top-0 size-40 translate-x-12 -translate-y-16 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Identidad pública</p>
              <Eye className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-5 flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 font-black text-primary shadow-sm">
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.name} className="size-full object-cover" />
                ) : (
                  team.tag
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-foreground">{team.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline">[{team.tag}]</Badge>
                  {team.division ? <Badge>{divisionLabel(team.division)}</Badge> : null}
                </div>
              </div>
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {team.bio ||
                "Todavía no hay una descripción pública. Agregá una para contar qué representa tu equipo."}
            </p>
            <Button asChild className="mt-5 w-full" variant="outline">
              <Link to="/teams/$slug" params={{ slug: team.slug }}>
                <ExternalLink className="mr-2 size-4" /> Ver perfil público
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border/60 pt-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="font-black text-foreground">Dónde aparece esta identidad</p>
          </div>
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Nombre y sigla</strong> aparecen en las
              clasificaciones, cruces, cuadros de torneos y tarjetas de equipos.
            </p>
            <p>
              <strong className="text-foreground">Biografía</strong> les da contexto a quienes
              visitan la página pública de tu equipo.
            </p>
            <p>
              <strong className="text-foreground">Plantel y posiciones</strong> se administran en el
              panel del equipo, para mantener separada la identidad de la alineación.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function IdentitySettings({ team }: { team: NonNullable<TeamHub["team"]> }) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateMyTeam);
  const [name, setName] = useState(team.name);
  const [tag, setTag] = useState(team.tag);
  const [bio, setBio] = useState(team.bio ?? "");
  const dirty = name !== team.name || tag !== team.tag || bio !== (team.bio ?? "");

  const mutation = useMutation({
    mutationFn: () => update({ data: { name, tag, bio } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Perfil del equipo guardado.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      void queryClient.invalidateQueries({ queryKey: ["team", team.slug] });
    },
    onError: () => toast.error("No se pudo guardar la configuración del equipo."),
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/35">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
        <div>
          <p className="eyebrow">Perfil del equipo</p>
          <h2 className="mt-1 text-xl font-black text-foreground">Identidad y descripción</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Mantené a tu equipo reconocible en todo el circuito de EloShape.
          </p>
        </div>
        <Badge variant={dirty ? "default" : "outline"}>
          {dirty ? "Cambios sin guardar" : "Actualizado"}
        </Badge>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Nombre del equipo</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
            <span className="block text-xs text-muted-foreground">De 3 a 40 caracteres</span>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-foreground">Sigla del equipo</span>
            <Input
              value={tag}
              onChange={(event) => setTag(event.target.value.toUpperCase())}
              maxLength={6}
            />
            <span className="block text-xs text-muted-foreground">De 2 a 6 caracteres</span>
          </label>
        </div>

        <label className="mt-5 block space-y-2 text-sm">
          <span className="font-semibold text-foreground">Descripción pública</span>
          <Textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Contá dónde compiten, qué están construyendo y qué define al plantel."
            maxLength={500}
            rows={6}
          />
          <span className="flex justify-between text-xs text-muted-foreground">
            <span>Visible en el perfil público del equipo.</span>
            <span>{bio.length}/500</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Al guardar, los cambios se reflejan en el directorio de equipos y el perfil público.
        </p>
        <div className="flex flex-wrap gap-2">
          {dirty ? (
            <Button
              variant="outline"
              onClick={() => {
                setName(team.name);
                setTag(team.tag);
                setBio(team.bio ?? "");
              }}
              disabled={mutation.isPending}
            >
              Restablecer
            </Button>
          ) : null}
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !dirty || !name.trim() || !tag.trim()}
          >
            <Save className="mr-2 size-4" />
            {mutation.isPending ? "Guardando…" : "Guardar perfil"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DangerZone({ team }: { team: { name: string; tag: string; slug: string } }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const archive = useServerFn(archiveMyTeam);
  const [confirmation, setConfirmation] = useState("");
  const canArchive = confirmation.trim() === team.name;

  const mutation = useMutation({
    mutationFn: () => archive(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Equipo disuelto. Se conservaron los registros históricos de torneos.");
      void queryClient.invalidateQueries({ queryKey: ["my-team-hub"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      void queryClient.invalidateQueries({ queryKey: ["team", team.slug] });
      void navigate({ to: "/team" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo disolver el equipo.");
    },
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-destructive/35 bg-destructive/5">
      <div className="flex items-start gap-3 border-b border-destructive/20 p-5 sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" />
        </span>
        <div>
          <p className="eyebrow text-destructive">Acciones irreversibles</p>
          <h2 className="mt-1 text-xl font-black text-foreground">Disolver equipo</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Los miembros actuales quedan libres y se cancelan las invitaciones pendientes. Se
            conservan las inscripciones históricas, los planteles bloqueados, los resultados y las
            clasificaciones.
          </p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="border-l-2 border-destructive/30 pl-4">
          <p className="text-sm font-semibold text-foreground">
            Escribí <span className="font-black">{team.name}</span> para confirmar.
          </p>
          <Input
            className="mt-3 max-w-md"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={team.name}
            autoComplete="off"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Esta acción está bloqueada mientras el equipo tenga asistencia confirmada o esté
            compitiendo en un torneo activo.
          </p>
          <Button
            className="mt-4"
            variant="destructive"
            disabled={!canArchive || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Disbanding…" : "Disolver equipo permanentemente"}
          </Button>
        </div>
      </div>
    </section>
  );
}
