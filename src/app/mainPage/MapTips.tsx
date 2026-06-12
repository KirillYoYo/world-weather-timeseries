// components/MapTips.tsx
import React from 'react';

export const MapTips: React.FC = () => {
    return (
        <div style={{
            marginTop: '10px',
            fontSize: '12px',
            color: '#666',
            textAlign: 'center'
        }}>
            💡 Подсказка: Колесико мыши - зум | Зажмите левую кнопку мыши и двигайте - панорамирование
        </div>
    );
};