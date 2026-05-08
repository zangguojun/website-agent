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
  {
    id: 'react-hooks-use-effect-empty-deps',
    dimensionId: 'react-hooks',
    type: 'single_choice',
    body: 'useEffect(fn, []) 的执行时机最接近下列哪一项？',
    options: [
      { id: 'A', label: '首次挂载并完成绘制后执行一次' },
      { id: 'B', label: '每次组件渲染都会执行' },
      { id: 'C', label: '仅当父组件重渲染时执行' },
      { id: 'D', label: '永远不会执行' },
    ],
    correctAnswer: 'A',
    difficulty: 'medium',
    explanation: '空依赖数组表示 effect 不依赖任何响应式值，通常在首次提交后运行一次。',
  },
  {
    id: 'react-hooks-conditional-call',
    dimensionId: 'react-hooks',
    type: 'single_choice',
    body: '下面哪一项违反 React Hooks 的调用规则？',
    options: [
      { id: 'A', label: '在 if 条件分支里调用 useState' },
      { id: 'B', label: '在自定义 Hook 内调用 useState' },
      { id: 'C', label: '在函数组件顶层调用 useEffect' },
      { id: 'D', label: '以 use 前缀命名自定义 Hook' },
    ],
    correctAnswer: 'A',
    difficulty: 'hard',
    explanation: 'Hooks 必须在每次渲染时以相同顺序调用，不能放在条件或循环中。',
  },
];
