import React, { useEffect, useRef, useState } from 'react'
import { Form, Input, Select, Slider, InputNumber, Switch, Divider, Card, Button, Space, Tag, Empty, Typography, Dropdown } from 'antd'
import { PlusOutlined, DeleteOutlined, RobotOutlined, BranchesOutlined } from '@ant-design/icons'
import { useStore } from '../../store'
import { getUpstreamVariableOptions, type WorkflowVariableOption } from '../../utils/workflowVariables'
import './ConfigPanel.css'

const { Option, OptGroup } = Select
const { Text } = Typography

const getSkillParameterDefinitions = (skill: any): Array<{ name: string; type: string }> => {
  if (!skill?.inputSchema) return []
  try {
    const schema = typeof skill.inputSchema === 'string'
      ? JSON.parse(skill.inputSchema)
      : skill.inputSchema
    const properties = schema?.properties && typeof schema.properties === 'object'
      ? schema.properties
      : schema
    if (!properties || typeof properties !== 'object') return []

    return Object.entries(properties)
      .filter(([name]) => !['type', 'required', 'properties'].includes(name))
      .map(([name, definition]: [string, any]) => ({
        name,
        type: typeof definition === 'string' ? definition : definition?.type || '任意值',
      }))
  } catch {
    return []
  }
}

const VariablePicker: React.FC<{
  variables: WorkflowVariableOption[]
  onInsert: (value: string) => void
}> = ({ variables, onInsert }) => {
  if (variables.length === 0) {
    return (
      <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
        请先连接并配置上游节点，之后可在这里选择它的输出。
      </Text>
    )
  }

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: variables.map((variable) => ({
          key: variable.value,
          label: (
            <div>
              <div>{variable.nodeLabel} → {variable.field}</div>
              <Text type="secondary" style={{ fontSize: 11 }}>{variable.description} · {variable.value}</Text>
            </div>
          ),
        })),
        onClick: ({ key }) => onInsert(key),
      }}
    >
      <Button size="small" type="link" style={{ paddingInline: 0, marginTop: 4 }}>
        插入上游变量
      </Button>
    </Dropdown>
  )
}

const MODEL_GROUPS = [
  {
    provider: 'qwen',
    label: '🇨🇳 通义千问 (Qwen)',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', tag: '快速', tagColor: 'green' },
      { id: 'qwen-plus', name: 'Qwen Plus', tag: '高质量', tagColor: 'blue' },
      { id: 'qwen-max', name: 'Qwen Max', tag: '最强', tagColor: 'purple' },
      { id: 'qwen-long', name: 'Qwen Long', tag: '长文本', tagColor: 'orange' },
    ],
  },
  {
    provider: 'openai',
    label: '🌐 OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', tag: '推荐', tagColor: 'gold' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: '性价比', tagColor: 'green' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: '强大', tagColor: 'purple' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tag: '经济', tagColor: 'default' },
    ],
  },
  {
    provider: 'claude',
    label: '🤖 Anthropic Claude',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: '推荐', tagColor: 'gold' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tag: '最强', tagColor: 'purple' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', tag: '快速', tagColor: 'green' },
    ],
  },
  {
    provider: 'gemini',
    label: '✨ Google Gemini',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: '100万上下文', tagColor: 'blue' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: '快速', tagColor: 'green' },
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', tag: '稳定', tagColor: 'default' },
    ],
  },
  {
    provider: 'ollama',
    label: '🏠 Ollama (本地)',
    models: [
      { id: 'qwen2.5:7b', name: 'Qwen2.5 7B', tag: '本地', tagColor: 'cyan' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', tag: '本地', tagColor: 'cyan' },
      { id: 'mistral:7b', name: 'Mistral 7B', tag: '本地', tagColor: 'cyan' },
      { id: 'deepseek-coder-v2:16b', name: 'DeepSeek Coder V2 16B', tag: '本地', tagColor: 'cyan' },
    ],
  },
]

const ModelSelect: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
}> = ({ value, onChange, style, size }) => (
  <Select value={value} onChange={onChange} style={style} size={size} placeholder="选择模型" showSearch optionFilterProp="label">
    {MODEL_GROUPS.map((group) => (
      <OptGroup key={group.provider} label={group.label}>
        {group.models.map((model) => (
          <Option key={model.id} value={model.id} label={model.name}>
            <Space>
              <span>{model.name}</span>
              <Tag color={model.tagColor} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{model.tag}</Tag>
            </Space>
          </Option>
        ))}
      </OptGroup>
    ))}
  </Select>
)

