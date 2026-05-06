import type { Dimension, ScoredQuestion } from '@website-agent/core';

export type MockQuestion = ScoredQuestion & {
  type: 'single_choice';
  body: string;
  options: Array<{ id: string; label: string }>;
  explanation: string;
};

export const mockDimensions: Dimension[] = [
  {
    id: 'react-hooks',
    name: 'React Hooks 基础',
    weight: 1,
  },
];

export const mockQuestions: MockQuestion[] = [
  {
    id: 'react-hooks-use-state',
    dimensionId: 'react-hooks',
    type: 'single_choice',
    body: '在 React 函数组件中，哪个 Hook 用于声明本地状态？',
    options: [
      { id: 'A', label: 'useState' },
      { id: 'B', label: 'useEffect' },
      { id: 'C', label: 'useMemo' },
      { id: 'D', label: 'useRef' },
    ],
    correctAnswer: 'A',
    difficulty: 'easy',
    explanation: 'useState 用于在函数组件中声明和更新本地状态。',
  },
];
