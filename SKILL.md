---
name: aacc-spar
description: |
  Use this skill when the user invokes `/aacc-spar` (or asks to "stress-test this plan", "poke holes
  in this", "play devil's advocate", "spar with me on this proposal/PR", "what could go wrong with
  this approach", or wants an adversarial / red-team review BEFORE committing to a non-trivial plan,
  architecture decision, or pull request). Runs a read-only Dynamic Workflow that grounds itself in
  YOUR OWN catalogued past mistakes (the `feedback_*` memories) and CRITICAL-tier safety landmines,
  then fans out adversarial "lens" agents — repeat-of-a-past-mistake, CRITICAL landmine, scale,
  built-but-never-exercised, premortem, over-build/duplication — and an Opus judge synthesizes a
  ranked risk list + a go / go-with-conditions / no-go verdict.

  It PROPOSES only — it writes a spar report to a local file and never edits the plan or any code.
  Acting on the critique is a separate step you drive.

  Skip this skill for: a quick correctness review of a diff (use a line-level /code-review), a
  security audit, or a simple yes/no question that doesn't need a panel.
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - Workflow
---

# aacc-spar — Strategy sparring partner (adversarial review)

A red-team panel for a plan before you commit to it. The core idea: the highest-leverage critic is
one grounded in *your own* history, so it catches you repeating a mistake you have already paid for.
The fan-out logic lives in `spar_workflow.js`; this skill assembles the subject, runs the workflow,
writes the report, and relays the verdict.

## When to invoke
**Invoke when** the user types `/aacc-spar` or asks to stress-test / red-team / poke holes in /
devil's-advocate a plan, proposal, architecture call, or PR before committing.

**Skip when** they want line-level bug review, a security audit, or a trivial decision.

## How the grounding works
The workflow reads YOUR project's Claude Code auto-memory dir and treats `MEMORY.md` as your curated
index of hard-won lessons. Two kinds of memory drive the panel:
- **`feedback_*` memories** — your catalogued past mistakes (one lesson per file, indexed in
  `MEMORY.md`). The panel checks the subject against these to catch repeats.
- **CRITICAL "re-read before acting" landmines** — the highest-risk tier of your memory. The panel
  checks the subject against whatever landmines YOU have catalogued (it reads each landmine's memory
  file to confirm a match). It works off your real landmines, not a hardcoded list.

If your memory has a stated North Star / scale goal, the scale lens uses it; otherwise it reasons
about scale generically.

## How to run

1. **Run from the root of the project you want the panel grounded in.** The workflow discovers that
   project's Claude Code auto-memory dir (`ls -d "$HOME"/.claude/projects/*/memory`, preferring the
   dir whose path best matches the current directory's basename; a repo-local `memory/` dir is also
   accepted). Running from the right project is what makes the critique grounded in *your* history.
2. **Assemble the subject INTO A FILE** — this is the key step, because the workflow runs headless
   and the sub-agents cannot see this conversation. **Always write the subject to a temp file and
   pass its path** (`subject_path`), not a giant inline string: a big diff full of quotes/backslashes
   can arrive mangled or empty as an inline arg. Write `/tmp/spar_<slug>.md` containing:
   - **A PR / branch / diff** → `gh pr view <n>` + `gh pr diff <n>` (or `git diff <range>`): the
     title, description, and the diff (trim huge diffs to the substantive hunks).
   - **A file** (e.g. a PRD, an initiative/spec doc) → copy/Read it into the temp file.
   - **A plan you just discussed / free text** → write a tight, NEUTRAL restatement: the goal, the
     proposed approach, the concrete steps, and any stated constraints. Do **not** pre-defend or
     editorialize it — the panel must judge the real proposal, not your gloss of it.
   Also pick a short `subject_label` (e.g. `"prod-write guard hook"`).
   (For a *small* free-text subject you may pass `subject_text` inline instead; the workflow accepts
   either, and **throws** if both are empty rather than sparring nothing.)
3. **Run the workflow.** Invoke the `Workflow` tool with a SMALL args object (path + label only):
   `{ scriptPath: "<skill-dir>/spar_workflow.js", args: { subject_label, subject_path } }`
4. **Write the report.** The workflow returns `{ verdict, summary, top_risks, conditions, report_markdown }`.
   Get today's date (`date +%F`) and write `report_markdown` to `./spars/<slug>_<YYYY-MM-DD>.md` in
   the current directory (create the `spars/` folder if missing; `<slug>` = the subject label in
   lowercase_underscores).
5. **Relay the verdict.** Present `verdict` (go / go-with-conditions / no-go), `top_risks`, and
   `conditions` to the user as a short, skimmable list — lead with the verdict. Link the report path.

## Read-only contract (important)
- The workflow and this skill **never edit the plan or any code** — they only produce a report and a
  verdict. The point is to inform your decision, not to make it.
- A `no_go` or `go_with_conditions` is **advice, not a veto** — shipping intentional work is fine; the
  panel's job is to confirm the known traps are de-risked.
- Acting on any risk (rewriting the plan, adding an absence-of-work alert, etc.) is a **separate step
  you drive** after reading the report.

## Cost / cadence
- Ground = Sonnet (catalogs the `feedback_*` memories), six lenses = Sonnet (the adversarial
  reasoning), judge = Opus (synthesis) — model tiering by job. A run is ~8 agents, a panel not a swarm.
- Use before committing to any non-trivial plan or PR.
- Requires Claude Code's `Workflow` tool.
