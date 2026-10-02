// Runs the REAL spar_workflow.js with stubbed Workflow globals (agent, parallel, phase, log, args),
// so the control flow is tested exactly as written, with no model calls.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(fileURLToPath(new URL('../spar_workflow.js', import.meta.url)), 'utf8')
  .replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export async function runWorkflow(args, respond) {
  const calls = [];
  const logs = [];
  const agent = async (prompt, opts) => {
    calls.push({ prompt, opts });
    return respond(opts.label, prompt, opts);
  };
  const parallel = async (thunks) => Promise.all(thunks.map((t) => t()));
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', SRC);
  const result = await fn(args, agent, parallel, () => {}, (m) => logs.push(m));
  return { result, calls, logs };
}

export const GROUND = {
  memory_dir: '/srv/acme/.claude/projects/-srv-acme-app/memory',
  critical_landmines: [{ slug: 'feedback-never-migrate-on-friday', summary: 'no schema changes before a weekend' }],
  past_mistakes: [{ slug: 'feedback_dry_run_first', summary: 'every bulk write gets a dry run' }],
  north_star: '1M orders a day',
};
export const LENS = { risks: [{ severity: 'high', title: 't', why: 'w', grounded_in: 'general', recommendation: 'r' }], strengths: ['s'] };
export const VERDICT = { verdict: 'go', summary: 'ok', top_risks: [], conditions: [], report_markdown: '# Spar' };

export const happy = (label) => (label === 'ground' ? GROUND : label === 'judge' ? VERDICT : LENS);
