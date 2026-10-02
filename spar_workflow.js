export const meta = {
  name: 'aacc-spar',
  description: 'Adversarial review of a plan / PR / proposal, grounded in YOUR OWN past feedback_* mistakes and CRITICAL-tier landmines. Fan-out lenses → Opus judge → ranked risks + go/no-go verdict. Read-only; proposes, never edits.',
  phases: [
    { title: 'Ground', detail: 'catalog your past mistakes + CRITICAL landmines from memory' },
    { title: 'Spar', detail: 'fan-out adversarial lenses attack the subject, each from a distinct angle' },
    { title: 'Judge', detail: 'Opus dedupes + ranks risks into a go/no-go verdict' },
  ],
}

// ---- memory discovery ------------------------------------------------------
// Claude Code stores a project's auto-memory at ~/.claude/projects/<encoded cwd>/memory, where the
// encoded cwd is the absolute path with every non-alphanumeric character replaced by "-". Computing
// it exactly (instead of matching a basename) means the panel can never read another project's
// memory by accident.
const MEMORY_DIR_COMMAND = 'D="$HOME/.claude/projects/$(pwd | sed \'s/[^A-Za-z0-9]/-/g\')/memory"; [ -d "$D" ] && echo "$D"'
// Lesson files: both spellings are in common use.
const FEEDBACK_PREFIXES = ['feedback_', 'feedback-']

// ---- schemas ---------------------------------------------------------------
const GROUND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    memory_dir: { type: 'string', description: 'absolute path to the Claude Code auto-memory dir for the current project' },
    critical_landmines: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { slug: { type: 'string' }, summary: { type: 'string' } }, required: ['slug', 'summary'] },
      description: 'the CRITICAL "re-read before acting" tier from MEMORY.md: whatever landmines the user has actually catalogued, as {slug, summary}',
    },
    past_mistakes: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { slug: { type: 'string' }, summary: { type: 'string' }, file: { type: 'string' } }, required: ['slug', 'summary'] },
      description: 'the user\'s catalogued lessons as indexed in MEMORY.md (slug + one-line summary; file path optional)',
    },
    north_star: { type: 'string', description: 'the North Star / scale goal as stated in MEMORY.md, or "" if none is stated' },
  },
  required: ['memory_dir', 'critical_landmines', 'past_mistakes', 'north_star'],
}

const LENS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          title: { type: 'string', description: 'one-line statement of the risk' },
          why: { type: 'string', description: 'the concrete failure mode: what breaks and how' },
          grounded_in: { type: 'string', description: 'the feedback_* slug or CRITICAL landmine this maps to, or "general" if not tied to a catalogued lesson' },
          recommendation: { type: 'string', description: 'the specific change that would mitigate it' },
        },
        required: ['severity', 'title', 'why', 'grounded_in', 'recommendation'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' }, description: 'what this subject gets RIGHT (so the judge does not only see negatives)' },
  },
  required: ['risks', 'strengths'],
}

const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['go', 'go_with_conditions', 'no_go'], description: 'the overall recommendation' },
    summary: { type: 'string', description: 'one-paragraph headline of the verdict and the single biggest concern' },
    top_risks: { type: 'array', items: { type: 'string' }, description: 'the highest-severity risks, most important first, each one line' },
    conditions: { type: 'array', items: { type: 'string' }, description: 'concrete things to satisfy BEFORE proceeding (empty if verdict=go)' },
    report_markdown: { type: 'string', description: 'the complete human-readable spar report to write to a local file' },
  },
  required: ['verdict', 'summary', 'top_risks', 'conditions', 'report_markdown'],
}

