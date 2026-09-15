import type { WorkflowEdge, WorkflowNode } from '../types'

export interface WorkflowVariableOption {
  value: string
  nodeId: string
  nodeLabel: string
  field: string
  description: string
}

export interface WorkflowInputField {
  nodeId: string
  field: string
  label: string
}

const FIXED_OUTPUT_FIELDS: Partial<Record<WorkflowNode['type'], Array<{ field: string; description: string }>>> = {
  llm: [{ field: 'result', description: '大模型回答文本' }],
  rag: [{ field: 'documents', description: '检索到的文档列表' }],
  skill: [{ field: 'result', description: '工具执行结果' }],
  condition: [{ field: 'result', description: '条件判断结果' }],
  output: [{ field: 'finalOutput', description: '最终输出文本' }],
  agent: [{ field: 'result', description: '智能体回答文本' }],
}

export function getNodeOutputFields(node: WorkflowNode): Array<{ field: string; description: string }> {
  if (node.type === 'start') {
    const variables = Array.isArray(node.data.variables) ? node.data.variables : []
    return variables
      .filter((variable) => typeof variable?.key === 'string' && variable.key.trim())
      .map((variable) => ({ field: variable.key.trim(), description: '开始节点变量' }))
  }

  if (node.type === 'userInput') {
    const field = typeof node.data.inputField === 'string' ? node.data.inputField.trim() : ''
    return field ? [{ field, description: '用户填写的内容' }] : []
  }

  return FIXED_OUTPUT_FIELDS[node.type] || []
}

export function getUpstreamVariableOptions(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  targetNodeId: string,
): WorkflowVariableOption[] {
  const upstreamIds = new Set<string>()
  const queue = edges.filter((edge) => edge.target === targetNodeId).map((edge) => edge.source)

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (upstreamIds.has(nodeId)) continue
    upstreamIds.add(nodeId)
    for (const edge of edges) {
      if (edge.target === nodeId) queue.push(edge.source)
    }
  }

  return nodes
    .filter((node) => upstreamIds.has(node.id))
    .flatMap((node) => getNodeOutputFields(node).map(({ field, description }) => ({
      value: `{{${node.id}.${field}}}`,
      nodeId: node.id,
      nodeLabel: String(node.data.label || node.id),
      field,
      description,
    })))
}

export function getWorkflowInputFields(nodes: WorkflowNode[]): WorkflowInputField[] {
  return nodes
    .filter((node) => node.type === 'userInput')
    .map((node) => ({
      nodeId: node.id,
      field: typeof node.data.inputField === 'string' ? node.data.inputField.trim() : '',
      label: String(node.data.label || '用户输入'),
    }))
    .filter((input) => input.field)
}

export function createReadableNodeId(type: WorkflowNode['type'], nodes: WorkflowNode[]): string {
  const usedIds = new Set(nodes.map((node) => node.id))
  let index = 1
  while (usedIds.has(`${type}_${index}`)) index += 1
  return `${type}_${index}`
}
