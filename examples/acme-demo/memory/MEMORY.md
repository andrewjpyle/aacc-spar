# Acme Widgets memory (SAMPLE DATA for the aacc-spar demo; fictional company)

North Star: process 1,000,000 orders a day without adding headcount.

## CRITICAL: re-read before acting
- [Never run a bulk write without a dry run first](feedback-dry-run-before-bulk-write.md): the 2026-03 price wipe changed 40,000 SKUs to $0.
- [The staging database is a copy of production with live customer emails](feedback-staging-has-real-customers.md): a "test" campaign emailed 12,000 real customers.

## Lessons
- [A job that reports success over zero rows is a silent failure](feedback_zero_rows_is_not_success.md): the inventory sync "passed" for 9 days while reading an empty table.
- [Cron jobs need a dead-man alarm on a separate channel](feedback-cron-needs-deadman.md): the nightly export stopped and nobody noticed for 3 weeks.
- [Feature flags default OFF in production](feedback_flags_default_off.md): a half-built checkout flow went live because its flag defaulted ON.
