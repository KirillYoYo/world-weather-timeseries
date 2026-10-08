import geojsonvt from 'geojson-vt'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Map, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useGeojsonVtProtocol } from '../hooks/useGeojsonVtProtocol'
import { boundsOf, countryAt, indexCountries, loadProvinces, loadWorld, WORLD_VIEW } from './data'
import FilterBar from './FilterBar'
import { DEFAULT_FILTER, metricTitle, type WeatherFilter } from './filter'
import {
    countryFillLayer,
    countryLabelsClose,
    countryLabelsOverview,
    countryLineLayer,
    mapStyle,
    provinceFillLayer,
    provinceLabelLayer,
    provinceLineLayer,
} from './map-style'
import type { MapFeatureCollection } from './types'
import './Weather.scss'

type Selection = {
    iso: string
    name: string
    status: 'loading' | 'ready' | 'missing'
}

export default function Weather() {
    const mapRef = useRef<MapRef | null>(null)
    const requestId = useRef(0)
    const [mapReady, setMapReady] = useState(false)
    const [countries, setCountries] = useState<MapFeatureCollection | null>(null)
    const [labels, setLabels] = useState<MapFeatureCollection | null>(null)
    const [provinces, setProvinces] = useState<MapFeatureCollection | null>(null)
    const [provinceLabels, setProvinceLabels] = useState<MapFeatureCollection | null>(null)
    const [selection, setSelection] = useState<Selection | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<WeatherFilter>(DEFAULT_FILTER)

    const countryIndex = useMemo(() => (countries ? indexCountries(countries) : []), [countries])
    const tileIndex = useMemo(() => {
        if (!countries) return null
        return geojsonvt(countries, {
            maxZoom: 12,
            tolerance: 3,
            indexMaxZoom: 4,
            indexMaxPoints: 100000,
        })
    }, [countries])
    const tilesReady = useGeojsonVtProtocol(tileIndex, mapRef, mapReady)
    const selectedIso = selection?.iso ?? null
    const countryFill = useMemo(() => countryFillLayer(filter), [filter])
    const overviewLabels = useMemo(
        () => countryLabelsOverview(selectedIso, filter),
        [selectedIso, filter]
    )
    const closeLabels = useMemo(
        () => countryLabelsClose(selectedIso, filter),
        [selectedIso, filter]
    )
    const provinceFill = useMemo(() => provinceFillLayer(filter), [filter])
    const provinceLabelsStyle = useMemo(() => provinceLabelLayer(filter), [filter])

    useEffect(() => {
        let cancelled = false
        loadWorld()
            .then(data => {
                if (cancelled) return
                setCountries(data.countries)
                setLabels(data.labels)
            })
            .catch(loadError => {
                if (cancelled) return
                setError(
                    loadError instanceof Error ? loadError.message : 'Не удалось загрузить карту'
                )
            })
        return () => {
            cancelled = true
        }
    }, [])

    const showWorld = useCallback(() => {
        requestId.current += 1
        setSelection(null)
        setProvinces(null)
        setProvinceLabels(null)
        mapRef.current?.getMap()?.flyTo({
            center: [WORLD_VIEW.longitude, WORLD_VIEW.latitude],
            zoom: WORLD_VIEW.zoom,
            duration: 700,
        })
    }, [])

    const selectCountry = useCallback(
        async (iso: string, name: string) => {
            if (selection?.iso === iso && selection.status !== 'missing') return

            const request = ++requestId.current
            setSelection({ iso, name, status: 'loading' })
            setProvinces(null)
            setProvinceLabels(null)

            try {
                const data = await loadProvinces(iso)
                if (request !== requestId.current) return
                if (!data) {
                    setSelection({ iso, name, status: 'missing' })
                    return
                }

                setProvinces(data.regions)
                setProvinceLabels(data.labels)
                setSelection({ iso, name, status: 'ready' })

                const bounds = boundsOf(data.regions)
                const map = mapRef.current?.getMap()
                if (!bounds || !map || bounds[2] - bounds[0] > 160) return
                map.fitBounds(
                    [
                        [bounds[0], bounds[1]],
                        [bounds[2], bounds[3]],
                    ],
                    { padding: 48, maxZoom: 6, duration: 700 }
                )
            } catch (loadError) {
                console.error(loadError)
                if (request !== requestId.current) return
                setSelection({ iso, name, status: 'missing' })
            }
        },
        [selection]
    )

    const onClick = (event: MapLayerMouseEvent) => {
        const hit = countryAt(countryIndex, event.lngLat.lng, event.lngLat.lat)
        if (hit) void selectCountry(hit.iso, hit.name)
    }

    const onMouseMove = (event: MapLayerMouseEvent) => {
        const canvas = mapRef.current?.getMap()?.getCanvas()
        if (!canvas) return
        canvas.style.cursor = countryAt(countryIndex, event.lngLat.lng, event.lngLat.lat)
            ? 'pointer'
            : ''
    }

    return (
        <div className="weather">
            <Map
                ref={mapRef}
                mapStyle={mapStyle}
                initialViewState={WORLD_VIEW}
                dragRotate={false}
                pitchWithRotate={false}
                touchPitch={false}
                onLoad={() => setMapReady(true)}
                onClick={onClick}
                onMouseMove={onMouseMove}
                style={{ width: '100%', height: '100%' }}
            >
                {mapReady && labels && (
                    <Source id="country-labels" type="geojson" data={labels}>
                        <Layer {...overviewLabels} />
                        <Layer {...closeLabels} />
                    </Source>
                )}
                {tilesReady && (
                    <Source id="countries" type="vector" tiles={['geojsonvt://{z}/{x}/{y}']}>
                        <Layer {...countryFill} beforeId="country-labels" />
                        <Layer {...countryLineLayer} beforeId="country-labels" />
                    </Source>
                )}
                {provinces && (
                    <Source id="provinces" type="geojson" data={provinces}>
                        <Layer {...provinceFill} beforeId="country-labels" />
                        <Layer {...provinceLineLayer} beforeId="country-labels" />
                    </Source>
                )}
                {provinceLabels && (
                    <Source id="province-label-points" type="geojson" data={provinceLabels}>
                        <Layer {...provinceLabelsStyle} />
                    </Source>
                )}
            </Map>
            <FilterBar value={filter} onChange={setFilter} />
            <aside className="weather-panel">
                <h1>{metricTitle(filter)}</h1>
                <div
                    className={
                        filter.metric === 'prec' ? 'weather-scale weather-scale-prec' : 'weather-scale'
                    }
                />
                <div className="weather-ticks">
                    {filter.metric === 'prec' ? (
                        <>
                            <span>0</span>
                            <span>50</span>
                            <span>100</span>
                            <span>200</span>
                            <span>400 мм</span>
                        </>
                    ) : (
                        <>
                            <span>-20°</span>
                            <span>0°</span>
                            <span>15°</span>
                            <span>30°</span>
                            <span>40°</span>
                        </>
                    )}
                </div>
                {selection && (
                    <>
                        <p>
                            {selection.name}
                            {selection.status === 'loading' && ' — загрузка провинций…'}
                            {selection.status === 'missing' && ' — провинции не найдены'}
                        </p>
                        <button type="button" onClick={showWorld}>
                            Весь мир
                        </button>
                    </>
                )}
                {error && <p>{error}</p>}
            </aside>
        </div>
    )
}
