import { resetInMemoryAgentSteps } from './agent-steps.repo';
import { resetInMemorySessionExamQuestions } from './session-exam-questions.repo';
import { resetSessionAnswersDrafts } from './session-answers-draft.repo';
import { resetInMemorySessionMessages } from './session-messages.repo';
import { resetInMemorySessions } from './sessions.repo';
import { resetStreamCheckpointThrottle } from './stream-checkpoints-write.repo';

/** Clears all in-memory stores used when `DATABASE_URL` is unset (tests / demos). */
export function resetApiMemoryStores(): void {
  resetInMemorySessions();
  resetInMemorySessionMessages();
  resetInMemorySessionExamQuestions();
  resetInMemoryAgentSteps();
  resetStreamCheckpointThrottle();
  resetSessionAnswersDrafts();
}
