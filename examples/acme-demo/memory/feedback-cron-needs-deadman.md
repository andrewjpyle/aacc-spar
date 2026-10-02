---
name: feedback-cron-needs-deadman
metadata:
  type: feedback
---
SAMPLE DATA: fictional Acme Widgets, written for the aacc-spar demo.

The nightly order export stopped in 2026-02 when its server was replaced. Nothing alerted; finance noticed 3 weeks later.

**Why:** A cron job that silently stops produces no error to catch.

**How to apply:** Every scheduled job gets a heartbeat checked by a separate system on a separate channel, alerting when the heartbeat is missing.