// ---- the adversarial lenses ------------------------------------------------
// Each lens attacks the subject from ONE distinct angle so they don't collapse
// into the same generic critique. Grounded lenses get the memory catalog + dir
// and are told to Read the actual feedback files before asserting a match.
const LENSES = [
  {
    key: 'past-mistakes',
    instruction: [
      'LENS: REPEAT-OF-A-PAST-MISTAKE. The user keeps a catalog of hard-won lessons (the PAST MISTAKES list',
      'below: each is a `feedback_*` memory). For EACH lesson this subject plausibly risks repeating, open the',
      'actual file (paths given; use Read) and confirm the match against its real content BEFORE raising a risk -',
      'do not pattern-match on the one-line summary alone. Set grounded_in to that feedback slug. Conservative:',
      'only real, defensible repeats.',
    ].join('\n'),
  },
  {
    key: 'critical-landmines',
    instruction: [
      'LENS: CRITICAL SAFETY LANDMINE. Check the subject against the CRITICAL "re-read before acting" landmines',
      'the user has catalogued in their own memory (the CRITICAL LANDMINES list below). Read each candidate',
      'landmine\'s memory file to confirm the subject genuinely risks triggering it before raising it: do not',
      'assume a match from the one-line summary alone. grounded_in = the landmine slug. These default to',
      'high/critical severity. Work off whatever landmines the user actually has; there is no fixed list.',
    ].join('\n'),
  },
  {
    key: 'scaling',
    instruction: [
      'LENS: SCALE. Stress-test the subject against the user\'s North Star / scale goal (see NORTH STAR below); if',
      'none is stated, reason about scale generically. Where does it break, balloon in cost, or demand O(N) HUMAN',
      'effort as the workload grows? Per-item manual steps, unbounded prefetch/N+1, a serial loop that should fan',
      'out, anything that is fine at a handful of items but fatal at the target scale. grounded_in = "scaling" (or a',
      'specific feedback slug if one fits, e.g. a prefetch/batching lesson).',
    ].join('\n'),
  },
  {
    key: 'exercised',
    instruction: [
      'LENS: BUILT-BUT-NEVER-EXERCISED. Will this actually be validated against REAL, non-empty inputs: or could',
      'it pass unit tests / run over empty inputs and merely LOOK successful? Demand: a concrete exercise step',
      'against live data, and an absence-of-work / "0 rows in N hours" alert for anything that ingests or watches.',
      'If those are missing, that IS the risk. grounded_in = a "built but never exercised" feedback slug if the user',
      'has one, else "general".',
    ].join('\n'),
  },
  {
    key: 'premortem',
    instruction: [
      'LENS: PREMORTEM. It is three months later and this subject has FAILED, been abandoned, or quietly caused',
      'harm. Enumerate the most likely causes: wrong assumptions, second-order effects, ops/maintenance burden,',
      'edge cases, the thing everyone overlooked. Be a hostile but fair critic; surface what the other lenses would',
      'miss. grounded_in = "general" unless a catalogued lesson fits.',
    ].join('\n'),
  },
  {
    key: 'simplicity-reuse',
    instruction: [
      'LENS: OVER-BUILD / DUPLICATION / ALTITUDE. Is this more machinery than the problem needs? Does an existing',
      'system, library, or command already in the user\'s codebase do most of this? Use Grep/Glob/Bash to check for',
      'a pre-existing tool before asserting one exists. Recommend reuse or a simpler shape. Also flag wrong altitude',
      '(a one-off scripted where a reusable skill/workflow belongs, or vice-versa). grounded_in = "general".',
    ].join('\n'),
  },
]

