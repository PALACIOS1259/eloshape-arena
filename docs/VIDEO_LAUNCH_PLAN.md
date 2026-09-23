# EloShape launch video

## Deliverables

- Website master: 1920 × 1080, 45 seconds, H.264 MP4, 8–12 Mbps.
- Social cut: 1080 × 1920, 30 seconds, H.264 MP4.
- Spanish narration and burned-in Spanish captions.
- Clean screen recordings from staging with fictional test data only.

## Website master storyboard

| Time | Screen | Narration / on-screen message |
| --- | --- | --- |
| 00–04 | EloShape logo over the dark brand background | No necesitás ser Challenger para competir. |
| 04–10 | Homepage and divisions | EloShape es un circuito competitivo para jugadores amateur de League of Legends. |
| 10–16 | Riot account linking and detected division | Conectá tu Riot ID y competí dentro de la división correspondiente a tu rango. |
| 16–23 | Team creation and five-player roster | Creá tu equipo, completá el roster e inscribite en los clasificatorios regionales. |
| 23–31 | Tournament page and elimination bracket | Jugá brackets tradicionales y avanzá enfrentando directamente a cada rival. |
| 31–38 | Rankings and EloShape points | Cada resultado suma puntos únicamente dentro del circuito EloShape. |
| 38–45 | Logo, domain and call to action | Formá tu equipo. Entrá al bracket. Demostrá hasta dónde podés llegar. |

## Recording checklist

1. Use the staging deployment, not production.
2. Record at 1920 × 1080 with browser zoom at 100%.
3. Hide bookmarks, browser extensions, DevTools, email addresses and personal data.
4. Record each action as a separate 6–10 second clip.
5. Keep the cursor still before and after each action to make editing easier.
6. Never show API keys, Supabase URLs, admin secrets or the Riot developer portal.

## Website integration

The homepage video section remains hidden until `VITE_INTRO_VIDEO_URL` contains a direct HTTPS MP4 URL. The final video must not be committed to Git when a CDN or object-storage URL is available. Captions live at `public/video/eloshape-intro-es.vtt`.
