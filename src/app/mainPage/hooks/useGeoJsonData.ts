// hooks/useGeoJsonData.ts
import { useState, useEffect } from 'react';
import { CountryFeatureCollection } from '@/types';
import {GeoJSON2SVG} from "geojson2svg";

export const useGeoJsonData = (url: string) => {
    const [data, setData] = useState<CountryFeatureCollection>([] as unknown as CountryFeatureCollection);
    const [paths, setPaths] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMap = async () => {
            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const geoJsonData: CountryFeatureCollection = await response.json();
                setData(geoJsonData);

                // Конвертируем GeoJSON в SVG
                const converter = new GeoJSON2SVG({
                    mapExtent: { left: -180, bottom: -90, right: 180, top: 90 },
                    viewportSize: { width: 1000, height: 600 },
                });

                const svgPaths = converter.convert(geoJsonData);
                setPaths(svgPaths);
            } catch (err: any) {
                console.error('Error loading map:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadMap();
    }, [url]);

    return { data, paths, loading, error };
};