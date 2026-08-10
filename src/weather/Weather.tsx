// @ts-ignore
import geojsonvt from 'geojson-vt'
import * as React from 'react'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Map as MapGlMap, Source, Layer, MapRef } from 'react-map-gl/maplibre'
import { useGeojsonVtProtocol } from '../hooks/useGeojsonVtProtocol'
import 'maplibre-gl/dist/maplibre-gl.css'

import { borderLayer, dataLayer, labelLayer } from './map-style'
import { getCountryAtCenter } from './utils'
import { FeatureCollection } from '../types'
import union from '@turf/union'

export default function Weather() {
    const [geoData, setGeoData] = useState(null)
    const mapRef = useRef<MapRef | null>(null)
    const [countries, setCountries] = useState<FeatureCollection | null>(null)
    const [downloadedCountries, setDownloadedCountries] = useState<string[]>([])

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
            const response = await fetch('/world_50.geo.json')
            return response.json()
        }
        fetchData().then(res => {
            // todo слой для лейблов
            // const labelFeatures = res.features.map(el => {})
            setGeoData(res)
        })
    }, [])

    const updateVisibleCountries = useCallback(async () => {
        const map = mapRef.current?.getMap()
        if (!map) return

        const curZoom = map.getZoom()
        const center = map.getCenter() // { lat, lng }

        const features = map.queryRenderedFeatures({ layers: ['data'] })

        if (!features) return

        const uniqueCountriesMap = new Map()
        features.forEach(feature => {
            const name = feature.properties?.name
            if (name && !uniqueCountriesMap.has(name)) {
                uniqueCountriesMap.set(name, {
                    properties: feature.properties,
                    geometry: feature.geometry,
                })
            }
        })

        const countries = Array.from(uniqueCountriesMap.values())

        const closestCountry = getCountryAtCenter(map, center, countries)

        if (curZoom > 3.6 && closestCountry && closestCountry.properties) {
            const iso = closestCountry.properties.adm0_iso
            if (downloadedCountries.includes(iso)) {
                return
            }
            console.log('Загружаем страну:', iso)
            const response = await fetch(`/countries/${iso}.json`)
            if (!response.ok) {
                console.warn(`Страна ${iso} не найдена (${response.status})`)
            } else {
                const data = (await response.json()) as FeatureCollection
                setDownloadedCountries([...downloadedCountries, iso])
                setCountries(data)
            }
        }
    }, [mapRef, downloadedCountries])

    useEffect(() => {
        const map = mapRef.current?.getMap()
        if (!map) return
        map.off('moveend', updateVisibleCountries)
        map.on('moveend', updateVisibleCountries)
    }, [downloadedCountries])

    const onLoad = () => {
        const map = mapRef.current?.getMap()
        if (!map) return

        map.on('moveend', updateVisibleCountries)

        setTimeout(() => {
            // todo убрать костыль с timeout
            updateVisibleCountries()
            console.log('123123', map.getSource('data'))
        }, 500)

        return () => {
            map.off('moveend', updateVisibleCountries)
        }
    }

    console.log('geoData', geoData)
    console.log('countries', countries)

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
                        <Layer {...dataLayer} />
                        <Layer {...borderLayer} />
                        <Layer {...labelLayer} />
                    </Source>
                )}
                {countries && (
                    <Source id="countries" type="geojson" data={countries}>
                        <Layer
                            id="test-all"
                            type="fill"
                            paint={{ 'fill-color': 'red', 'fill-opacity': 0.7 }}
                        />
                    </Source>
                )}
            </MapGlMap>
        </>
    )
}