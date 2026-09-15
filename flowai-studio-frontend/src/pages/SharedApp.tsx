import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Input, Result, Spin, Typography, message } from 'antd'
import { PlayCircleOutlined, RadarChartOutlined } from '@ant-design/icons'
import * as shareApi from '../utils/teamApi'
import type { SharedAppData } from '../types'
import './SharedApp.css'

const { Title, Text, Paragraph } = Typography

const formatOutput = (output: unknown) => {
  if (typeof output === 'string') return output
  return JSON.stringify(output, null, 2)
}

const SharedApp: React.FC = () => {
  const { shareLink } = useParams<{ shareLink: string }>()
  const navigate = useNavigate()
  const [appData, setAppData] = useState<SharedAppData | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [output, setOutput] = useState<unknown>()

  useEffect(() => {
    if (!shareLink) return

    const loadSharedApp = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await shareApi.getSharedApp(shareLink)
        setAppData(response.data)
        setInputs(Object.fromEntries(response.data.inputs.map((input) => [input.field, ''])))
      } catch (err: any) {
        if (err?.response?.status === 404) setError('分享链接不存在或已被撤销')
        else if (err?.response?.status === 403) setError('此应用未开启公开访问')
        else setError('加载失败，请稍后重试')
      } finally {
        setIsLoading(false)
      }
    }

    void loadSharedApp()
  }, [shareLink])

  const handleRun = async () => {
    if (!shareLink || !appData) return

    const missingInput = appData.inputs.find((input) => !inputs[input.field]?.trim())
    if (missingInput) {
      message.warning(`请填写“${missingInput.label}”`)
      return
    }

    setIsRunning(true)
    setRunError(null)
    setOutput(undefined)
    try {
      const response = await shareApi.runSharedApp(shareLink, inputs)
      setOutput(response.data.output)
    } catch (err: any) {
      setRunError(err?.response?.data?.message || err?.message || '运行失败，请稍后重试')
    } finally {
      setIsRunning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="shared-app-loading">
        <Spin size="large" />
        <Text type="secondary" style={{ marginTop: 16 }}>加载中…</Text>
      </div>
    )
  }

  if (error || !appData) {
    return (
      <div className="shared-app-error">
        <Result
          status="404"
          title="无法访问"
          subTitle={error || '分享的应用不存在'}
          extra={<Button type="primary" onClick={() => navigate('/')}>返回首页</Button>}
        />
      </div>
    )
  }

  return (
    <div className="shared-app-page">
      <div className="shared-app-header">
        <div className="shared-app-logo">
          <RadarChartOutlined />
          <span className="shared-app-logo-text">FlowAI Studio</span>
        </div>
      </div>
      <div className="shared-app-content">
        <Card className="shared-app-card">
          <div className="shared-app-icon">
            {appData.icon ? (
              <img src={appData.icon} alt="" style={{ width: 48, height: 48 }} />
            ) : (
              <div className="shared-app-icon-default">
                <RadarChartOutlined style={{ fontSize: 32, color: '#fff' }} />
              </div>
            )}
          </div>
          <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>{appData.name}</Title>
          <Paragraph type="secondary" style={{ textAlign: 'center' }}>
            {appData.description || '由 FlowAI Studio 创建的 AI 应用'}
          </Paragraph>

          <div className="shared-app-chat-container">
            {!appData.hasWorkflow ? (
              <Alert type="warning" showIcon message="应用尚未配置可运行的工作流" />
            ) : (
              <>
                <div className="shared-app-form">
                  {appData.inputs.map((input) => (
                    <label className="shared-app-field" key={input.nodeId}>
                      <span>{input.label}</span>
                      <Text code>{input.field}</Text>
                      <Input.TextArea
                        value={inputs[input.field] || ''}
                        onChange={(event) => setInputs((current) => ({
                          ...current,
                          [input.field]: event.target.value,
                        }))}
                        placeholder={`请输入${input.label}`}
                        autoSize={{ minRows: 2, maxRows: 6 }}
                      />
                    </label>
                  ))}
                  {appData.inputs.length === 0 && (
                    <Text type="secondary">此工作流不需要用户输入，可直接运行。</Text>
                  )}
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={isRunning}
                    disabled={!appData.hasWorkflow}
                    onClick={handleRun}
                    block
                  >
                    {isRunning ? '运行中' : '运行应用'}
                  </Button>
                </div>

                {runError && <Alert type="error" showIcon message="运行失败" description={runError} />}
                {output !== undefined && (
                  <div className="shared-app-output">
                    <Text strong>运行结果</Text>
                    <pre>{formatOutput(output)}</pre>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="shared-app-footer">
            <Text type="secondary" style={{ fontSize: 12 }}>Powered by FlowAI Studio</Text>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default SharedApp