function lensPrompt(lens, subjectLabel, subjectText, ground) {
  return [
    'You are an ADVERSARIAL reviewer on a panel sparring against a proposed plan/change in the user\'s project.',
    'Your job is to find what is WRONG, risky, or naive: grounded in the user\'s own documented history, not',
    'generic best-practice. Apply ONLY your assigned lens; the other lenses are covered by other reviewers. Be',
    'specific, fair, and conservative: a real risk with a concrete failure mode beats a long list of vague worries.',
    'It is fine to return few or zero risks if the subject is genuinely sound on your lens.',
    '',
    lens.instruction,
    '',
    '── SUBJECT UNDER REVIEW: ' + subjectLabel + ' ──',
    subjectText,
    '── END SUBJECT ──',
    '',
    'NORTH STAR: ' + (ground.north_star || '(none stated: reason about scale generically)'),
    '',
    'CRITICAL LANDMINES (slug: summary):',
    (ground.critical_landmines || []).map((l) => '- ' + l.slug + ': ' + l.summary).join('\n'),
    '',
    'PAST MISTAKES catalog (slug: summary: file):',
    (ground.past_mistakes || []).map((m) => '- ' + m.slug + ': ' + m.summary + (m.file ? '  [' + m.file + ']' : '')).join('\n'),
    '',
    'Memory dir (to Read any feedback file in full): ' + ground.memory_dir,
    '',
    'Use Read/Grep/Bash to inspect referenced memory files and, if the subject names code paths, the repo.',
    'Return via the schema: risks[] (severity/title/why/grounded_in/recommendation) + strengths[].',
  ].join('\n')
}

function judgePrompt(subjectLabel, subjectText, ground, lensResults) {
  return [
    'You are the presiding JUDGE of an adversarial review panel for the user\'s project. Six lenses each sparred',
    'against the subject from a distinct angle. Synthesize their findings into ONE decision. You are READ-ONLY: you',
    'PROPOSE a verdict and risks; nothing is applied and the plan is not edited.',
    '',
    'Method: dedupe overlapping risks (keep the sharpest framing); rank by severity × likelihood × blast-radius;',
    'weigh the strengths too so the verdict is fair, not reflexively negative. Choose:',
    '  - "go": no blocking risks; minor notes at most.',
    '  - "go_with_conditions": sound direction, but specific things MUST be satisfied first (list them in conditions).',
    '  - "no_go": a critical flaw or a repeat of a catalogued mistake that should stop this as-is.',
    'Honor the user\'s ethos: shipping intentional work is fine; the bar is "have we de-risked the known traps".',
    '',
    '── SUBJECT: ' + subjectLabel + ' ──',
    subjectText,
    '── END SUBJECT ──',
    '',
    'NORTH STAR: ' + (ground.north_star || '(none stated)'),
    '',
    'LENS FINDINGS (JSON, one object per lens that completed; a lens absent here FAILED and was not run, so do not',
    'treat its angle as clean, and name it in "Lenses applied"):',
    JSON.stringify(lensResults),
    '',
    'Return via schema. `report_markdown` = a complete report with these sections (write "none" where empty):',
    '# Spar: ' + subjectLabel,
    'Verdict (with one-line rationale) · Summary · Top risks (ranked; each: severity, the failure mode,',
    'what it is grounded_in, the fix) · Conditions to satisfy before proceeding · What this gets right',
    '(strengths) · Lenses applied. Keep it tight and skimmable; lead with the verdict.',
    '`top_risks` = the few highest-severity items, most important first. `conditions` = concrete pre-conditions',
    '(empty array iff verdict is "go").',
  ].join('\n')
}

// ---- run -------------------------------------------------------------------
// Normalize args: the Workflow runtime can hand a JSON-encoded STRING through
// rather than an object (esp. when the inline value has heavy escaping). Parse
// it so a stringified payload still binds: otherwise every field silently
// defaults and the panel spars an empty subject.
let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
A = A || {}
const subjectLabel = A.subject_label || 'untitled subject'
const subjectText = A.subject_text || ''
const subjectPath = A.subject_path || ''

// FAIL LOUD on an empty subject. Proceeding would produce a confident-looking
// verdict over nothing: the exact "looks successful over empty input" trap the
// panel exists to catch. Refuse instead of misleading.
if (!subjectText.trim() && !subjectPath.trim()) {
  throw new Error(
    'aacc-spar: no subject provided. Pass args.subject_text (inline) OR args.subject_path ' +
    '(a file the lens agents will Read). Refusing to spar an empty subject.'
  )
}

// Prefer a file path for big/escaping-heavy subjects (PR diffs): the agents Read
// it directly, so nothing has to survive inline-arg escaping.
const subjectForPrompt = subjectText.trim()
  ? subjectText
  : '[This is a FILE PATH: use Read to open it IN FULL; its contents ARE the subject:]\n' + subjectPath
