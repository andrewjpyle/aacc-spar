# aacc-spar — an adversarial red-team panel for your plans

`aacc-spar` is a Claude Code skill that runs an adversarial, read-only review of a plan, PR, or
proposal **before** you commit to it. Instead of one generic critique, it fans out a small panel of
"lens" agents that each attack the subject from a different angle, then an Opus judge synthesizes a
ranked risk list and a **go / go-with-conditions / no-go** verdict.

## The one idea

A critic grounded in **your own past mistakes** catches repeats you have already paid for.

Generic "best-practice" review misses the traps that are specific to *you* — the thing that bit you
last month, the landmine you wrote a note-to-self about. This skill reads your project's Claude Code
auto-memory (`MEMORY.md` plus your `feedback_*` lesson files and your CRITICAL "re-read before acting"
landmines) and hands that catalog to the panel. The critique is measured against your real history,
not a textbook.

## What it does

- **Ground** — a Sonnet agent catalogs your past mistakes (`feedback_*` memories) and CRITICAL-tier
  safety landmines from your project's memory. If your memory states a North Star / scale goal, the
  scale lens uses it.
- **Spar** — six Sonnet "lens" agents run in parallel, each from one distinct angle:
  1. **Repeat-of-a-past-mistake** — does this risk repeating a catalogued `feedback_*` lesson? (Reads
     the actual lesson file to confirm before flagging.)
  2. **CRITICAL landmine** — does it risk triggering one of the CRITICAL landmines you have catalogued?
  3. **Scale** — where does it break, balloon in cost, or demand growing human effort at your target
     scale?
  4. **Built-but-never-exercised** — will it be validated against real, non-empty inputs, or just look
     successful over nothing?
  5. **Premortem** — it is three months later and this failed; what were the most likely causes?
  6. **Over-build / duplication** — does an existing system already do most of this, or is this the
     wrong altitude?
- **Judge** — an Opus agent dedupes and ranks the risks, weighs the strengths, and returns the verdict
  plus a full report.

## Install

Drop the `aacc-spar/` folder into your Claude Code skills directory:

```
~/.claude/skills/aacc-spar/
```

so that `~/.claude/skills/aacc-spar/SKILL.md` and `spar_workflow.js` both exist. (A project-local
`.claude/skills/` works too.) Restart or re-scan skills if your session was already open.

## Run

From the **root of the project you want the panel grounded in** (so it finds that project's memory):

```
/aacc-spar
```

Then tell it what to stress-test — a plan you just discussed, a file (a PRD or spec), or a PR /
branch / diff. The skill assembles the subject into a temp file, runs the workflow, writes the report
to `./spars/<slug>_<YYYY-MM-DD>.md` in the current directory, and relays the verdict.

You can also ask for it in plain language: "stress-test this plan", "poke holes in this", "play
devil's advocate", "red-team this PR", "what could go wrong with this approach".

## Read-only contract

- The skill and its workflow **never edit your plan or any code**. They only produce a report and a
  verdict. The point is to inform your decision, not to make it.
- A `no_go` or `go_with_conditions` is **advice, not a veto** — shipping intentional work is fine; the
  panel's job is to confirm the known traps are de-risked.
- Acting on any risk is a **separate step you drive** after reading the report.

## Requirements

- **Claude Code with the `Workflow` tool.** The fan-out and model tiering (Sonnet lenses, Opus judge)
  run as a Claude Code Dynamic Workflow.
- A project with Claude Code auto-memory is ideal — the more your `MEMORY.md` and `feedback_*` files
  capture, the sharper the grounding. With no memory the panel still spars, just from generic angles.

## License

MIT. See `LICENSE`.
