# Acme Widgets demo (fictional, sample data)

Everything here is made up for the aacc-spar demo: a company that does not exist, five sample
lessons in `memory/`, and a plan with five traps in `plan_nightly_repricing.md`.

`spars/nightly_competitor_repricing.md` is the **unedited** report from a real run of
`spar_workflow.js` (all 8 agents, none failed) on 2026-10-01. The README's anatomy graphic is
rendered from it.

## Reproduce it

1. Make a folder, put `plan_nightly_repricing.md` in it, and `cd` there.
2. Copy `memory/` to that folder's Claude Code memory dir:
   `~/.claude/projects/$(pwd | sed 's/[^A-Za-z0-9]/-/g')/memory/`
3. In Claude Code, run `/aacc-spar stress-test plan_nightly_repricing.md`.

Model output varies run to run, so your wording will differ; the five lessons should still be caught.
