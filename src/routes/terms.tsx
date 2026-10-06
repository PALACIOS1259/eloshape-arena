import { createFileRoute } from "@tanstack/react-router";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { RIOT_LEGAL_NOTICE } from "@/lib/riot-legal";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/terms")({
  head: () => {
    const canonical = canonicalMetadata("/terms");
    return {
      meta: [
        { title: "Términos del servicio — EloShape" },
        {
          name: "description",
          content:
            "Las reglas para competir en EloShape: elegibilidad, juego limpio, integridad de las divisiones y conducta de las cuentas.",
        },
        { property: "og:title", content: "Términos del servicio de EloShape" },
        {
          property: "og:description",
          content: "Reglas de elegibilidad, juego limpio y conducta para el circuito de EloShape.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  component: TermsPage,
});

function TermsPage() {
  return (
    <div>
      <PageHeading
        eyebrow="Información legal"
        title="Términos de servicio"
        description="Competir en EloShape implica aceptar estos términos."
      />
      <PageContainer className="max-w-3xl space-y-7 py-8 sm:py-10 text-sm leading-relaxed text-muted-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Vigente desde el 27 de agosto de 2026
        </p>
        <section>
          <h2 className="text-base font-black text-foreground">Elegibilidad</h2>
          <p className="mt-2">
            EloShape organiza divisiones para jugadores de rangos bajos. Tu rango de Riot en la cola
            clasificatoria individual determina a qué división podés entrar. El staff de EloShape
            toma las decisiones de elegibilidad; tener un rango válido de Riot no garantiza por sí
            solo la habilitación.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Juego limpio</h2>
          <p className="mt-2">
            Está prohibido competir con una cuenta de nivel inferior al real, compartir cuentas,
            manipular el rango o vincular una cuenta de Riot que no te pertenece. Estas acciones
            pueden causar una suspensión. Cada cuenta de Riot puede vincularse a un solo jugador de
            EloShape.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Puntos y resultados</h2>
          <p className="mt-2">
            Los puntos de clasificación de EloShape se otorgan exclusivamente por resultados en sus
            torneos. El rendimiento en la cola clasificatoria individual de Riot nunca genera puntos
            de EloShape, y EloShape no calcula una puntuación alternativa de emparejamiento.
          </p>
          <p className="mt-2">
            Un jugador individual participante o el capitán de un equipo inscrito puede informar un
            resultado. El rival o su capitán puede confirmarlo. Si las partes no coinciden, el
            resultado entra en disputa y el cuadro no avanza hasta que el staff de EloShape lo
            resuelva.
          </p>
          <p className="mt-2">
            El staff puede revisar las notas y evidencias aportadas y fijar el marcador oficial. La
            resolución registrada por EloShape determina el cuadro, las posiciones y los puntos. La
            evidencia falsa o engañosa puede causar descalificación, pérdida de elegibilidad o
            suspensión.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Cuentas</h2>
          <p className="mt-2">
            Sos responsable de las credenciales de tu cuenta y del contenido que publicás en tu
            perfil. No está permitido hacerse pasar por el staff, Riot Games u otros jugadores.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">
            Comunidad de Discord y vinculación de cuentas
          </h2>
          <p className="mt-1 text-xs">
            Aviso sobre la integración de Discord agregado el 5 de octubre de 2026.
          </p>
          <p className="mt-2">
            Vincular Discord es opcional y requiere la autorización del dueño de esa cuenta. No
            vincules la identidad de otra persona ni compartas credenciales. El rol Cuenta vinculada
            identifica una conexión verificada; no aprueba acceso a la beta, elegibilidad
            competitiva, inscripción a torneos ni un cargo de staff.
          </p>
          <p className="mt-2">
            La actualización de roles depende de que el bot esté conectado y bien configurado. El
            staff de EloShape puede moderar la participación según las reglas publicadas del
            servidor y los torneos. Desvincular tu cuenta retira el rol de cuenta vinculada cuando
            el bot vuelve a sincronizar; las demás aprobaciones y decisiones de moderación se
            administran por separado.
          </p>
        </section>
        <p className="border-t border-border/60 pt-6 text-xs">{RIOT_LEGAL_NOTICE}</p>
      </PageContainer>
    </div>
  );
}
