---
name: feedback_zero_rows_is_not_success
metadata:
  type: feedback
---
SAMPLE DATA: fictional Acme Widgets, written for the aacc-spar demo.

The inventory sync logged 'sync complete' every night for 9 days while its source table was empty after a schema change.

**Why:** Success messages that do not check how much work was done hide a broken input.

**How to apply:** A job that ingests or transforms data asserts a minimum row count and fails loudly below it. Log counts, not just 'complete'.
