import type { ClarificationTurn, GeneratedQuestion, TestPlan } from "./types";

export const mockClarificationTurns: ClarificationTurn[] = [
  {
    question: {
      id: "goal",
      type: "single_choice",
      prompt: "这次自测你更想验证哪类掌握程度？",
      why: "这个问题用于判断测试应偏概念理解、应用能力还是查漏补缺。",
      options: [
        { id: "interview", label: "准备面试" },
        { id: "system", label: "系统学习" },
        { id: "gap", label: "查漏补缺" },
        { id: "unsure", label: "不确定" }
      ]
    }
  },
  {
    question: {
      id: "depth",
      type: "single_choice",
      prompt: "你希望题目更接近哪种难度？",
      why: "难度会影响题目是否偏定义辨析、场景判断，还是边界条件推理。",
      options: [
        { id: "basic", label: "基础概念" },
        { id: "applied", label: "真实场景应用" },
        { id: "edge", label: "边界条件和陷阱" },
        { id: "mixed", label: "混合一点" }
      ]
    }
  },
  {
    question: {
      id: "scope",
      type: "free_text",
      prompt: "有没有你特别想测或特别不想测的范围？",
      why: "范围边界可以避免题目过宽，让诊断结果更贴近你的真实目标。"
    }
  }
];

export const mockTestPlan: TestPlan = {
  target: "验证对 React Server Components 的真实理解和应用能力",
  scope: "聚焦 Server/Client Component 边界、数据读取、缓存和常见误区",
  difficulty: "中阶",
  questionCount: 3,
  questionTypes: ["单选题"],
  rationale: "根据你的回答，这次测试会减少纯定义题，增加真实项目中的判断场景。",
  dimensions: [
    {
      id: "concept",
      name: "核心概念",
      description: "理解 Server Component 与 Client Component 的职责边界。"
    },
    {
      id: "application",
      name: "实际应用",
      description: "能在页面结构和数据读取方式之间做合理选择。"
    },
    {
      id: "pitfall",
      name: "常见误区",
      description: "识别会造成额外客户端 JavaScript 或缓存误用的做法。"
    }
  ]
};

export const mockQuestions: GeneratedQuestion[] = [
  {
    id: "rsc-concept",
    dimensionId: "concept",
    dimensionName: "核心概念",
    prompt: "关于 React Server Components，哪一项说法更准确？",
    options: [
      { id: "A", label: "Server Component 可以直接读取服务端数据源。" },
      { id: "B", label: "Server Component 必须在浏览器里完成渲染。" },
      { id: "C", label: "Server Component 一定可以使用浏览器事件。" },
      { id: "D", label: "Server Component 和 Client Component 没有边界差异。" }
    ],
    correctOptionId: "A",
    explanation: "Server Component 在服务端渲染，可直接读取服务端数据源，但不能直接处理浏览器交互。"
  },
  {
    id: "cache-usage",
    dimensionId: "application",
    dimensionName: "实际应用",
    prompt: "如果页面需要读取数据库并尽快返回首屏，哪种做法更贴近 App Router 思路？",
    options: [
      { id: "A", label: "优先在 Server Component 中获取数据并渲染。" },
      { id: "B", label: "把所有数据请求都放到客户端 useEffect 里。" },
      { id: "C", label: "先渲染空页面，再强制用户刷新。" },
      { id: "D", label: "完全禁用服务端渲染。" }
    ],
    correctOptionId: "A",
    explanation: "App Router 鼓励把可服务端完成的数据读取放在服务端，减少客户端等待和额外 JavaScript。"
  },
  {
    id: "common-misconception",
    dimensionId: "pitfall",
    dimensionName: "常见误区",
    prompt: "下面哪项更可能造成不必要的客户端 JavaScript？",
    options: [
      { id: "A", label: "只在需要交互的组件上使用客户端组件。" },
      { id: "B", label: "在很高层级随意添加 use client。" },
      { id: "C", label: "把纯展示内容留在 Server Component。" },
      { id: "D", label: "把交互控件拆到局部 Client Component。" }
    ],
    correctOptionId: "B",
    explanation: "过高层级的 use client 会把更多子树带入客户端 bundle，增加不必要的客户端 JavaScript。"
  }
];