log(`Sparring against: ${subjectLabel} (${subjectText.trim() ? subjectText.length + ' chars inline' : 'via file ' + subjectPath})`)

phase('Ground')
let ground = await agent(
  [
    'Catalog the user\'s hard-won lessons so an adversarial panel can ground its critique. Use bash + Read.',
    'Steps:',
    '1. Find the auto-memory dir for the CURRENT project, EXACTLY. Claude Code names it after the project path with',
    '   every character that is not a letter or digit replaced by "-". Run this and nothing fuzzier:',
    '     ' + MEMORY_DIR_COMMAND,
    '   It prints the dir if it exists. If it prints nothing, try a repo-local `memory/` dir: `ls -d "$PWD"/memory 2>/dev/null`.',
    '   NEVER pick another project\'s memory dir, even if its name looks similar: that would ground the review in the',
    '   wrong project\'s history. Set memory_dir to the chosen absolute path, or "" if neither exists.',
    '2. Read MEMORY.md in that dir. Extract:',
    '   - critical_landmines: every bullet under any heading containing "CRITICAL" (for example "CRITICAL: re-read',
    '     before acting"), as {slug, summary}. The slug is the linked memory file name without .md.',
    '   - north_star: the North Star / scale goal statement if one is stated, else "".',
    '3. past_mistakes: parse MEMORY.md ITSELF; it is the user\'s curated index of these lessons. Collect every linked',
    '   lesson file whose name starts with ' + FEEDBACK_PREFIXES.map((p) => '"' + p + '"').join(' or ') + ' (both spellings are',
    '   common), across ALL sections including the CRITICAL tier. For each, return {slug (the file name without .md),',
    '   summary (the one-line description around that link)}. Do NOT open each file individually; reading MEMORY.md',
    '   once is the whole job and keeps this fast. Be complete FROM the index.',
    'Missing a lesson means the panel cannot catch its repeat, so harvest every lesson link. Return via schema.',
  ].join('\n'),
  { label: 'ground', schema: GROUND_SCHEMA, model: 'sonnet' }
)
if (!ground) {
  // A dropped connection mid-response must not crash the whole panel; degrade to an
  // empty catalog so the lenses still spar the subject (they can Read memory themselves).
  log('⚠ ground agent returned null (API drop): proceeding with an empty memory catalog')
  ground = { memory_dir: '', critical_landmines: [], past_mistakes: [], north_star: '' }
}
log(`Grounded: ${(ground.past_mistakes || []).length} past-mistake memories + ${(ground.critical_landmines || []).length} CRITICAL landmines`)

phase('Spar')
const lensResults = (await parallel(
  LENSES.map((lens) => () =>
    agent(lensPrompt(lens, subjectLabel, subjectForPrompt, ground), {
      label: `lens:${lens.key}`,
      phase: 'Spar',
      schema: LENS_SCHEMA,
      model: 'sonnet',
    }).then((r) => (r ? { lens: lens.key, ...r } : null))
  )
)).filter(Boolean)

const totalRisks = lensResults.reduce((n, r) => n + (r.risks ? r.risks.length : 0), 0)
const missing = LENSES.length - lensResults.length
log(`Panel returned ${totalRisks} risks across ${lensResults.length} of ${LENSES.length} lenses` +
  (missing ? ` (${missing} lens agent(s) failed and are excluded, not counted as clean)` : ''))
if (lensResults.length === 0) {
  throw new Error('aacc-spar: every lens agent failed; refusing to produce a verdict from no findings.')
}

phase('Judge')
const verdict = await agent(judgePrompt(subjectLabel, subjectForPrompt, ground, lensResults), {
  label: 'judge',
  schema: JUDGE_SCHEMA,
  model: 'opus',
})

if (!verdict) {
  throw new Error('aacc-spar: the judge agent returned nothing; no verdict was produced. Re-run the workflow.')
}
return verdict
