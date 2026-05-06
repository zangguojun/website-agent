import { mockDimensions, mockQuestions } from '../mock-data';

export async function runQuestionGenerationWorkflow() {
  return {
    dimensions: mockDimensions,
    totalQuestions: mockQuestions.length,
    questions: mockQuestions,
  };
}
