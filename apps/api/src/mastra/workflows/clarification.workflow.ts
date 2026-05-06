export async function runClarificationWorkflow(input: { rawTopic: string }) {
  return {
    done: false,
    question: `你想围绕「${input.rawTopic}」测试哪些范围？`,
    options: [
      { id: 'all', label: '全部范围' },
      { id: 'basics', label: '先测基础' },
    ],
  };
}
