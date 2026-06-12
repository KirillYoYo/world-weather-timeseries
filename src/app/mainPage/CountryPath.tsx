// components/WorldMap.tsx (переименуем, так как больше не бесконечный)
import React from 'react';

interface WorldMapProps {
    paths: string[];
    data: any;
    scale: number;
    position: { x: number; y: number };
    worldWidth?: number;
    worldHeight?: number;
    getColorByContinent: (continent: string) => string;
    getHoverColor: () => string;
    onCountryClick: (countryName: string) => void;
}

export const WorldMap: React.FC<WorldMapProps> = ({
                                                      paths,
                                                      data,
                                                      scale,
                                                      position,
                                                      worldWidth = 1000,
                                                      worldHeight = 600,
                                                      getColorByContinent,
                                                      getHoverColor,
                                                      onCountryClick
                                                  }) => {
    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                willChange: 'transform'
            }}
        >
            <svg width={worldWidth} height={worldHeight}>
                {paths.map((pathStr, index) => {
                    const dMatch = pathStr.match(/d="([^"]*)"/);
                    const pathD = dMatch ? dMatch[1] : '';
                    const currentData = data.features?.[index];

                    if (!currentData) return null;

                    return (
                        <path
                            key={index}
                            d={pathD}
                            fill={getColorByContinent(currentData.properties.CONTINENT)}
                            stroke="#333"
                            strokeWidth="0.5"
                            onClick={() => onCountryClick(currentData.properties.ADMIN)}
                            onMouseEnter={(e) => e.currentTarget.setAttribute('fill', getHoverColor())}
                            onMouseLeave={(e) => e.currentTarget.setAttribute('fill', getColorByContinent(currentData.properties.CONTINENT))}
                            style={{ cursor: 'pointer' }}
                        />
                    );
                })}
            </svg>
        </div>
    );
};