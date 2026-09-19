import { ToolDefinition } from '../interfaces/agent.interface';

export interface ToolDefinitionSource {
  id: string;
  name: string;
  description: string;
  inputSchema?: any;
}

const sanitizeToolName = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export const normalizeToolName = (name: string, fallbackId: string): string => {
  const normalizedName = sanitizeToolName(name);
  if (normalizedName) return normalizedName;

  const normalizedId = sanitizeToolName(fallbackId);
  return normalizedId ? `tool_${normalizedId}` : 'tool';
};

export const buildToolDefinitions = (
  tools: ToolDefinitionSource[],
): ToolDefinition[] =>
  tools.map((tool) => ({
    name: normalizeToolName(tool.name, tool.id),
    description: tool.description,
    parameters: tool.inputSchema
      ? typeof tool.inputSchema === 'string'
        ? JSON.parse(tool.inputSchema)
        : tool.inputSchema
      : {
          type: 'object' as const,
          properties: {
            input: { type: 'string', description: 'Input for the tool' },
          },
        },
  }));
