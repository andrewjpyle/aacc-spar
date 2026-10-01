---
name: feedback-staging-has-real-customers
metadata:
  type: feedback
---
SAMPLE DATA: fictional Acme Widgets, written for the aacc-spar demo.

Staging is a nightly copy of production, including real customer emails and real prices. A test campaign run against staging in 2026-05 emailed 12,000 real customers.

**Why:** Treating staging as a safe sandbox ignores that its data is live data.

**How to apply:** Never run side-effecting jobs (email, payments, partner APIs) against staging. Test against fixtures, or as a read-only shadow run that writes nowhere.
