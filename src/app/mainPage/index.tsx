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

    const {
        scale,
        position,
        isPanning,
        containerRef,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        resetView,
    } = useMapInteraction()

    const handleCountryClick = (countryName: string) => {
        console.log('Clicked on:', countryName)
    }

    if (loading) return <div>Loading map...</div>
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <MapControls scale={scale} onReset={resetView} />

            <div
                ref={containerRef}
                style={{
                    height: '80%',
                    overflow: 'hidden',
                    cursor: isPanning ? 'grabbing' : 'grab',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    position: 'relative',
                    backgroundColor: '#f5f5f5',
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <WorldMap
                    paths={paths}
                    data={data}
                    scale={scale}
                    position={position}
                    getColorByContinent={getColorByContinent}
                    getHoverColor={getHoverColor}
                    onCountryClick={handleCountryClick}
                />
            </div>

            <MapTips />
        </div>
    )
}

export default MainPage