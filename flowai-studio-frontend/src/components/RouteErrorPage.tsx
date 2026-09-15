import { Button, Result, Space } from 'antd'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

const RouteErrorPage: React.FC = () => {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText || error.data?.message
    : error instanceof Error
      ? error.message
      : '页面发生未知错误'

  return (
    <Result
      status="error"
      title="页面加载失败"
      subTitle={message}
      extra={
        <Space>
          <Button type="primary" onClick={() => window.location.reload()}>重新加载当前页面</Button>
          <Button onClick={() => window.location.assign('/apps')}>返回工作台</Button>
        </Space>
      }
    />
  )
}

export default RouteErrorPage
