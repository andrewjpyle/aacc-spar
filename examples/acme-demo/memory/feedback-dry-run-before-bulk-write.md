---
name: feedback-dry-run-before-bulk-write
metadata:
  type: feedback
---
SAMPLE DATA: fictional Acme Widgets, written for the aacc-spar demo.

On 2026-03-14 a pricing script ran a single UPDATE against products with a bad join and set 40,000 SKUs to $0 for 3 hours before anyone noticed.

**Why:** A bulk write with no dry run and no row-count check gives no chance to see the blast radius first.

**How to apply:** Every bulk write ships with a --dry-run that prints the row count and a sample of changes, and aborts if the count exceeds an expected ceiling. Keep the old values so one command can roll back.
