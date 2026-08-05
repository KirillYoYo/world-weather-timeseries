// @ts-ignore
import geojsonvt from 'geojson-vt'
import * as React from 'react'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Map as MapGlMap, Source, Layer, MapRef } from 'react-map-gl/maplibre'
import { useGeojsonVtProtocol } from '../hooks/useGeojsonVtProtocol'
import 'maplibre-gl/dist/maplibre-gl.css'

import { dataLayer, labelLayer } from './map-style'

export default function Weather() {
    const [geoData, setGeoData] = useState(null)
    const mapRef = useRef<MapRef | null>(null)
    const [visibleCountries, setVisibleCountries] = useState<any[]>([])

    const tileIndex = useMemo(() => {
        if (!geoData) return null

        return geojsonvt(geoData, {
            maxZoom: 14, // максимальный зум, для которого строятся тайлы
            layerName: 'data', // имя слоя, которое будем указывать в <Layer>
            tolerance: 3, // допустимое упрощение (чем выше, тем проще геометрия)
            generateId: true, // генерировать ID для объектов
            indexMaxZoom: 5, // зум, до которого строятся индексы для ускорения
            indexMaxPoints: 100000,
        })
    }, [geoData])

    const protocolReady = useGeojsonVtProtocol(tileIndex, mapRef)

    useEffect(() => {
        async function fetchData() {
            const response = await fetch('/world_10.geo.json')
            return response.json()
        }
        fetchData().then(res => {
            setGeoData(res)
        })
    }, [])

    const updateVisibleCountries = useCallback(() => {
        const map = mapRef.current?.getMap()
        if (!map) return

        const features = map.queryRenderedFeatures({ layers: ['data'] })

        const uniqueCountriesMap = new Map()
        features.forEach(feature => {
            const name = feature.properties?.name
            if (name && !uniqueCountriesMap.has(name)) {
                uniqueCountriesMap.set(name, feature.properties)
            }
        })

        const countries = Array.from(uniqueCountriesMap.values())
        setVisibleCountries(countries)
    }, [mapRef])

    const onLoad = () => {
        const map = mapRef.current?.getMap()
        if (!map) return

        map.on('moveend', updateVisibleCountries)

        setTimeout(() => {
            // todo убрать костыль с timeout
            updateVisibleCountries()
        }, 500)

        return () => {
            map.off('moveend', updateVisibleCountries)
        }
    }

    console.log('visibleCountries', visibleCountries)

    return (
        <>
            <MapGlMap
                ref={mapRef}
                initialViewState={{
                    latitude: 40,
                    longitude: -100,
                    zoom: 3,
                }}
                interactiveLayerIds={['data']}
                onLoad={() => onLoad()}
            >
                {protocolReady && (
                    <Source type="vector" tiles={['geojsonvt://{z}/{x}/{y}']}>
                        <Layer {...dataLayer} source-layer="data" />
                        <Layer {...labelLayer} source-layer="data" />
                    </Source>
                )}
            </MapGlMap>
        </>
    )
}