import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Empty, message } from 'antd'
import {
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import { useStore } from '../../store'
import { validateWorkflowForRun } from '../../utils/workflowValidation'
import { getWorkflowInputFields } from '../../utils/workflowVariables'
import './RunPanel.css'

const { TextArea } = Input

const RunPanel: React.FC = () => {
  const {
    currentWorkflow,
    nodes,
    edges,
    executionStates,
    executionStatus,
    streamRunWorkflow,
    saveWorkflow,
    setExecutionStatus,
    setExecutionStates,
    clearExecutionStates,
  } = useStore()

  const inputFields = useMemo(() => getWorkflowInputFields(nodes), [nodes])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [isRunning, setIsRunning] = useState(false)
  const runAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setInputs((current) => Object.fromEntries(
      inputFields.map((input) => [input.field, current[input.field] || '']),
    ))
  }, [inputFields])

  const handleRun = async () => {
    const workflowId = currentWorkflow?.id
    if (!workflowId) return

    const emptyInput = inputFields.find((input) => !inputs[input.field]?.trim())
    if (emptyInput) {
      message.error(`请填写“${emptyInput.label}”`)
      return
    }

    const validationErrors = validateWorkflowForRun(nodes, edges)
    if (validationErrors.length > 0) {
      message.error(validationErrors[0])
      return
    }

    setIsRunning(true)
    const abortController = new AbortController()
    runAbortControllerRef.current = abortController
    try {
      // 调试运行始终使用当前画布，并顺便持久化，避免刷新后回到旧版本。
      await saveWorkflow(workflowId, { nodes, edges })
      if (abortController.signal.aborted) return
      await streamRunWorkflow(workflowId, inputs, abortController.signal)
    } catch (error: any) {
      message.error(error?.message || '工作流执行失败')
    } finally {
      if (runAbortControllerRef.current === abortController) {
        runAbortControllerRef.current = null
      }
      setIsRunning(false)
    }
  }

  const handleStop = () => {
    runAbortControllerRef.current?.abort()
    setExecutionStates(Object.fromEntries(
      Object.entries(executionStates).map(([nodeId, nodeState]) => [
        nodeId,
        nodeState.status === 'running' || nodeState.status === 'retrying'
          ? { ...nodeState, status: 'stopped' as const }
          : nodeState,
      ]),
    ))
    setIsRunning(false)
    setExecutionStatus('stopped')
  }

  const handleClear = () => {
    clearExecutionStates()
    setExecutionStatus(null)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <LoadingOutlined spin style={{ color: 'var(--c-blue)' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: 'var(--c-green)' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: 'var(--c-red)' }} />
      case 'cancelled':
      case 'stopped':
        return <StopOutlined style={{ color: 'var(--c-text-tertiary)' }} />
      case 'skipped':
        return <MinusCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
      default:
        return <ClockCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
    }
  }

  const executedNodes = Object.values(executionStates)
  const hasResults = executedNodes.length > 0

  return (
    <div className="run-panel">
      <div className="run-panel-header">
        <h3>调试运行</h3>
      </div>

      <div className="run-panel-body">
        {/* Input section */}
        <div className="run-section">
          <label className="run-section-label">工作流输入</label>
          {inputFields.length > 0 ? inputFields.map((input) => (
            <div key={input.nodeId} className="run-input-field">
              <div className="run-input-field-label">
                <span>{input.label}</span>
                <code>{input.field}</code>
              </div>
              <TextArea
                value={inputs[input.field] || ''}
                onChange={(event) => setInputs((current) => ({
                  ...current,
                  [input.field]: event.target.value,
                }))}
                placeholder={`请输入${input.label}`}
                rows={3}
                className="run-input-textarea"
                disabled={isRunning}
              />
            </div>
          )) : (
            <div className="run-no-input">当前工作流没有用户输入节点，运行时不需要填写参数。</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="run-actions">
          {isRunning ? (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              block
              size="middle"
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              block
              size="middle"
            >
              运行工作流
            </Button>
          )}
          {hasResults && !isRunning && (
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="middle"
              className="run-clear-btn"
            >
              清除
            </Button>
          )}
        </div>

        {/* Execution status */}
        {executionStatus && (
          <div className={`run-status run-status--${executionStatus}`}>
            {statusIcon(executionStatus)}
            <span>
              {executionStatus === 'running'
                ? '运行中…'
                : executionStatus === 'success'
                ? '执行完成'
                : executionStatus === 'failed'
                ? '执行失败'
                : '已停止'}
            </span>
          </div>
        )}

        {/* Node results */}
        {hasResults ? (
          <div className="run-results">
            <label className="run-section-label">节点执行结果</label>
            {executedNodes.map((exec) => {
              const node = nodes.find((n) => n.id === exec.nodeId)
              return (
                <div key={exec.nodeId} className="run-result-card">
                  <div className="run-result-header">
                    {statusIcon(exec.status)}
                    <span className="run-result-name">
                      {(node?.data as any)?.label || exec.nodeId}
                    </span>
                    <span className="run-result-type">{node?.type}</span>
                  </div>
                  {(exec as any).output && (
                    <pre className="run-result-output">
                      {typeof (exec as any).output === 'string'
                        ? (exec as any).output
                        : JSON.stringify((exec as any).output, null, 2)}
                    </pre>
                  )}
                  {exec.error && (
                    <div className="run-result-error">{exec.error}</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          !isRunning && (
            <div className="run-empty">
              <Empty
                description="点击「运行工作流」开始调试"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default RunPanel
