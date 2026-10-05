// @ts-ignore
import geojsonvt from 'geojson-vt'
import * as React from 'react'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Map as MapGlMap, Source, Layer, MapRef } from 'react-map-gl/maplibre'
import { useGeojsonVtProtocol } from '../hooks/useGeojsonVtProtocol'
import 'maplibre-gl/dist/maplibre-gl.css'

import { borderLayer, dataLayer } from './map-style'
import { getCountryAtCenter } from './utils'
import { FeatureCollection } from '../types'
import { Feature } from 'geojson'

export default function Weather() {
    const [geoData, setGeoData] = useState(null)
    const mapRef = useRef<MapRef | null>(null)
    const [labelData, setLabelData] = useState<FeatureCollection | null>(null)
    const [countries, setCountries] = useState<FeatureCollection | null>(null)
    const [continentData, setContinentData] = useState<FeatureCollection | null>(null)
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
        async function getCountriesTemp() {
            const response = await fetch('/all_countries_data.json')
            return response.json()
        }
        Promise.all([fetchData(), getCountriesTemp()]).then(res => {
            const worldData = res[0]
            const tempData = res[1]
            // todo слой для лейблов
            const labelFeatures = worldData.features.map((f: any) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [f.properties.label_x, f.properties.label_y],
                },
                properties: {
                    name: f.properties.name,
                    name_en: f.properties.name_en,
                    average_temp: tempData[f?.properties.adm0_iso]?.average_temp,
                    // при необходимости скопируйте другие поля (adm0_iso и т.д.)
                },
            }))
            const labelGeoData = { type: 'FeatureCollection', features: labelFeatures }
            const worldDataWithTemp = worldData.features.map(f => ({
                ...f,
                properties: {
                    ...f.properties,
                    average_temp: tempData[f?.properties.adm0_iso]?.average_temp,
                },
            }))
            const continentFeatures = buildContinentsPoints(worldDataWithTemp)

            setContinentData(continentFeatures)
            setLabelData(labelGeoData as FeatureCollection)
            setGeoData({ ...worldData, features: worldDataWithTemp })
        })
    }, [])

    const updateVisibleCountries = useCallback(
        async isoName => {
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

            if ((curZoom > 3.6 && closestCountry && closestCountry.properties) || isoName) {
                const iso = isoName || closestCountry.properties.adm0_iso
                const t = new Date().getMilliseconds()
                if (downloadedCountries.includes(iso)) {
                    return
                }
                console.log('Загружаем страну:', iso)
                // todo зарефакторить на promise
                const response = await fetch(`/countries/${iso}.json`)
                const response2 = await fetch(`/output_json/${iso}.json`)
                if (!response.ok) {
                    console.warn(`Страна ${iso} не найдена (${response.status})`)
                } else {
                    const data = (await response.json()) as FeatureCollection
                    const dataTemp = (await response2.json()) as FeatureCollection

                    data.features.forEach((feature, i) => {
                        data.features[i] = {
                            ...feature,
                            properties: {
                                ...feature.properties,
                                temp: dataTemp[feature.properties.shapeName],
                            },
                        }
                    })

                    console.log('data', data)
                    console.log('dataTemp', dataTemp)
                    console.log('downloaded at', new Date().getMilliseconds() - t)
                    setDownloadedCountries([iso])
                    setCountries(data)
                }
            }
        },
        [mapRef, downloadedCountries]
    )

    useEffect(() => {
        const map = mapRef.current?.getMap()
        if (!map) return
        map.off('moveend', updateVisibleCountries)
        map.on('moveend', updateVisibleCountries)
    }, [downloadedCountries])

    const onLoad = () => {
        const map = mapRef.current?.getMap()
        if (!map) return

        // todo убрать, сейчас нужно для загрузки провиция на скролле
        map.on('moveend', () => updateVisibleCountries(null))

        setTimeout(() => {
            // todo убрать костыль с timeout
            updateVisibleCountries()
        }, 500)

        return () => {
            map.off('moveend', updateVisibleCountries)
        }
    }

    console.log('geoData', geoData)
    console.log('countries', countries)

    const onClick = event => {
        const feature = event.features[0]
        console.log('click')
        updateVisibleCountries(feature.properties.adm0_iso)
    }

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
                onClick={onClick}
            >
                {protocolReady && (
                    <Source type="vector" tiles={['geojsonvt://{z}/{x}/{y}']}>
                        <Layer {...dataLayer} />
                        <Layer {...borderLayer} />
                    </Source>
                )}
                {protocolReady && labelData && (
                    <Source id="country-labels" type="geojson" data={labelData}>
                        <Layer
                            minzoom={3}
                            id="country-label-layer"
                            type="symbol"
                            layout={{
                                'text-field': [
                                    'concat',
                                    ['get', 'name'],
                                    ' — ',
                                    ['to-string', ['get', 'average_temp']],
                                    '°C',
                                ],
                                'text-font': ['Montserrat Medium'],
                                'text-size': 12,
                                'text-transform': 'uppercase',
                                'symbol-placement': 'point',
                            }}
                            paint={{
                                'text-color': '#333',
                                'text-halo-color': '#fff',
                                'text-halo-width': 1,
                            }}
                        />
                    </Source>
                )}
                {continentData && (
                    <Source id="continent-points" type="geojson" data={continentData}>
                        <Layer
                            id="continent-label-layer"
                            type="symbol"
                            minzoom={0}
                            maxzoom={3}
                            layout={{
                                'text-field': ['get', 'name'],
                                'text-font': ['Montserrat Medium'],
                                'text-size': 14,
                                'text-transform': 'uppercase',
                                'symbol-placement': 'point',
                            }}
                            paint={{
                                'text-color': '#333',
                                'text-halo-color': '#fff',
                                'text-halo-width': 1,
                            }}
                        />
                    </Source>
                )}
                {countries && (
                    <Source id="countries" type="geojson" data={countries}>
                        <Layer
                            id="test-all"
                            type="fill"
                            paint={{
                                'fill-color': [
                                    'interpolate',
                                    ['linear'],
                                    ['coalesce', ['get', 'average_temp', ['get', 'temp']], 0], // ← INPUT целиком обёрнут
                                    -10,
                                    '#313695',
                                    0,
                                    '#4575b4',
                                    10,
                                    '#74add1',
                                    15,
                                    '#abd9e9',
                                    20,
                                    '#fdae61',
                                    25,
                                    '#f46d43',
                                    30,
                                    '#d73027',
                                    40,
                                    '#a50026',
                                ],
                                'fill-opacity': 1,
                            }}
                        />
                        <Layer
                            minzoom={3}
                            id="state-labels"
                            type="symbol"
                            layout={{
                                'text-field': [
                                    'concat',
                                    ['to-string', ['round', ['get', 'average_temp']]],
                                    '°C',
                                ],
                                'text-font': ['Montserrat Medium'],
                                'text-size': 12,
                                'text-transform': 'uppercase',
                                'symbol-placement': 'point',
                                'text-allow-overlap': false,
                            }}
                            paint={{
                                'text-color': '#000',
                                'text-halo-color': '#fff',
                                'text-halo-width': 1.5,
                            }}
                        />
                    </Source>
                )}
            </MapGlMap>
        </>
    )
}

function buildContinentsPoints(features: any[]): FeatureCollection {
    const continentsMap = new Map<string, { lats: number[]; lngs: number[]; name: string }>()

    features.forEach((f: any) => {
        const continent = f.properties.continent
        if (!continent) return
        if (!continentsMap.has(continent)) {
            continentsMap.set(continent, { lats: [], lngs: [], name: continent })
        }
        const entry = continentsMap.get(continent)!
        // Используем label_x (долгота) и label_y (широта)
        const x = f.properties.label_x
        const y = f.properties.label_y
        if (x != null && y != null) {
            entry.lngs.push(x)
            entry.lats.push(y)
        }
    })

    const featuresС: Feature[] = []
    for (const [continent, data] of continentsMap.entries()) {
        const avgLng = data.lngs.reduce((a, b) => a + b, 0) / data.lngs.length
        const avgLat = data.lats.reduce((a, b) => a + b, 0) / data.lats.length
        featuresС.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [avgLng, avgLat],
            },
            properties: {
                name: continent,
            },
        })
    }

    return { type: 'FeatureCollection', features: featuresС }
}