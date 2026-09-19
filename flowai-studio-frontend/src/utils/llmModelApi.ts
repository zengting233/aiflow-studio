import request from './axios'

export interface LLMModelOption {
  id: string
  displayName: string
  provider: string
  configured: boolean
  isDefault?: boolean
  order?: number
  capabilities: {
    functionCalling: boolean
    vision: boolean
    streaming: boolean
    jsonMode: boolean
    maxContextTokens: number
    maxOutputTokens: number
  }
}

export interface LLMModelGroup {
  provider: string
  description: string
  configured: boolean
  models: LLMModelOption[]
}

interface LLMModelGroupsResponse {
  data?: Record<string, LLMModelGroup>
  [provider: string]: unknown
}

export const fetchLLMModelGroups = async (): Promise<LLMModelGroup[]> => {
  const response = await request.get('/llm/models') as LLMModelGroupsResponse
  const groups = response?.data ?? response
  return Object.values(groups) as LLMModelGroup[]
}
