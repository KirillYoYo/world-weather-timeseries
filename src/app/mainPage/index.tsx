// MainPage.tsx
import React from 'react'
import { useGeoJsonData } from './hooks/useGeoJsonData'
import { useMapInteraction } from './hooks/useMapInteraction'
import { useContinentColors } from './hooks/useContinentColors'
import { WorldMap } from './CountryPath'
import { MapControls } from './MapControls'
import { MapTips } from './MapTips'

const MainPage = () => {
    const { data, paths, loading, error } = useGeoJsonData('/world_110.json')
    const { getColorByContinent, getHoverColor } = useContinentColors()

    const { scale, position, resetView } = useMapInteraction()

    const handleCountryClick = (countryName: string) => {
        console.log('Clicked on:', countryName)
    }

    if (loading) return <div>Loading map...</div>
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <WorldMap
            // getColorByContinent={getColorByContinent}
            // getHoverColor={getHoverColor}
            // onCountryClick={handleCountryClick}
            />

            <MapTips />
        </div>
    )
}

export default MainPage