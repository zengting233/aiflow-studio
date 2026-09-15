import { WorkflowEdge, WorkflowNode } from '../types'
import { getUpstreamVariableOptions, getWorkflowInputFields } from './workflowVariables'

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

const extractReferences = (value: unknown): string[] => {
  if (typeof value !== 'string') return []
  return Array.from(value.matchAll(/\{\{(.+?)\}\}/g), (match) => `{{${match[1].trim()}}}`)
}

export function validateWorkflowForRun(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const errors: string[] = []
  const nodeIds = new Set(nodes.map((node) => node.id))

  if (!nodes.some((node) => node.type === 'start')) errors.push('工作流至少需要一个开始节点')
  if (!nodes.some((node) => node.type === 'output')) errors.push('工作流至少需要一个输出节点')

  const inputFields = getWorkflowInputFields(nodes)
  const duplicatedInputFields = inputFields.filter((input, index) =>
    inputFields.findIndex((candidate) => candidate.field === input.field) !== index)
  if (duplicatedInputFields.length > 0) {
    errors.push(`用户输入字段“${duplicatedInputFields[0].field}”重复，请使用不同的字段名`)
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push('画布中存在连接到已删除节点的边')
      break
    }
  }

  const remainingIncoming = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      remainingIncoming.set(edge.target, (remainingIncoming.get(edge.target) || 0) + 1)
    }
  }
  const traversalQueue = nodes
    .filter((node) => remainingIncoming.get(node.id) === 0)
    .map((node) => node.id)
  let traversedCount = 0
  while (traversalQueue.length > 0) {
    const nodeId = traversalQueue.shift()!
    traversedCount += 1
    for (const edge of edges.filter((candidate) => candidate.source === nodeId)) {
      const nextDegree = (remainingIncoming.get(edge.target) || 1) - 1
      remainingIncoming.set(edge.target, nextDegree)
      if (nextDegree === 0) traversalQueue.push(edge.target)
    }
  }
  if (traversedCount < nodes.length) errors.push('工作流中存在循环连线，请调整为从开始到输出的单向流程')

  for (const node of nodes) {
    const data = node.data as Record<string, any>
    const name = data.label || node.id
    const incoming = edges.filter((edge) => edge.target === node.id)
    const outgoing = edges.filter((edge) => edge.source === node.id)

    if (node.type !== 'start' && incoming.length === 0) errors.push(`“${name}”尚未连接上游节点`)
    if (node.type !== 'output' && outgoing.length === 0) errors.push(`“${name}”尚未连接后续节点`)

    switch (node.type) {
      case 'userInput':
        if (isBlank(data.inputField)) errors.push(`“${name}”需要配置输入字段`)
        break
      case 'llm':
        if (isBlank(data.userPrompt)) errors.push(`“${name}”需要配置用户提示词`)
        break
      case 'rag':
        if (isBlank(data.knowledgeBaseId)) errors.push(`“${name}”需要选择知识库`)
        if (isBlank(data.query)) errors.push(`“${name}”需要配置检索查询`)
        break
      case 'skill':
        if (isBlank(data.skillId)) errors.push(`“${name}”需要选择工具`)
        break
      case 'condition': {
        const conditions = Array.isArray(data.conditions) ? data.conditions : []
        if (conditions.length === 0) {
          errors.push(`“${name}”至少需要一个判断条件`)
        } else if (conditions.some((condition: any) =>
          isBlank(condition?.variable) || isBlank(condition?.operator) || isBlank(condition?.value))) {
          errors.push(`“${name}”存在未填写完整的判断条件`)
        }

        if (!outgoing.some((edge) => edge.sourceHandle === 'true')) {
          errors.push(`“${name}”需要连接“是”分支`)
        }
        if (!outgoing.some((edge) => edge.sourceHandle === 'false')) {
          errors.push(`“${name}”需要连接“否”分支`)
        }
        break
      }
      case 'output':
        if (isBlank(data.outputValue)) errors.push(`“${name}”需要配置输出内容`)
        break
      case 'agent':
        if (isBlank(data.userPrompt)) errors.push(`“${name}”需要配置用户提示词`)
        if (data.ragEnabled && (!Array.isArray(data.knowledgeBaseIds) || data.knowledgeBaseIds.length === 0)) {
          errors.push(`“${name}”启用 RAG 后需要选择知识库`)
        }
        if (data.agentMode === 'supervisor' && (!Array.isArray(data.workers) || data.workers.length === 0)) {
          errors.push(`“${name}”的多智能体模式至少需要一个 Worker`)
        }
        break
    }

    const templateValues: unknown[] = []
    if (node.type === 'llm' || node.type === 'agent') templateValues.push(data.userPrompt)
    if (node.type === 'rag') templateValues.push(data.query)
    if (node.type === 'skill' && data.parameters && typeof data.parameters === 'object') {
      templateValues.push(...Object.values(data.parameters))
      if (Object.keys(data.parameters).some((key) => isBlank(key))) {
        errors.push(`“${name}”存在未填写名称的工具参数`)
      }
    }
    if (node.type === 'output') templateValues.push(data.outputValue)
    if (node.type === 'condition' && Array.isArray(data.conditions)) {
      templateValues.push(...data.conditions.map((condition: any) => condition?.variable))
    }

    const validReferences = new Set(
      getUpstreamVariableOptions(nodes, edges, node.id).map((variable) => variable.value),
    )
    for (const input of inputFields) validReferences.add(`{{${input.field}}}`)

    for (const reference of templateValues.flatMap(extractReferences)) {
      if (!validReferences.has(reference)) {
        errors.push(`“${name}”引用了不可用变量 ${reference}，请从上游变量选择器重新选择`)
      }
    }
  }

  return errors
}
