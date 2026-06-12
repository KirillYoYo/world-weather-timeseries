// hooks/useMapInteraction.ts
import { useState, useRef, useCallback } from 'react';

interface Position {
    x: number;
    y: number;
}

export const useMapInteraction = () => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<Position>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Зум под курсором мыши
    const zoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
        const newScale = Math.min(Math.max(scale + delta, 0.5), 5);

        if (containerRef.current && centerX !== undefined && centerY !== undefined) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = centerX - rect.left;
            const mouseY = centerY - rect.top;

            // Позиция курсора на карте до зума
            const worldX = (mouseX - position.x) / scale;
            const worldY = (mouseY - position.y) / scale;

            // Новая позиция, чтобы точка под курсором осталась на месте
            const newX = mouseX - worldX * newScale;
            const newY = mouseY - worldY * newScale;

            setPosition({ x: newX, y: newY });
        }

        setScale(newScale);
    }, [scale, position]);

    // Обработчик колесика мыши
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        // e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoom(delta, e.clientX, e.clientY);
    }, [zoom]);

    // Начало панорамирования
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button === 0) {
            setIsPanning(true);
            panStartRef.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y
            };
            if (containerRef.current) {
                containerRef.current.style.cursor = 'grabbing';
            }
        }
    }, [position]);

    // Панорамирование
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (isPanning) {
            const newX = e.clientX - panStartRef.current.x;
            const newY = e.clientY - panStartRef.current.y;
            setPosition({ x: newX, y: newY });
        }
    }, [isPanning]);

    // Окончание панорамирования
    const handleMouseUp = useCallback(() => {
        if (isPanning) {
            setIsPanning(false);
            if (containerRef.current) {
                containerRef.current.style.cursor = 'grab';
            }
        }
    }, [isPanning]);

    // Выход мыши за пределы контейнера
    const handleMouseLeave = useCallback(() => {
        if (isPanning) {
            setIsPanning(false);
            if (containerRef.current) {
                containerRef.current.style.cursor = 'grab';
            }
        }
    }, [isPanning]);

    // Сброс вида
    const resetView = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    return {
        scale,
        position,
        isPanning,
        containerRef,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        resetView
    };
};