import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWorkflow, happy, GROUND, LENS, VERDICT } from './harness.mjs';

const SUBJECT = { subject_label: 'demo plan', subject_text: 'Ship the thing on Friday.' };

test('refuses an empty subject instead of producing a verdict over nothing', async () => {
  await assert.rejects(runWorkflow({ subject_label: 'x' }, happy), /Refusing to spar an empty subject/);
});

test('accepts args that arrive as a JSON string', async () => {
  const { calls } = await runWorkflow(JSON.stringify(SUBJECT), happy);
  assert.match(calls.find((c) => c.opts.label === 'judge').prompt, /SUBJECT: demo plan/);
});

test('runs the ground agent, six distinct lenses, then the judge, with model tiering', async () => {
  const { result, calls } = await runWorkflow(SUBJECT, happy);
  const labels = calls.map((c) => c.opts.label);
  assert.equal(labels[0], 'ground');
  assert.equal(labels.at(-1), 'judge');
  const lenses = labels.filter((l) => l.startsWith('lens:'));
  assert.equal(new Set(lenses).size, 6);
  assert.equal(calls.find((c) => c.opts.label === 'ground').opts.model, 'sonnet');
  assert.ok(calls.filter((c) => c.opts.label.startsWith('lens:')).every((c) => c.opts.model === 'sonnet'));
  assert.equal(calls.find((c) => c.opts.label === 'judge').opts.model, 'opus');
  assert.deepEqual(result, VERDICT);
});

test('ground looks up the memory dir by exact path, never by fuzzy match', async () => {
  const { calls } = await runWorkflow(SUBJECT, happy);
  const ground = calls.find((c) => c.opts.label === 'ground').prompt;
  assert.match(ground, /sed 's\/\[\^A-Za-z0-9\]\/-\/g'/);
  assert.match(ground, /NEVER pick another project/);
  assert.doesNotMatch(ground, /best matches/);
  // The project root is the git main checkout (first worktree entry), falling back to the cwd.
  assert.match(ground, /git worktree list --porcelain 2>\/dev\/null \| sed -n '1s\/\^worktree \/\/p'/);
  assert.match(ground, /\[ -n "\$R" \] \|\| R="\$\(pwd\)"/);
  assert.match(ground, /\$\{CLAUDE_CONFIG_DIR:-\$HOME\/\.claude\}\/projects\//);
});

test('ground harvests both lesson spellings, feedback_ and feedback-', async () => {
  const { calls } = await runWorkflow(SUBJECT, happy);
  const ground = calls.find((c) => c.opts.label === 'ground').prompt;
  assert.match(ground, /"feedback_"/);
  assert.match(ground, /"feedback-"/);
});

test('every lens sees the subject, the landmines and the past mistakes', async () => {
  const { calls } = await runWorkflow(SUBJECT, happy);
  for (const c of calls.filter((c) => c.opts.label.startsWith('lens:'))) {
    assert.match(c.prompt, /Ship the thing on Friday/);
    assert.match(c.prompt, /feedback-never-migrate-on-friday/);
    assert.match(c.prompt, /feedback_dry_run_first/);
    assert.match(c.prompt, /1M orders a day/);
  }
});

test('a subject_path is handed to agents as a file to Read', async () => {
  const { calls } = await runWorkflow({ subject_label: 'p', subject_path: '/tmp/plan.md' }, happy);
  assert.match(calls.find((c) => c.opts.label === 'lens:premortem').prompt, /FILE PATH.*\n\/tmp\/plan\.md/);
});

test('a failed ground agent degrades to an empty catalog and the panel still runs', async () => {
  const { calls, logs } = await runWorkflow(SUBJECT, (l) => (l === 'ground' ? null : happy(l)));
  assert.equal(calls.filter((c) => c.opts.label.startsWith('lens:')).length, 6);
  assert.ok(logs.some((m) => /empty memory catalog/.test(m)));
});

test('a failed lens is excluded and reported, not counted as a clean lens', async () => {
  const { calls, logs } = await runWorkflow(SUBJECT, (l) => (l === 'lens:scaling' ? null : happy(l)));
  const judge = calls.find((c) => c.opts.label === 'judge').prompt;
  const findings = JSON.parse(judge.split('\n').find((line) => line.startsWith('[{')));
  assert.equal(findings.length, 5);
  assert.ok(!findings.some((f) => f.lens === 'scaling'));
  assert.ok(logs.some((m) => /1 lens agent\(s\) failed/.test(m)));
});

test('if every lens fails, it refuses to produce a verdict', async () => {
  await assert.rejects(
    runWorkflow(SUBJECT, (l) => (l.startsWith('lens:') ? null : happy(l))),
    /every lens agent failed/
  );
});

test('a judge that returns nothing is an error, not a silent empty result', async () => {
  await assert.rejects(runWorkflow(SUBJECT, (l) => (l === 'judge' ? null : happy(l))), /judge agent returned nothing/);
});

test('the memory-dir encoding matches Claude Code: every non-alphanumeric becomes "-"', () => {
  const out = execFileSync('sh', ['-c', "printf %s '/opt/a_b/my.project' | sed 's/[^A-Za-z0-9]/-/g'"], { encoding: 'utf8' });
  assert.equal(out, '-opt-a-b-my-project');
});

// The real shell command from the script, run against throwaway dirs (no real ~/.claude is touched).
async function memoryCommand() {
  const { calls } = await runWorkflow(SUBJECT, happy);
  const lines = calls.find((c) => c.opts.label === 'ground').prompt.split('\n');
  return lines[lines.findIndex((l) => /command from the current working directory/.test(l)) + 1].trim();
}
function sh(cmd, cwd, env) {
  try {
    return execFileSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } }).trim();
  } catch (e) {
    return (e.stdout || '').trim(); // the command exits 1 when the dir is absent
  }
}
const encode = (p) => p.replace(/[^A-Za-z0-9]/g, '-');

