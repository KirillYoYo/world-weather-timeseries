// hooks/useContinentColors.ts
import { useCallback } from 'react';

const continentColors: Record<string, string> = {
    'Africa': '#F4A460',
    'Asia': '#FFD700',
    'Europe': '#87CEEB',
    'North America': '#98FB98',
    'South America': '#DDA0DD',
    'Antarctica': '#E0E0E0',
    'Australia': '#F08080'
};

export const useContinentColors = () => {
    const getColorByContinent = useCallback((continent: string): string => {
        return continentColors[continent] || '#CCCCCC';
    }, []);

    const getHoverColor = useCallback(() => '#ffcccc', []);

    return { getColorByContinent, getHoverColor };
};