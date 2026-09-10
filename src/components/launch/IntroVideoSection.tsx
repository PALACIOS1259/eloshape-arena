import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Swords, Trophy } from "lucide-react";

import { PageContainer } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

function publicVideoUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const introVideoUrl = publicVideoUrl(import.meta.env["VITE_INTRO_VIDEO_URL"]);

const steps = [
  { icon: ShieldCheck, label: "Verify your competitive eligibility" },
  { icon: Swords, label: "Join a team and enter a bracket" },
  { icon: Trophy, label: "Earn points inside the EloShape circuit" },
] as const;

export function IntroVideoSection() {
  if (!introVideoUrl) return null;

  return (
    <section className="border-b border-border bg-surface/30">
      <PageContainer className="py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <p className="eyebrow">How EloShape works</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              From Riot ID to tournament bracket
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              See how amateur players build a team, enter the right division and compete in a
              structured regional circuit.
            </p>

            <ul className="mt-7 space-y-4">
              {steps.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <Button asChild className="mt-8">
              <Link to="/tournaments">
                Explore tournaments
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="shadow-elevated overflow-hidden rounded-xl border border-border bg-background">
            <div className="aspect-video bg-black">
              <video
                className="h-full w-full object-contain"
                controls
                playsInline
                preload="metadata"
                poster="/og-image.jpg"
                aria-label="EloShape platform introduction"
              >
                <source src={introVideoUrl} type="video/mp4" />
                <track
                  default
                  kind="captions"
                  src="/video/eloshape-intro-es.vtt"
                  srcLang="es"
                  label="Español"
                />
                Your browser does not support embedded video.
              </video>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