test('inside git, a subdirectory and a worktree resolve to the main checkout memory, as Claude Code does', async () => {
  const cmd = await memoryCommand();
  const cfg = realpathSync(mkdtempSync(join(tmpdir(), 'spar-cfg-')));
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'spar-repo-')));
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: repo, stdio: 'ignore' });
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'init');
  mkdirSync(join(repo, 'sub/dir'), { recursive: true });
  const wt = repo + '-wt';
  git('worktree', 'add', '-q', wt);
  const want = join(cfg, 'projects', encode(repo), 'memory');
  mkdirSync(want, { recursive: true });
  const env = { HOME: cfg, CLAUDE_CONFIG_DIR: cfg };
  assert.equal(sh(cmd, join(repo, 'sub/dir'), env), want);
  assert.equal(sh(cmd, wt, env), want);
});

test('outside git the cwd is the project, under CLAUDE_CONFIG_DIR, and a lookalike is never returned', async () => {
  const cmd = await memoryCommand();
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'spar-home-')));
  const cfg = realpathSync(mkdtempSync(join(tmpdir(), 'spar-cfg-')));
  const proj = realpathSync(mkdtempSync(join(tmpdir(), 'spar_proj.x-')));
  mkdirSync(join(cfg, 'projects', encode(proj) + '-other/memory'), { recursive: true });
  mkdirSync(join(home, '.claude/projects', encode(proj), 'memory'), { recursive: true });
  assert.equal(sh(cmd, proj, { HOME: home, CLAUDE_CONFIG_DIR: cfg }), '', 'neither a lookalike nor ~/.claude may be used when CLAUDE_CONFIG_DIR is set');
  assert.equal(sh(cmd, proj, { HOME: home }), join(home, '.claude/projects', encode(proj), 'memory'));
  mkdirSync(join(cfg, 'projects', encode(proj), 'memory'), { recursive: true });
  assert.equal(sh(cmd, proj, { HOME: home, CLAUDE_CONFIG_DIR: cfg }), join(cfg, 'projects', encode(proj), 'memory'));
});
