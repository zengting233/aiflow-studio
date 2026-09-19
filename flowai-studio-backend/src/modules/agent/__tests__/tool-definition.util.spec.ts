import {
  buildToolDefinitions,
  normalizeToolName,
} from '../utils/tool-definition.util';

describe('tool definition utilities', () => {
  it('uses a stable id fallback for a Chinese-only skill name', () => {
    expect(normalizeToolName('中文工具', 'skill_4')).toBe('tool_skill_4');
    expect(normalizeToolName('中文工具', '4')).toBe('tool_4');

    const [definition] = buildToolDefinitions([
      {
        id: 'skill_4',
        name: '中文工具',
        description: '测试工具',
      },
    ]);
    expect(definition.name).toBe(normalizeToolName('中文工具', 'skill_4'));
  });
});
