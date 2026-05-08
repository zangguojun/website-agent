import type { AnswerRecord, GeneratedQuestion, TestPlan } from "../session/types";

export const sessionPlanKey = (sessionId: string) => ["session", sessionId, "plan"] as const;

export const sessionQuestionsKey = (sessionId: string) => ["session", sessionId, "questions"] as const;

export const sessionAnswersKey = (sessionId: string) => ["session", sessionId, "answers"] as const;

export type SessionPlanQueryData = TestPlan;
export type SessionQuestionsQueryData = GeneratedQuestion[];
export type SessionAnswersQueryData = AnswerRecord[];
