# Plan: nightly competitor repricing (Acme Widgets, SAMPLE)

Goal: match the lowest competitor price on our 60,000 SKUs every night.

Approach:
1. A cron job at 02:00 scrapes three competitor sites and writes their prices to `competitor_prices`.
2. A second job reads `competitor_prices` and sets each SKU's price to the lowest competitor price minus 1%,
   writing directly to the production `products` table in one UPDATE.
3. We will test it first by running it against the staging database for a week.
4. The job logs "repricing complete" when it finishes. We check the logs if something seems off.
5. Behind the `auto_repricing` feature flag, enabled by default so it starts working immediately.
