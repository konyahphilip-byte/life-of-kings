# Project brief 04: Eco Games

## Overview

Eco Games offers short, mobile-first games and social challenges tied to EcoVibes ID and communities. First release: five simple games; add the sixth/seventh after stability and retention review. No real-money wagering.

## What exists now

Gaming is currently a visual/sample discovery page. It has no playable persistent game engine, server-validated score, tournament, anti-cheat pipeline or cash/reward settlement.

## Initial game set

1. **Oware:** turn-based mancala; local practice first, online matches after server-authoritative moves.
2. **Draughts:** checkers with saved matches and legal move enforcement.
3. **Word Sprint:** short vocabulary/word rounds with language packs, beginning with reviewed English and adding local languages with qualified reviewers.
4. **Daily Quiz:** sourced, dated, region/language-tagged questions with correction/report flow.
5. **Eco Sort:** low-data material-sorting game that teaches locally relevant waste categories; educational answers can differ by municipality and must show locality/source.

Potential later games: a daily number/pattern puzzle and a football knowledge challenge. No score-staked predictions, betting, cash prizes or chance-based cash rewards in this scope.

## User journey and data

Open game → read rules/age label → play a local/timed round → server verifies score where competitive → save result/leaderboard entry → optionally share with a community. Persist game catalog/version, player preferences, match, legal moves/events, score evidence, season leaderboard, reports and non-cash achievements. Guest practice may be local; ranked play requires EcoVibes ID. Avoid unnecessary device identifiers.

## Safety and monetization

Use non-transferable badges/points under the EcoPoints policy. Leaderboards need anti-cheat, reporting, season reset and minimum-age/privacy policy. Monetization may include cosmetic themes or a later developer marketplace with revenue share and source/license disclosures; never pay-to-win or sell competitive advantage.

## Acceptance criteria

- Five launch games are playable on a narrow mobile screen and low-end device without mandatory network for practice where feasible.
- Ranked results are server-validated, replay-safe and have a report/appeal path; client score edits cannot change leaderboard state.
- Quiz facts carry source/review date and users can report errors.
- No game offers stakes, cash redemption or gambling-like payment prompts.
- Reduced motion, accessible instructions and localization fallback work.

## Build prompt

> Implement Eco Games in the existing EcoVibes repo as a separate product module. Inspect the current gaming preview, EcoVibes ID, recommendation/reward contracts and this plan first. Build a five-game first release—Oware, Draughts, Word Sprint, Daily Quiz and Eco Sort—with one complete playable vertical slice before expanding. Use React/TypeScript/Vite and the existing Node/Postgres API; authoritative competitive rules and scores belong server-side. Make practice low-data and optionally offline, use EcoVibes ID for ranked play, and keep prizes non-transferable/non-cash. Do not implement betting, cash entry fees, real-money prizes or a developer marketplace in the first milestone. Add moderation/report and quiz provenance rules, preserve the existing home and app shell, and label mock content until backed by real records.

## Metrics

Track completed rounds, repeat play, match completion, reported content, score disputes, crashes/load time, accessibility, and retention by game/language. Do not optimize solely for session duration.
