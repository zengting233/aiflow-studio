import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

const ConditionNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '条件分支'} icon={<ApartmentOutlined />} color="#dc2626">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <span style={{ color: '#16a34a' }}>是：条件成立</span>
        <span style={{ color: '#dc2626' }}>否：条件不成立</span>
      </div>
      <Handle type="source" position={Position.Right} id="true" style={{ top: '48%', background: '#16a34a' }} />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '72%', background: '#dc2626' }} />
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(ConditionNode);
