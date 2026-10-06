import { Link, createFileRoute } from "@tanstack/react-router";

import { PageContainer, PageHeading } from "@/components/layout/PageShell";
import { RIOT_LEGAL_NOTICE } from "@/lib/riot-legal";
import { canonicalMetadata } from "@/lib/site-metadata";

export const Route = createFileRoute("/privacy")({
  head: () => {
    const canonical = canonicalMetadata("/privacy");
    return {
      meta: [
        { title: "Política de privacidad — EloShape" },
        {
          name: "description",
          content:
            "Cómo maneja EloShape las cuentas de jugadores, los datos de vinculación de Riot y los registros competitivos.",
        },
        { property: "og:title", content: "Política de privacidad de EloShape" },
        {
          property: "og:description",
          content:
            "Qué datos guarda EloShape sobre los jugadores y las cuentas de Riot vinculadas.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div>
      <PageHeading
        eyebrow="Información legal"
        title="Política de privacidad"
        description="Qué guarda EloShape, por qué lo guarda y qué datos nunca se muestran públicamente."
      />
      <PageContainer className="prose-invert max-w-3xl space-y-7 py-8 sm:py-10 text-sm leading-relaxed text-muted-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Vigente desde el 27 de agosto de 2026
        </p>
        <section>
          <h2 className="text-base font-black text-foreground">Datos de la cuenta</h2>
          <p className="mt-2">
            Las cuentas de EloShape usan autenticación con correo electrónico y contraseña. Tu
            correo se usa únicamente para iniciar sesión y recuperar la cuenta; nunca se muestra en
            perfiles ni clasificaciones públicos.
          </p>
          <p className="mt-2">
            Al crear una cuenta, EloShape registra la versión y la fecha de tu aceptación de los
            términos del servicio y la política de privacidad.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">
            Vinculación opcional de Discord y bot
          </h2>
          <p className="mt-1 text-xs">
            Aviso sobre la integración de Discord agregado el 5 de octubre de 2026.
          </p>
          <p className="mt-2">
            Si elegís conectar Discord desde tu perfil de EloShape, Discord te pide autorizar la
            conexión. Supabase Auth procesa la autorización OAuth y guarda la identidad de Discord
            asociada a tu cuenta de EloShape, incluidos tu ID de usuario de Discord y datos de
            identidad como el nombre de la cuenta y el correo electrónico. EloShape usa esa
            identidad verificada para identificar tu cuenta en su servidor de Discord.
          </p>
          <p className="mt-2">
            El bot de EloShape recibe solo los IDs de Discord necesarios para sincronizar el rol
            Cuenta vinculada y, mediante un proceso separado de aprobación, el rol Beta tester. Esos
            servicios privados no envían al bot tu correo, contraseña ni tokens OAuth. El bot
            también conserva los IDs del servidor, roles, canales y mensajes necesarios para sus
            mensajes oficiales, espacios privados de equipo y tickets de soporte. Conectar Discord
            no hace pública tu identidad de Discord en los perfiles de jugadores de EloShape.
          </p>
          <p className="mt-2">
            Podés desvincular Discord desde tu perfil. El bot retira Cuenta vinculada en su próxima
            sincronización exitosa mientras esté conectado. Desvincular no borra los mensajes o
            tickets ya publicados en Discord ni elimina tu cuenta de EloShape. Para solicitar una
            eliminación, contactá al soporte de EloShape o al staff mediante un ticket privado de
            Discord. Los mensajes y datos de cuenta de Discord también están sujetos a{" "}
            <a
              href="https://discord.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              la política de privacidad de Discord
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Vinculación de Riot</h2>
          <p className="mt-2">
            Cuando conectás un Riot ID, EloShape consulta a la API de Riot Games tu identificador de
            cuenta (PUUID) y tu rango en la cola clasificatoria individual. El PUUID se guarda de
            forma privada en nuestros servidores y nunca se expone en páginas públicas ni en nuestra
            API pública. Los perfiles públicos pueden mostrar tu Riot ID, rango y división.
          </p>
          <p className="mt-2">
            Vincular un Riot ID mediante la API de Riot confirma que la cuenta existe. No demuestra
            que te pertenece. Verificar la propiedad requiere Riot Sign On, que todavía no está
            disponible en EloShape.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">Registros competitivos</h2>
          <p className="mt-2">
            Las inscripciones a torneos, resultados oficiales, puntos de clasificación y logros son
            registros competitivos públicos. Las notas de moderación y revisión de elegibilidad son
            privadas y están limitadas al staff.
          </p>
          <p className="mt-2">
            Cuando un participante informa o disputa un resultado, EloShape puede guardar el
            marcador propuesto, notas, un enlace de evidencia aportado por el participante, el
            estado de confirmación o disputa y la resolución final del staff. Estos materiales se
            limitan a los participantes involucrados y al staff según lo necesario para administrar
            la competencia. Las páginas públicas muestran el resultado competitivo oficial, sin las
            notas privadas de la disputa.
          </p>
        </section>
        <section>
          <h2 className="text-base font-black text-foreground">
            Solicitudes de eliminación y privacidad
          </h2>
          <p className="mt-2">
            Podés pedir la eliminación de tu cuenta o enviar otra solicitud de privacidad en
            cualquier momento desde la{" "}
            <Link
              to="/support"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              página de soporte de EloShape
            </Link>
            . Los resultados históricos de torneos pueden conservarse o anonimizarse cuando sea
            necesario para mantener la coherencia de los cuadros y registros competitivos
            anteriores.
          </p>
        </section>
        <p className="border-t border-border/60 pt-6 text-xs">{RIOT_LEGAL_NOTICE}</p>
      </PageContainer>
    </div>
  );
}
