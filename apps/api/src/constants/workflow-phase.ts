/** Aligns with `docs/superpowers/specs/2026-05-07-real-agent-mastra-sse-design.md` §6 phase gates. */

export const WORKFLOW_PHASES = ['clarify', 'plan', 'questions', 'report', 'done'] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];
