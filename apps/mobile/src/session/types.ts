export type ClarificationQuestionType = "single_choice" | "multi_choice" | "free_text" | "confirm";

export type ClarificationOption = {
  id: string;
  label: string;
};

export type ClarificationQuestion = {
  id: string;
  type: ClarificationQuestionType;
  prompt: string;
  why: string;
  options?: ClarificationOption[];
};

export type ClarificationAnswer = {
  questionId: string;
  value: string | string[];
  label: string;
};

export type ClarificationTurn = {
  question: ClarificationQuestion;
  answer?: ClarificationAnswer;
};

export type TestPlanDimension = {
  id: string;
  name: string;
  description: string;
};

export type TestPlan = {
  target: string;
  scope: string;
  difficulty: "入门" | "中阶" | "进阶";
  questionCount: number;
  questionTypes: string[];
  dimensions: TestPlanDimension[];
  rationale: string;
};

export type GeneratedQuestion = {
  id: string;
  dimensionId: string;
  dimensionName: string;
  prompt: string;
  options: Array<{
    id: "A" | "B" | "C" | "D";
    label: string;
  }>;
  correctOptionId: "A" | "B" | "C" | "D";
  explanation: string;
};

export type AnswerRecord = {
  questionId: string;
  optionId: "A" | "B" | "C" | "D";
};

export type ReportMetric = {
  dimensionId: string;
  name: string;
  score: number;
};

export type ReportData = {
  score: number;
  mastery: "需要补基础" | "接近掌握" | "熟练" | "精通";
  summary: string;
  rationale: string;
  metrics: ReportMetric[];
  weaknesses: string[];
  explanations: Array<{
    questionId: string;
    title: string;
    explanation: string;
  }>;
};
