import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  PlayCircleOutlined,
  UserOutlined,
  MessageOutlined,
  BookOutlined,
  ToolOutlined,
  BranchesOutlined,
  ExportOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import './NodePanel.css'

interface NodeType {
  type: string
  label: string
  icon: React.ReactNode
  color: string
  description: string
}

const nodeTypes: NodeType[] = [
  { type: 'start', label: '开始', icon: <PlayCircleOutlined />, color: '#7c3aed', description: '工作流入口与固定变量' },
  { type: 'userInput', label: '用户输入', icon: <UserOutlined />, color: '#059669', description: '生成调试和分享输入框' },
  { type: 'llm', label: '大模型', icon: <MessageOutlined />, color: '#7c3aed', description: '调用模型生成文本' },
  { type: 'agent', label: '智能体', icon: <RobotOutlined />, color: '#8b5cf6', description: '自主调用工具完成任务' },
  { type: 'rag', label: 'RAG检索', icon: <BookOutlined />, color: '#d97706', description: '从知识库检索文档' },
  { type: 'skill', label: '工具', icon: <ToolOutlined />, color: '#0891b2', description: '执行内置或自定义工具' },
  { type: 'condition', label: '条件分支', icon: <BranchesOutlined />, color: '#dc2626', description: '按“是 / 否”选择路径' },
  { type: 'output', label: '输出', icon: <ExportOutlined />, color: '#059669', description: '生成最终运行结果' },
]

const NodePanel: React.FC = () => {
  const { setNodes } = useReactFlow()

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div className="node-panel">
      <div className="node-panel-header">
        <h3>节点库</h3>
      </div>
      <div className="node-panel-content">
        <div className="node-panel-tip">拖入节点并连线，然后点击节点完成配置。带文本的配置项可直接选择上游变量。</div>
        {nodeTypes.map((nodeType) => (
          <div
            key={nodeType.type}
            className="node-item"
            draggable
            onDragStart={(e) => onDragStart(e, nodeType.type)}
          >
            <div className="node-item-icon" style={{ color: nodeType.color }}>
              {nodeType.icon}
            </div>
            <div className="node-item-label">
              <div>{nodeType.label}</div>
              <small>{nodeType.description}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NodePanel
