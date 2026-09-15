import { ConditionNodeExecutor } from './condition-node.executor';

describe('ConditionNodeExecutor', () => {
  const executor = new ConditionNodeExecutor();

  it('routes the demo condition to true when the model answer contains 不确定', async () => {
    const result = await executor.execute(
      {
        data: {
          conditions: [
            { variable: '{{llm_1.result}}', operator: 'contains', value: '不确定' },
          ],
        },
      },
      { llm_1: { result: '这个问题我暂时不确定' } },
    );

    expect(result).toEqual({ result: true });
  });

  it('routes to false when any configured condition is not satisfied', async () => {
    const result = await executor.execute(
      {
        data: {
          conditions: [
            { variable: '{{score.value}}', operator: '>=', value: 60 },
            { variable: '{{answer.text}}', operator: 'contains', value: '通过' },
          ],
        },
      },
      { score: { value: 80 }, answer: { text: '需要复核' } },
    );

    expect(result).toEqual({ result: false });
  });
});
