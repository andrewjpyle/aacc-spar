"""Build the README graphics for aacc-spar.

    python docs/assets/src/build.py
    uv run --with playwright --with pillow python docs/assets/src/render.py docs/assets/src docs/assets

hero, how-it-works and lenses are structural: the lens names and angles are read from
spar_workflow.js, so they cannot drift from the code. anatomy renders ONLY from
captures/demo_report.json, a real run of this skill against the fictional Acme Widgets demo project
in examples/acme-demo (sample memory, sample plan; no real user's memory is shown).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import readme_kit as k  # noqa: E402

REPO = "AACC-SPAR"
SRC = (ROOT / "spar_workflow.js").read_text(encoding="utf-8")

LENS_NAMES = {"past-mistakes": "Mistakes", "critical-landmines": "Landmine", "scaling": "Scale",
              "exercised": "Exercised", "premortem": "Premortem", "simplicity-reuse": "Reuse"}


def lenses() -> list[tuple[str, str]]:
    """(key, the lens's one-line angle) straight from the LENSES array in spar_workflow.js."""
    out = []
    for key, first in re.findall(r"key: '([a-z-]+)',\s*instruction: \[\s*'LENS: ([^']+)'", SRC):
        out.append((key, first.strip()))
    assert len(out) == 6, f"expected 6 lenses in spar_workflow.js, found {len(out)}"
    return out


def hero() -> str:
    names = [LENS_NAMES[key] for key, _ in lenses()]
    return k.hero(
        "AACC-SPAR · CLAUDE CODE SKILL · MIT",
        "A red team", "for your plans.",
        "Six adversarial lenses attack a plan, PR or proposal before you commit, grounded in your own past mistakes. An Opus judge returns "
        "<b style='color:var(--ivory);font-weight:600'>go, go with conditions, or no-go</b>, with ranked risks.",
        [("Your history, not a textbook", "It reads your Claude Code memory and checks the plan against lessons you already paid for."),
         ("Six angles, no overlap", "Past mistakes, landmines, scale, never-exercised, premortem, over-build."),
         ("Proposes, never edits", "A report and a verdict. Acting on it is your call.")],
        "1 GROUND · 6 LENSES · 1 JUDGE · 0 EDITS",
        k.wheel(names, "VERDICT", "Judge", size=560, node_r=52),
        f"{REPO} · HOW IT WORKS")


def architecture() -> str:
    boxes = (k.box(56, 200, 230, 230, "SUBJECT", ["a plan, PR or spec", "written to a file", "read in full by", "every agent"])
             + k.box(56, 470, 230, 190, "YOUR MEMORY", ["MEMORY.md index", "feedback_* / feedback-*", "CRITICAL landmines", "North Star"])
             + k.box(366, 330, 220, 170, "GROUND · SONNET", ["exact memory dir", "catalog lessons", "never another", "project's memory"])
             + k.box(666, 200, 260, 460, "6 LENSES · SONNET", ["in parallel:", "", "past mistake", "critical landmine", "scale", "built, never exercised", "premortem", "over-build / reuse", "", "each reads the real", "lesson file before", "it flags a match"], True)
             + k.box(1006, 260, 338, 170, "JUDGE · OPUS", ["dedupe + rank risks", "weigh the strengths", "go / conditions / no-go"], True)
             + k.box(1006, 500, 338, 160, "REPORT", ["./spars/<slug>_<date>.md", "nothing edited", "you decide"]))
    arrows = [(286, 315, 356, 390), (286, 565, 356, 450), (586, 415, 656, 415), (926, 345, 996, 345), (1175, 430, 1175, 490)]
    return k.flow("HOW IT WORKS", f"Ground, spar, {k.em('judge')}. Never edit.",
                  "read-only end to end · a failed lens is named, never counted as clean · an empty subject is refused",
                  boxes, arrows, f"{REPO} · HOW IT WORKS")


def lens_catalog() -> str:
    blurbs = {
        "past-mistakes": ("Would this repeat a lesson you already paid for?", "reads the feedback file", "grounded_in: the lesson slug"),
        "critical-landmines": ("Could it trip a CRITICAL landmine?", "confirms against the file", "defaults to high severity"),
        "scaling": ("Where does it break at your North Star?", "O(N) human effort, N+1", "uses your stated scale goal"),
        "exercised": ("Will it run on real, non-empty input?", "or only look green", "asks for an absence alarm"),
        "premortem": ("Three months on, it failed. Why?", "second-order effects", "what other lenses miss"),
        "simplicity-reuse": ("Does something already do this?", "greps your codebase first", "flags wrong altitude"),
    }
    cards = [({"past-mistakes": "PAST MISTAKE", "simplicity-reuse": "OVER-BUILD / REUSE"}.get(key, LENS_NAMES[key].upper()), blurbs[key][0], blurbs[key][1], blurbs[key][2]) for key, _ in lenses()]
    return k.catalog("THE SIX LENSES", f"Six angles, {k.em('one')} verdict.",
                     "Each lens attacks from one angle only, so the panel does not collapse into one generic critique.",
                     cards, f"{REPO} · LENSES FROM spar_workflow.js", cols=3, card_height=220)


def anatomy() -> str:
    c = k.load_capture(HERE / "captures" / "demo_report.json")
    md = c["output"]
    title = re.search(r"^# (.+)$", md, re.M).group(1)
    verdict = re.search(r"\*\*Verdict: ([^*]+)\*\*", md).group(1)
    risks = re.findall(r"^\d+\. \*\*(CRITICAL|HIGH|MEDIUM|LOW): ([^*]+?)\.?\*\*\s*\n(?:.*\n)*?\s*- \*Grounded in:\* ([^\n(]+)", md, re.M)
    lenses_line = re.search(r"## Lenses applied\n(.+)", md).group(1)
    lines = [("h1", k.esc(title)),
             ("b", f"Verdict: {k.esc(verdict)}"),
             ("h2", "Top risks, ranked, each tied to a lesson")]
    for sev, rtitle, grounded in risks[:5]:
        color = "var(--bad)" if sev == "CRITICAL" else "var(--amber)"
        lines.append(("li", f"<span class='mono' style='font-size:12px;color:{color};letter-spacing:.08em'>{sev}</span> {k.esc(rtitle)}"))
        lines.append(("li2", f"grounded in: <span class='mono' style='font-size:13px'>{k.esc(grounded.strip().rstrip('.,;'))}</span>"))
    lines.append(("h2", "Lenses applied"))
    lines.append(("i", k.esc(lenses_line)))
    lines.append(("m", f"examples/acme-demo · fictional sample data · captured {c['captured_at'][:10]}"))
    notes = [(100, "Opus judge verdict: go, go with conditions, or no-go. Here, no-go as written."),
             (205, "Each risk names the lesson it repeats, read from the project's own memory."),
             (330, "Both spellings count: feedback-dry-run... and feedback_flags... were both caught."),
             (470, "A lens that fails is named here, never silently counted as clean."),
             (560, "Real run, unedited report. The company and its lessons are fictional.")]
    return k.anatomy("ANATOMY OF A REAL SPAR", lines, notes, f"{REPO} · REAL RUN {c['captured_at'][:10]} · SAMPLE DATA: ACME", doc_width=840)


if __name__ == "__main__":
    pages = {"hero": hero(), "architecture": architecture(), "lenses": lens_catalog()}
    if (HERE / "captures" / "demo_report.json").exists():
        pages["anatomy"] = anatomy()
    k.write_pages(HERE, pages)
