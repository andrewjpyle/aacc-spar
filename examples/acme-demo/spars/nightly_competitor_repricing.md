# Spar: nightly competitor repricing

**Verdict: NO-GO (as written).** The plan repeats all five catalogued Acme mistakes, including both CRITICAL landmines. The direction is sound and the fixes are cheap, so revise the plan and re-spar.

## Summary
The plan is short and clear. It matches the lowest competitor price on 60,000 SKUs nightly by scraping, then repricing. Splitting the scrape from the reprice is the right shape. Every safety-relevant choice, though, lands on a known trap:
- a single unguarded production UPDATE (the 2026-03 $0 wipe);
- a "test" on staging, which holds real customer data (the 12,000-customer email);
- a feature flag that defaults ON;
- a bare "complete" log line as the success signal;
- crons with no dead-man alarm.

Combined, the first real exercise would be an unattended 02:00 write to production prices that nobody is alerted about. All six lenses independently reached the same core findings.

## Top risks (ranked)

1. **CRITICAL: Unguarded bulk UPDATE on 60,000 production prices.**
   - *Failure mode:* a NULL, zero, currency-mismatched or mis-matched scraped price minus 1% is written to every SKU in one statement. There is no dry run, row ceiling, price floor, delta cap or rollback snapshot. One statement also means no early stop and a long table lock on the table order processing uses.
   - *Grounded in:* feedback-dry-run-before-bulk-write (2026-03, 40,000 SKUs set to $0).
   - *Fix:* add a dry run with a row count and sample diff; abort above a ceiling; reject prices at or below zero or below cost plus margin; cap per-SKU change; snapshot prices for one-command rollback; apply in batches.

2. **CRITICAL: Staging "test" is unsafe and proves nothing.**
   - *Failure mode:* staging is a production copy with live customer emails, so price-drop, wishlist, feed or webhook hooks can reach real customers. Staging is also re-copied nightly, so a week there says nothing about the production write path.
   - *Grounded in:* feedback-staging-has-real-customers (12,000 real customers emailed).
   - *Fix:* use a read-only production shadow run that writes to a proposed-prices table and review the diff distribution. Disable outbound side effects before any staging run.

3. **HIGH: Flag defaults ON.**
   - *Failure mode:* the night it deploys, it reprices production unattended. A missing config row also means "live".
   - *Grounded in:* feedback_flags_default_off.
   - *Fix:* default OFF and fail closed. Roll out in stages (shadow, canary SKUs, wider, all) with automated gates.

4. **HIGH: Zero or stale rows still report success.**
   - *Failure mode:* a blocked scraper or changed competitor layout leaves competitor_prices empty, partial or stale. The job still logs "repricing complete" and either does nothing or reprices from a single outlier competitor.
   - *Grounded in:* feedback_zero_rows_is_not_success (9 days over an empty table).
   - *Fix:* assert minimum rows per competitor, SKU coverage and freshness, and fail loudly while skipping the write. Log scraped, matched, changed, skipped and rejected counts.

5. **HIGH: No dead-man alarm, and the jobs are chained by clock.**
   - *Failure mode:* a stopped cron or expired credential goes unnoticed while prices go stale. Job 2 can run on yesterday's data or a half-written table.
   - *Grounded in:* feedback-cron-needs-deadman (export dead for 3 weeks).
   - *Fix:* gate job 2 on job 1's success marker. Send an external heartbeat on a separate channel that alerts if success is missing by a set time or a run reports zero rows.

6. **MEDIUM: Business logic and scale blind spots.**
   - *Failure mode:* "lowest minus 1%" is a race to the bottom. It ignores margin, MAP, out-of-stock listings and wrong SKU matches. A single serial scrape is fragile, and three scrapers need ongoing human upkeep, which works against the North Star of no added headcount.
   - *Grounded in:* the scaling and premortem lenses, plus general practice.
   - *Fix:* add outlier and out-of-stock filtering and a match-rate monitor. Shard and retry the scrapes. Evaluate a licensed price feed. Check ToS.

7. **MEDIUM: Bespoke one-off pipeline.**
   - *Failure mode:* every guardrail is hand-rolled, or skipped as here.
   - *Grounded in:* the simplicity-reuse lens.
   - *Fix:* reuse any existing bulk-write or job framework. If none exists, build one small reusable "propose, review diff, apply with guards" step.

## Conditions to satisfy before proceeding
1. Replace the one-shot UPDATE with a guarded apply step: a dry run (count plus sample diff), a row ceiling, a price floor at cost plus margin, a per-SKU change cap, a pre-write snapshot with a tested rollback, and batched writes.
2. Do not run on staging. Use a read-only production shadow run into a proposed-prices table, review the diff, and disable outbound side-effect hooks.
3. Default `auto_repricing` to OFF and fail closed. Roll out in stages (shadow, canary, wider, all) with automated gates.
4. Add pre-write assertions on rows per competitor, SKU coverage and freshness, and exclude out-of-stock and outlier prices. Abort loudly and log the counts.
5. Chain job 2 on job 1's success, and add an external dead-man heartbeat on a separate channel for both jobs.
6. Check for an existing bulk-write or repricing framework and reuse it. Weigh a licensed price feed against scrapers and confirm scraping is permitted under ToS.

## What this gets right
- The goal is clear and bounded (60,000 SKUs, three competitors, nightly, minus 1%), which makes the guardrails easy to specify.
- Separating the scrape (job 1) from the reprice (job 2) through `competitor_prices` leaves a natural seam for validation, a dry-run diff and a proposed-prices table.
- A feature flag is the right rollout mechanism; only its default is wrong.
- The instinct to test before launch is right; the method needs to change.
- It is small and avoids heavy infrastructure, which suits the North Star of no added headcount.

## Lenses applied
past-mistakes, critical-landmines, scaling, exercised, premortem, simplicity-reuse. All six completed and none failed.
