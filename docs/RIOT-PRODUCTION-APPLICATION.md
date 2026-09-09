# EloShape — Riot Production API application

Updated: 2026-09-09

This file is the source of truth for the Riot Developer Portal submission. Review every field before sending it and keep the registered product metadata updated when the product changes.

## Product details

- **Product name:** EloShape
- **Production URL:** https://eloshape.com.ar
- **Reviewer URL:** https://eloshape-arena-git-staging-iron-metrics.vercel.app
- **Game:** League of Legends
- **Initial platform:** LAS (`LA2`)
- **Regional routing:** `AMERICAS`
- **Current language:** English
- **Product stage:** working closed-beta prototype
- **Monetization:** none at present; no entry fees, paid features, betting or gambling

Production intentionally shows a maintenance page while the closed beta remains private. Riot reviewers should use the reviewer URL, where the complete account, team, tournament, bracket, standings and administration flows are testable.

## Short description

EloShape is a structured amateur League of Legends competitive circuit for Iron-to-Gold players in LAS. Players connect a Riot ID to confirm their current Solo Queue tier and account level, form five-player teams, enter local qualifiers, and advance through transparent brackets into a Semi-Split playoff. EloShape standings award points only for results earned in EloShape competitions.

## Detailed description and player benefit

Most amateur players do not have access to a consistent local competitive structure. EloShape gives them scheduled events, roster locking, check-in, published brackets, result confirmation and disputes, qualifier standings, pass-down qualification, and a 16-team playoff path.

Riot data is used only for identity lookup and eligibility review. EloShape points are competition standings, not an estimate of a player's hidden skill, Riot MMR, or an alternative League ranked ladder. The product does not provide game-session advice, hidden player information, match-history analysis, betting, or an in-game competitive advantage.

The current working prototype has completed an automated end-to-end QA simulation covering 16 team registrations, roster locking, check-in, Round of 16 through Final, qualifier finalization, Top 4 qualification, a second qualifier with pass-down, 16 playoff seeds, and the playoff bracket.

## Riot APIs requested

EloShape currently needs **Standard APIs only**. It does not currently use the Riot Tournaments API.

1. **ACCOUNT-V1** — `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` on `americas.api.riotgames.com` to resolve a Riot ID to a PUUID.
2. **LEAGUE-V4** — `GET /lol/league/v4/entries/by-puuid/{puuid}` on `la2.api.riotgames.com` to read the current Solo Queue tier, division, LP, wins and losses used for eligibility review.
3. **SUMMONER-V4** — `GET /lol/summoner/v4/summoners/by-puuid/{puuid}` on `la2.api.riotgames.com` to confirm the account level requirement.

The PUUID is stored privately and is not exposed on public pages. Public profiles may show the player's Riot ID and ranked snapshot. A ten-minute refresh cooldown limits repeated calls. Riot errors and rate limits are handled with user-safe responses.

## Account ownership and RSO

The current API-key lookup confirms that a Riot ID exists and prevents the same PUUID from being linked to two EloShape profiles. It does **not** prove account ownership. The product records `ownership_verified = false` and sends eligibility to staff review rather than claiming RSO verification.

Riot Sign On will be implemented only after Riot approves Production access and provides the required RSO onboarding. Until then, the product will not represent Riot-ID lookup as ownership verification.

## API key security

- `RIOT_API_KEY` exists only as a Supabase Edge Function secret.
- Browser bundles contain no Riot API key and no `VITE_RIOT_*` variable.
- Riot requests are made over HTTPS by the `riot-sync` Edge Function.
- The key is sent only in the `X-Riot-Token` header.
- The key is not included in URLs, responses, application logs, the repository, or client storage.
- Production and staging use separate Supabase projects and secrets.
- Allowed browser origins are explicitly restricted through `ELOSHAPE_ALLOWED_ORIGINS`.

## Policy compliance

- The Riot legal notice is visible in the site footer and repeated on the Terms and Privacy pages.
- Tournament outcomes and point awards are published and traceable to EloShape matches.
- Team events require at least four complete five-player teams (20 participants) before they may begin. The intended qualifier size is 16 teams (80 players).
- There is no betting or gambling.
- If entry fees are introduced later, the product will first be updated in the Developer Portal and at least 70% will go to the prize pool.
- Any future Riot API, monetization, RSO, or tournament-code feature will be submitted for audit before public release.

Policy references:

- https://developer.riotgames.com/policies/general
- https://developer.riotgames.com/docs/lol
- https://developer.riotgames.com/docs/portal

## Public legal and support pages

- Privacy: https://eloshape.com.ar/privacy
- Terms: https://eloshape.com.ar/terms
- Support and account deletion: available to authenticated users at `/support`
- Application contact: the verified email on Emiliano's Riot Developer account

## Reviewer flow

1. Open the reviewer URL.
2. Create an EloShape account or use the reviewer account supplied privately in the portal.
3. Complete the player profile and connect a valid LAS Riot ID.
4. Review the assigned division and eligibility status.
5. Create or join a five-player team.
6. Browse a 16-team qualifier, registration/check-in state, roster lock and bracket.
7. Open Semi-Split standings to review Top 4 qualification, pass-down and playoff seeds.
8. Review public rankings, team pages, rules, Privacy and Terms.

Do not store a reviewer password in this repository. Supply credentials only through Riot's private application message.

## Submission checklist

- [ ] Confirm the staging `riot-sync` function has a currently valid development key for Riot's review window.
- [ ] Confirm the reviewer can create an account, or provide a dedicated reviewer account privately.
- [ ] Capture current screenshots of home, Riot ID connection, qualifier bracket, Semi-Split standings and playoff bracket.
- [ ] Verify the reviewer URL and all legal URLs immediately before submission.
- [ ] Register EloShape as a Production application from Emiliano's own Riot Developer account.
- [ ] Request only the three Standard API families listed above.
- [ ] Keep production registration closed until Riot grants a Production API key.
