import React, { useEffect, useState } from 'react';
import {GeoJSON2SVG} from 'geojson2svg';
// import {FeatureCollection, GeoJsonTypes} from "geojson";
// import { GeoJSON } from 'geojson';
import {CountryFeatureCollection} from "@/types";

const continentColors: Record<string, string> = {
    'Africa': '#F4A460',        // песочный
    'Asia': '#FFD700',           // золотой
    'Europe': '#87CEEB',         // небесно-голубой
    'North America': '#98FB98',  // бледно-зеленый
    'South America': '#DDA0DD',  // сливовый
    'Antarctica': '#E0E0E0',     // серый
    'Australia': '#F08080'       // коралловый
};

const getColorByContinent = (continent: string): string => {
    return continentColors[continent] || '#CCCCCC';
};

const MainPage = () => {
    const [paths, setPaths] = useState<string[]>([]);
    const [data, setData] = useState<CountryFeatureCollection>([] as unknown as CountryFeatureCollection);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadMap = async () => {
            try {
                const response = await fetch('/world_110.json');
                const geoJsonData: CountryFeatureCollection = await response.json();
                setData(geoJsonData);
                console.log('geoJsonData', geoJsonData)

                if (!response.ok) {
                    console.warn(`HTTP error! status: ${response.status}`)
                }

                const converter = new GeoJSON2SVG({
                    mapExtent: {left: -180, bottom: -90, right: 180, top: 90},
                    viewportSize: {width: 1000, height: 600},
                });

                const svg = converter.convert(geoJsonData);

                setPaths(svg);
            } catch (err: any) {
                console.error('Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadMap();
    }, []);

    if (loading) return <div>Loading map...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    const handleCountryClick = (data: any) => {
        console.log('click on', data)
    }

    return (
        <div style={{ height: '100%' }}>
            <svg width={'100%'} height={'80%'}>
                {paths.map((pathStr, index) => {
                    // Извлекаем d атрибут из строки <path d="..."/>
                    const dMatch = pathStr.match(/d="([^"]*)"/);
                    const pathD = dMatch ? dMatch[1] : '';
                    const currentData = data.features[index]

                    return (
                        <path
                            key={index}
                            d={pathD}
                            fill={getColorByContinent(currentData.properties.CONTINENT)}
                            stroke="#333"
                            strokeWidth="0.5"
                            onClick={() => handleCountryClick(currentData.properties.ADMIN)}
                            onMouseEnter={(e: React.MouseEvent<SVGPathElement, MouseEvent>) => e.currentTarget.setAttribute('fill', '#ffcccc')}
                            onMouseLeave={(e) => e.currentTarget.setAttribute('fill', getColorByContinent(currentData.properties.CONTINENT))}
                            style={{ cursor: 'pointer' }}
                        />
                    );
                })}
            </svg>
        </div>
    );
};

export default MainPage;