const ConfigPanel: React.FC = () => {
  const { selectedNode, nodes, edges, updateNodeData, knowledgeBases, fetchKnowledgeBases, skills, fetchSkills } = useStore()
  const [form] = Form.useForm()
  const [workers, setWorkers] = useState<any[]>([])
  const initializedNodeIdRef = useRef<string | null>(null)
  const agentMode = Form.useWatch('agentMode', form) || 'single'
  const upstreamVariables = selectedNode
    ? getUpstreamVariableOptions(nodes, edges, selectedNode.id)
    : []

  useEffect(() => {
    fetchKnowledgeBases()
    fetchSkills()
  }, [fetchKnowledgeBases, fetchSkills])

  useEffect(() => {
    const nextNodeId = selectedNode?.id ?? null
    if (initializedNodeIdRef.current === nextNodeId) return
    initializedNodeIdRef.current = nextNodeId

    if (selectedNode) {
      form.resetFields()
      form.setFieldsValue(selectedNode.data)
      setWorkers(selectedNode.type === 'agent' ? (selectedNode.data as any).workers || [] : [])
    } else {
      form.resetFields()
      setWorkers([])
    }
  }, [selectedNode, form])

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (!selectedNode) return

    if (selectedNode.type === 'skill' && changedValues.skillId) {
      const selectedSkill = skills.find((skill) => skill.id === changedValues.skillId)
      const parameters = Object.fromEntries(
        getSkillParameterDefinitions(selectedSkill).map(({ name }) => [name, '']),
      )
      updateNodeData(selectedNode.id, { ...allValues, parameters })
      return
    }

    updateNodeData(selectedNode.id, allValues)
  }

  const insertVariable = (fieldPath: string | Array<string | number>, variable: string) => {
    if (!selectedNode) return
    const current = form.getFieldValue(fieldPath)
    const prefix = typeof current === 'string' && current.length > 0 && !/\s$/.test(current) ? ' ' : ''
    form.setFieldValue(fieldPath, `${typeof current === 'string' ? current : ''}${prefix}${variable}`)
    updateNodeData(selectedNode.id, form.getFieldsValue(true))
  }

  const renderTemplateTextArea = (
    fieldName: string,
    label: string,
    placeholder: string,
    rows = 4,
    required = true,
  ) => (
    <Form.Item label={label} required={required}>
      <Form.Item
        name={fieldName}
        noStyle
        rules={required ? [{ required: true, message: `请填写${label}` }] : undefined}
      >
        <Input.TextArea rows={rows} placeholder={placeholder} />
      </Form.Item>
      <VariablePicker variables={upstreamVariables} onInsert={(value) => insertVariable(fieldName, value)} />
    </Form.Item>
  )

  const updateSkillParameters = (parameters: Record<string, unknown>) => {
    if (!selectedNode) return
    updateNodeData(selectedNode.id, { parameters })
  }

  const renderSkillParameters = () => {
    if (!selectedNode || selectedNode.type !== 'skill') return null
    const rawParameters = (selectedNode.data as any).parameters
    const parameters: Record<string, any> = rawParameters && typeof rawParameters === 'object' && !Array.isArray(rawParameters)
      ? rawParameters
      : {}
    const selectedSkill = skills.find((skill) => skill.id === (selectedNode.data as any).skillId)
    const definitions = new Map(
      getSkillParameterDefinitions(selectedSkill).map((definition) => [definition.name, definition.type]),
    )
    const entries = Object.entries(parameters)

    return (
      <>
        <div style={{ marginBottom: 8 }}>
          <Text strong>工具参数</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            选择工具后会自动生成参数。参数值可以直接填写，也可以插入上游变量。
          </Text>
        </div>
        {entries.map(([key, value], index) => (
          <Card key={`${key}-${index}`} size="small" style={{ marginBottom: 10 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={key}
                  aria-label="参数名"
                  placeholder="参数名"
                  onChange={(event) => {
                    const next = { ...parameters }
                    delete next[key]
                    next[event.target.value] = value
                    updateSkillParameters(next)
                  }}
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    const next = { ...parameters }
                    delete next[key]
                    updateSkillParameters(next)
                  }}
                />
              </Space.Compact>
              <Input.TextArea
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                aria-label={`${key || '未命名'}参数值`}
                placeholder={definitions.get(key) ? `类型：${definitions.get(key)}` : '参数值'}
                autoSize={{ minRows: 2, maxRows: 5 }}
                onChange={(event) => updateSkillParameters({ ...parameters, [key]: event.target.value })}
              />
              <VariablePicker
                variables={upstreamVariables}
                onInsert={(variable) => updateSkillParameters({
                  ...parameters,
                  [key]: `${typeof value === 'string' && value ? `${value} ` : ''}${variable}`,
                })}
              />
            </Space>
          </Card>
        ))}
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={() => {
            let index = 1
            while (Object.prototype.hasOwnProperty.call(parameters, `param${index}`)) index += 1
            updateSkillParameters({ ...parameters, [`param${index}`]: '' })
          }}
        >
          添加参数
        </Button>
      </>
    )
  }

  const addWorker = () => {
    const newWorker = {
      id: `worker_${Date.now()}`,
      name: `Worker ${workers.length + 1}`,
      description: '',
      systemPrompt: '',
      model: 'qwen-turbo',
      temperature: 0.7,
      maxTokens: 2048,
      toolIds: [],
      knowledgeBaseIds: [],
      ragEnabled: false,
    }
    const updatedWorkers = [...workers, newWorker]
    setWorkers(updatedWorkers)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { ...selectedNode.data, workers: updatedWorkers })
    }
  }

  const removeWorker = (index: number) => {
    const updatedWorkers = workers.filter((_, i) => i !== index)
    setWorkers(updatedWorkers)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { ...selectedNode.data, workers: updatedWorkers })
    }
  }

  const updateWorker = (index: number, field: string, value: any) => {
    const updatedWorkers = workers.map((w, i) =>
      i === index ? { ...w, [field]: value } : w
    )
    setWorkers(updatedWorkers)
    if (selectedNode) {
      updateNodeData(selectedNode.id, { ...selectedNode.data, workers: updatedWorkers })
    }
  }

  const renderAgentConfig = (commonFields: React.ReactNode) => {
    return (
      <>
        {commonFields}
        <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
          <RobotOutlined /> Agent 基础配置
        </Divider>
        <Form.Item name="agentMode" label="Agent 模式" initialValue="single">
          <Select>
            <Option value="single">
              <Space><Tag color="blue">单智能体</Tag><Text type="secondary" style={{ fontSize: 12 }}>一个 Agent 完成所有任务</Text></Space>
            </Option>
            <Option value="supervisor">
              <Space><Tag color="purple">多智能体</Tag><Text type="secondary" style={{ fontSize: 12 }}>Supervisor 协调多个 Worker</Text></Space>
            </Option>
          </Select>
        </Form.Item>
        <Form.Item name="strategy" label="执行策略" initialValue="react">
          <Select>
            <Option value="react">ReAct (推理+行动)</Option>
            <Option value="plan-and-execute">Plan & Execute (规划+执行)</Option>
            <Option value="reflection">Reflection (反思优化)</Option>
          </Select>
        </Form.Item>
        <Form.Item name="model" label="模型" initialValue="qwen-turbo">
          <ModelSelect style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="systemPrompt" label="系统提示词">
          <Input.TextArea rows={4} placeholder="定义 Agent 的角色、能力和行为规范" />
        </Form.Item>
        {renderTemplateTextArea('userPrompt', '用户提示词', '输入任务说明，点击下方按钮插入上游变量', 4)}
        <Form.Item name="temperature" label="温度" initialValue={0.7}>
          <Slider min={0} max={1} step={0.1} />
        </Form.Item>
        <Form.Item name="maxTokens" label="最大 Token 数" initialValue={2048}>
          <InputNumber min={256} max={8192} step={256} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="maxIterations" label="最大迭代轮数" initialValue={10}>
          <InputNumber min={1} max={50} step={1} style={{ width: '100%' }} />
        </Form.Item>
        <Divider orientation="left" style={{ margin: '12px 0 12px' }}>🔧 工具与知识库</Divider>
        <Form.Item name="ragEnabled" label="启用 RAG" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
        <Form.Item name="knowledgeBaseIds" label="关联知识库">
          <Select mode="multiple" placeholder="选择知识库（多选）">
            {Array.isArray(knowledgeBases) && knowledgeBases.map(kb => (
              <Option key={kb.id} value={kb.id}>{kb.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="toolIds" label="可用工具">
          <Select mode="multiple" placeholder="选择工具（多选，留空则使用全部内置工具）">
            {Array.isArray(skills) && skills.map(s => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Divider orientation="left" style={{ margin: '12px 0 12px' }}>🧠 记忆</Divider>
        <Form.Item name="memoryEnabled" label="启用记忆" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
        <Form.Item name="memoryWindowSize" label="记忆窗口大小" initialValue={10}>
          <InputNumber min={1} max={100} step={1} style={{ width: '100%' }} />
        </Form.Item>

        {agentMode === 'supervisor' && (
          <>
            <Divider orientation="left" style={{ margin: '12px 0 12px' }}>👑 Supervisor 配置</Divider>
            <Form.Item name="supervisorPrompt" label="Supervisor 提示词">
              <Input.TextArea rows={4} placeholder="定义 Supervisor 的协调策略，留空使用默认" />
            </Form.Item>
            <Form.Item name="supervisorModel" label="Supervisor 模型" initialValue="qwen-plus">
              <ModelSelect style={{ width: '100%' }} />
            </Form.Item>
            <Divider orientation="left" style={{ margin: '12px 0 12px' }}>🤖 Workers ({workers.length})</Divider>
            {workers.map((worker, index) => (
              <Card
                key={worker.id}
                size="small"
                title={
                  <Space>
                    <Tag color="purple">#{index + 1}</Tag>
                    <Input value={worker.name} onChange={(e) => updateWorker(index, 'name', e.target.value)} placeholder="Worker 名称" aria-label={`Worker ${index + 1} 名称`} style={{ width: 140 }} size="small" />
                  </Space>
                }
                extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeWorker(index)} />}
                style={{ marginBottom: 8 }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Input value={worker.description} onChange={(e) => updateWorker(index, 'description', e.target.value)} placeholder="Worker 职责描述" size="small" />
                  <Input.TextArea value={worker.systemPrompt} onChange={(e) => updateWorker(index, 'systemPrompt', e.target.value)} placeholder="Worker 系统提示词" rows={2} style={{ fontSize: 12 }} />
                  <Space>
                    <ModelSelect value={worker.model} onChange={(v) => updateWorker(index, 'model', v)} size="small" style={{ width: 180 }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>温度:</Text>
                    <InputNumber value={worker.temperature} onChange={(v) => updateWorker(index, 'temperature', v)} min={0} max={1} step={0.1} size="small" style={{ width: 60 }} />
                  </Space>
                </Space>
              </Card>
            ))}
            <Button type="dashed" onClick={addWorker} icon={<PlusOutlined />} block style={{ marginTop: 4 }}>添加 Worker</Button>
          </>
        )}
      </>
    )
  }

  const renderConfigForm = () => {
    if (!selectedNode) {
      return <Empty description="选择节点以编辑配置" className="config-panel-empty" />
    }

    const commonFields = (
      <>
        <Form.Item name="label" label="节点名称">
          <Input placeholder="输入节点名称" />
        </Form.Item>
        <div style={{ margin: '-12px 0 12px', fontSize: 12 }}>
          <Text type="secondary">节点标识：</Text>
          <Text code copyable>{selectedNode.id}</Text>
        </div>
      </>
    )

    switch (selectedNode.type) {
      case 'start':
        return (
          <>
            {commonFields}
            <Text type="secondary">开始节点可以提供后续节点都能引用的固定变量。</Text>
            <Form.List name="variables">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline" style={{ display: 'flex', marginTop: 10 }}>
                      <Form.Item
                        name={[field.name, 'key']}
                        rules={[
                          { required: true, message: '请输入变量名' },
                          { pattern: /^[^.\s]+$/, message: '变量名不能包含点或空格' },
                        ]}
                      >
                        <Input placeholder="变量名，例如 language" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'value']} rules={[{ required: true, message: '请输入变量值' }]}>
                        <Input placeholder="变量值" />
                      </Form.Item>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ key: '', value: '' })}>
                    添加固定变量
                  </Button>
                </>
              )}
            </Form.List>
          </>
        )
      case 'userInput':
        return (
          <>
            {commonFields}
            <Form.Item
              name="inputField"
              label="输入字段"
              extra="调试面板和分享页会用它自动生成输入框；下游节点可从变量选择器引用。"
              rules={[
                { required: true, message: '请输入输入字段' },
                { pattern: /^[^.\s]+$/, message: '输入字段不能包含点或空格' },
              ]}
            >
              <Input placeholder="例如：question" />
            </Form.Item>
          </>
        )
      case 'llm':
        return (
          <>
            {commonFields}
            <Form.Item name="model" label="模型" initialValue="qwen-turbo">
              <ModelSelect style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="systemPrompt" label="系统提示词"><Input.TextArea rows={4} placeholder="定义模型的角色和行为" /></Form.Item>
            {renderTemplateTextArea('userPrompt', '用户提示词', '输入提示词，点击下方按钮插入用户输入或其他上游输出', 6)}
            <Form.Item name="temperature" label="温度" initialValue={0.7}><Slider min={0} max={1} step={0.1} /></Form.Item>
            <Form.Item name="maxTokens" label="最大 Token 数" initialValue={1024}><InputNumber min={1} max={8192} step={256} style={{ width: '100%' }} /></Form.Item>
          </>
        )
      case 'agent':
        return renderAgentConfig(commonFields)
      case 'rag':
        return (
          <>
            {commonFields}
            <Form.Item name="knowledgeBaseId" label="知识库" rules={[{ required: true }]}>
              <Select placeholder="选择一个知识库">{Array.isArray(knowledgeBases) && knowledgeBases.map(kb => (<Option key={kb.id} value={kb.id}>{kb.name}</Option>))}</Select>
            </Form.Item>
            {renderTemplateTextArea('query', '检索查询', '输入检索内容，或从下方选择上游变量', 3)}
            <Form.Item name="topK" label="Top K" initialValue={5}><Slider min={1} max={10} step={1} /></Form.Item>
            <Form.Item
              name="similarityThreshold"
              label="相似度阈值"
              initialValue={0.7}
              extra="只保留相似度达到该值的检索结果。"
            >
              <Slider min={0} max={1} step={0.05} marks={{ 0: '0', 0.5: '0.5', 1: '1' }} />
            </Form.Item>
          </>
        )
      case 'skill':
        return (
          <>
            {commonFields}
            <Form.Item name="skillId" label="选择工具" rules={[{ required: true }]}>
              <Select placeholder="选择一个内置或自定义工具">{Array.isArray(skills) && skills.map(s => (<Option key={s.id} value={s.id}>{s.name}</Option>))}</Select>
            </Form.Item>
            {renderSkillParameters()}
          </>
        )
      case 'condition':
        return (
          <>
            {commonFields}
            <div style={{ marginBottom: 12, color: 'var(--c-text-secondary)', fontSize: 12 }}>
              <BranchesOutlined /> 所有条件同时成立时走“是”分支，否则走“否”分支。请从上游输出中选择判断变量。
            </div>
            <Form.List name="conditions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`条件 ${index + 1}`}
                      extra={
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                        />
                      }
                      style={{ marginBottom: 10 }}
                    >
                      <Form.Item
                        name={[field.name, 'variable']}
                        label="变量"
                        rules={[{ required: true, message: '请输入要判断的变量' }]}
                      >
                        <Select
                          showSearch
                          placeholder={upstreamVariables.length > 0 ? '选择上游节点的输出' : '请先连接上游节点'}
                          options={upstreamVariables.map((variable) => ({
                            value: variable.value,
                            label: `${variable.nodeLabel} → ${variable.field}`,
                            title: variable.value,
                          }))}
                          notFoundContent="没有可用的上游变量"
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'operator']}
                        label="运算符"
                        rules={[{ required: true, message: '请选择运算符' }]}
                      >
                        <Select options={[
                          { label: '包含', value: 'contains' },
                          { label: '等于', value: '===' },
                          { label: '不等于', value: '!==' },
                          { label: '大于', value: '>' },
                          { label: '大于等于', value: '>=' },
                          { label: '小于', value: '<' },
                          { label: '小于等于', value: '<=' },
                        ]} />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'value']}
                        label="比较值"
                        rules={[{ required: true, message: '请输入比较值' }]}
                      >
                        <Input placeholder="例如：不确定" />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ variable: '', operator: 'contains', value: '' })}
                  >
                    添加判断条件
                  </Button>
                </>
              )}
            </Form.List>
          </>
        )
      case 'output':
        return <>{commonFields}{renderTemplateTextArea('outputValue', '输出内容', '编写最终回复，点击下方按钮插入上游结果', 4)}</>
      default:
        return <Empty description={`暂不支持 ${selectedNode.type} 节点的配置`} />
    }
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h3>{selectedNode ? '节点配置' : '配置'}</h3>
      </div>
      <div className="config-panel-body">
        <Form className="config-panel-form" form={form} layout="vertical" onValuesChange={handleValuesChange}>
          {renderConfigForm()}
        </Form>
      </div>
    </div>
  )
}

export default ConfigPanel
