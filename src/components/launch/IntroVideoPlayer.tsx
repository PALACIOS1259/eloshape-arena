export function IntroVideoPlayer() {
  return (
    <figure className="overflow-hidden rounded-2xl border border-brand/25 bg-card/55 shadow-card">
      <div className="aspect-video bg-black">
        <video
          className="h-full w-full object-contain"
          controls
          playsInline
          preload="none"
          poster="/video/eloshape-presentacion.jpg"
          aria-label="Video de presentación de EloShape"
        >
          <source src="/video/eloshape-presentacion.mp4" type="video/mp4" />
          Tu navegador no permite reproducir este video. Podés{" "}
          <a href="/video/eloshape-presentacion.mp4">abrir la presentación de EloShape</a>.
        </video>
      </div>
      <figcaption className="border-t border-border/60 px-5 py-4">
        <p className="eyebrow text-gold">Conocé EloShape</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu nivel. Tu equipo. Tu circuito competitivo.
        </p>
      </figcaption>
    </figure>
  );
}
