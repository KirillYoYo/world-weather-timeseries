// components/MapControls.tsx
import React from 'react';

interface MapControlsProps {
    scale: number;
    onReset: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({ scale, onReset }) => {
    return (
        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
    <button
        onClick={onReset}
    style={{
        padding: '8px 16px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px'
    }}
>
    Сбросить вид
    </button>
    <span style={{ fontSize: '14px', color: '#666' }}>
🔍 Зум: {Math.round(scale * 100)}%
    </span>
    </div>
);
};