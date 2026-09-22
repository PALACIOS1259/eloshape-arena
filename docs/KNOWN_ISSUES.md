# Known issues and external dependencies

Last reviewed: 2026-09-22.

## Not a production logic bug: deterministic staging qualifiers

The staging Rosario Gold demo qualifiers contain deterministic fixture results and reuse some demo teams. This can make multiple qualifier final standings look very similar.

Tournament detail itself correctly filters entries and matches by each tournament's own ID.

Do not change competition rules to cosmetically randomize demo data. If more realistic demo presentation is desired, replace the fixture dataset with a purpose-built varied dataset and keep ledger/qualification consistency.

## Riot Production API

Production launch remains dependent on the persistent Riot Production API approval/key. Development keys are not a production solution.

## Riot account ownership

Riot API lookup verifies that a Riot ID exists and can retrieve data. It does not by itself prove that the EloShape user owns that account. Ownership verification should use Riot Sign On only after RSO access is granted.

## Production maintenance

Production remains intentionally in maintenance while launch prerequisites are incomplete. Development work belongs on staging.

## Supabase leaked-password protection

This is an Auth project setting rather than repository code. Enable it in the Supabase dashboard where the plan/project configuration supports it.

## Performance-advisor warnings

Unused indexes on a low-traffic staging database are not automatically defects. Remove indexes only after production-like evidence demonstrates they are unnecessary.

## UI regression checklist

Before shipping tournament UI changes, explicitly inspect:
- 16-team Round of 16;
- empty/pending bracket;
- completed bracket;
- bye;
- walkover;
- mobile horizontal bracket scrolling;
- team directory desktop/mobile;
- Scrim Finder desktop/mobile.
