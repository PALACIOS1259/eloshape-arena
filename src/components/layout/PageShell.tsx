import type { ReactNode } from "react";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="relative border-b border-border/60 bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <PageContainer className="relative py-7 sm:py-9">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1 className="mt-1.5 text-3xl font-black tracking-[-0.025em] text-foreground sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                {description}
              </p>
            ) : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      </PageContainer>
    </div>
  );
}
