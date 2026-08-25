# EloShape Arena

Build a strong MVP foundation for a full-stack esports platform called EloShape. EloShape is a competitive League of Legends platform for amateur/lower-elo players. Players compete in organized tournaments against players of similar skill levels, earn EloShape competition points based only on tournament results, and climb leaderboards by city, province/state, country, and region. Initial divisions: Iron, Bronze, Silver, Gold. Core brand idea: “You don't need to be Challenger to compete.”

Create a polished responsive web app foundation with a premium dark esports/technology aesthetic. Brand colors: near-black/charcoal backgrounds, metallic gray/silver, orange #E07A2A and gold #FFC140 accents, white primary text, muted gray secondary text. Typography: Inter-style modern geometric sans serif. The existing logo concept is a vertically symmetrical geometric emblem, silver/gray on the left and orange/gold on the right, subtly suggesting E + S and upward progression. If the image cannot be attached yet, use a temporary geometric ES mark placeholder that can be replaced later.

The app should feel like FACEIT/Toornament-level software, not a fictional esports team website. Avoid generic gamer mascots and excessive neon. Use clean cards, subtle borders, good hierarchy, competitive data density, and smooth responsive layouts.

Build the following pages/routes and navigation:
1. Home: hero, tagline, CTA “Compete Now”, next tournament card, top players leaderboard preview, divisions overview, how EloShape works.
2. Tournaments listing: filters for division/region/status, tournament cards, participant counts and registration state.
3. Tournament detail: overview, rules, participants/teams, bracket placeholder, schedule/matches, results, registration/check-in CTA.
4. Rankings: tabs/filters for Iron/Bronze/Silver/Gold, monthly vs season, country/province/city, table with rank, player, Riot rank, EloShape points, record, movement.
5. Player profile: Riot ID, current Riot rank, EloShape points, rankings by city/province/country, tournament stats, tournament history, achievements, recent matches.
6. Team profile: team name, roster, division, regional ranking, W/L, tournament history, championships.
7. Player dashboard: registered tournaments, upcoming matches, points, ranking movement, team status, profile completion.
8. Authentication screens: sign up/sign in. For MVP, use normal app authentication; create UI for “Connect Riot Account” but do not expose or hardcode any Riot API key.
9. Admin foundation: basic dashboard for tournaments, users, reports and eligibility review, accessible through a mock/admin role.

Use realistic seeded/demo data so every page looks complete. Include players from Argentina/LAS and examples such as Rosario, Santa Fe and Argentina rankings.

Architecture/data model should anticipate: users, riot_accounts, player_profiles, regions, divisions, seasons, tournaments, tournament_entries, teams, team_members, matches, match_players, ranking_points, achievements, reports, bans/eligibility_reviews. Create a clean database/backend foundation using Lovable's preferred backend stack. Do not implement production Riot authentication yet. Create a server-side abstraction/service for future Riot API integration and add clear TODO documentation so API secrets stay server-side only.

Important competitive rules for the MVP model:
- Riot Solo Queue rank determines which EloShape division the player is eligible for.
- EloShape ranking points are earned only from EloShape tournament performance; do not create an alternative MMR/ELO from normal Riot matches.
- The product needs regional leaderboards and monthly/season ranking views.
- Anti-smurf/eligibility review should be represented in the data model and admin UI, initially with manual review states such as eligible, pending_review, rejected, suspended.

Suggested demo point system: participation +5, match win +10, quarterfinal +15, semifinal +25, runner-up +40, champion +70. Keep this easy to change from configuration.

Please implement the base product, not just a static landing page. Set up reusable components, routing, authentication foundation, data models/backend tables if available, seeded demo data, and a coherent design system so we can continue iterating feature by feature. At the end, summarize what you built, what is mocked, and the next 5 recommended development steps.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b25a5d43-ea7c-4091-b928-2da59c732426).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
