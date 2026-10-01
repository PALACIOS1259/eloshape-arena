# EloShape staff operations

This document describes the intended staff workflow. Database operations should be performed through the admin UI/RPC layer, not ad-hoc table edits, except controlled staging maintenance.

## 1. Tournament operations

Normal order:

1. publish/open registration;
2. monitor registrations;
3. close registration/check-in window;
4. lock entries;
5. inspect rejected entries;
6. generate bracket;
7. run matches;
8. resolve result claims/disputes;
9. record walkovers when necessary;
10. finalize tournament;
11. verify points/placements;
12. for qualifiers, verify qualification grants.

## 2. Lock entries

Before generating a bracket:
- ensure check-in has closed;
- run entry lock;
- inspect rejected teams;
- do not manually insert a team into a generated bracket.

Locking snapshots rosters and is part of the integrity boundary.

## 3. Bracket generation

Generate once after the field is correct. If a bracket exists, treat regeneration as an exceptional operation.

For 16 teams, expect 15 total matches and no byes.

## 4. Match result handling

### Normal result
Use participant confirmation where possible or staff result reporting when operationally required.

### Dispute
Use the dispute queue. Inspect submitted score/evidence and enter a staff resolution note.

### Walkover
Use the audited walkover action with the winner and a meaningful reason. Walkovers count as wins.

### Completed-result correction
Use only when downstream competition has not made correction unsafe. The server rejects unsafe correction attempts.

## 5. Tournament finalization checklist

Do not finalize until:
- final is completed;
- every playable match is resolved;
- winner advancement is correct;
- open result disputes for the event are resolved.

After finalization verify:
- tournament status = completed;
- final placements;
- team/player point ledger;
- qualifier grants if this is a qualifier.

## 6. Semi-Split operations

Order:
1. finish/finalize all qualifiers;
2. verify qualification count;
3. resolve withdrawals/replacements;
4. move split to seeding;
5. generate playoff field;
6. verify playoff seeds;
7. move into playoff stages;
8. complete/finalize playoff tournament;
9. complete the split.

Short-field playoff generation is an override and requires an audit reason.

## 7. Qualifier priority

When a team already qualified in an earlier qualifier:
- it can be restricted from later qualifier registration until the configured priority time;
- non-qualified teams can register during the protected window;
- after the gate opens, qualified teams may register if capacity remains.

Do not bypass this with direct table inserts.

## 8. Eligibility queue

Eligibility state:
- pending_review
- eligible
- rejected
- suspended

The active queue should contain current pending work. Decision history remains separate so resolved reviews do not clutter operations.

## 9. Support queue

Support categories include ordinary support, bugs, privacy and account deletion. Staff responses/status changes go through support RPCs and should be treated as an auditable user-service workflow.

## 10. Team safety

Prefer archival to destructive deletion. Historical tournament and ledger relationships must remain intact.

## 11. Incident checklist

For any competition incident:
1. record tournament/match/team IDs;
2. stop making unrelated changes;
3. inspect audit log and result claims;
4. reproduce in staging when possible;
5. fix code/migration first;
6. add regression coverage;
7. then correct affected staging/production data with a documented operation.

Never silently rewrite competition history without an audit reason.
