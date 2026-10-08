import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import pointOnFeature from '@turf/point-on-feature'
import type { FeatureCollection, Geometry } from 'geojson'

import type {
    CountryIndexEntry,
    CountryPolygon,
    MapFeatureCollection,
    MapFeatureProperties,
    MonthPrecKey,
    MonthSradKey,
    MonthTempKey,
    MonthTmaxKey,
    MonthTminKey,
    MonthWindKey,
} from './types'

export type ProvinceLayers = {
    regions: MapFeatureCollection
    labels: MapFeatureCollection
}

type MonthField = 'temp' | 'prec' | 'tmin' | 'tmax' | 'wind' | 'srad'

type MonthWeather = Partial<Record<MonthField, number>>

type WeatherRecord = {
    average_temp?: number
    average_prec?: number
    average_tmin?: number
    average_tmax?: number
    average_wind?: number
    average_srad?: number
    [month: string]: number | MonthWeather | undefined
}

type WorldFeatureProperties = {
    name?: string
    adm0_iso?: string
    label_x?: number
    label_y?: number
    labelrank?: number
}

const WORLD_VIEW = { longitude: 10, latitude: 20, zoom: 1.5 }

export { WORLD_VIEW }

function asFinite(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readMonthValue(
    record: WeatherRecord | undefined,
    month: number,
    key: MonthField
): number | undefined {
    if (!record) return undefined
    const bucket = record[String(month)]
    if (!bucket || typeof bucket === 'number') return undefined
    return asFinite(bucket[key])
}

function setAverage(
    properties: MapFeatureProperties,
    key: keyof MapFeatureProperties,
    value: number | undefined
) {
    if (value == null) return
    ;(properties as Record<string, number | string | undefined>)[key as string] = value
}

function withWeather(
    name: string,
    adm0Iso: string,
    record: WeatherRecord | undefined
): MapFeatureProperties {
    const averageTemp = asFinite(record?.average_temp)
    const properties: MapFeatureProperties = {
        name,
        adm0_iso: adm0Iso,
        label: averageTemp == null ? name : `${name}\n${averageTemp.toFixed(1)}°`,
    }
    setAverage(properties, 'average_temp', averageTemp)
    setAverage(properties, 'average_prec', asFinite(record?.average_prec))
    setAverage(properties, 'average_tmin', asFinite(record?.average_tmin))
    setAverage(properties, 'average_tmax', asFinite(record?.average_tmax))
    setAverage(properties, 'average_wind', asFinite(record?.average_wind))
    setAverage(properties, 'average_srad', asFinite(record?.average_srad))

    for (let month = 1; month <= 12; month += 1) {
        const temp = readMonthValue(record, month, 'temp')
        if (temp != null) properties[`t${month}` as MonthTempKey] = temp
        const prec = readMonthValue(record, month, 'prec')
        if (prec != null) properties[`p${month}` as MonthPrecKey] = prec
        const tmin = readMonthValue(record, month, 'tmin')
        if (tmin != null) properties[`tn${month}` as MonthTminKey] = tmin
        const tmax = readMonthValue(record, month, 'tmax')
        if (tmax != null) properties[`tx${month}` as MonthTmaxKey] = tmax
        const wind = readMonthValue(record, month, 'wind')
        if (wind != null) properties[`w${month}` as MonthWindKey] = wind
        const srad = readMonthValue(record, month, 'srad')
        if (srad != null) properties[`s${month}` as MonthSradKey] = srad
    }
    return properties
}

async function loadRegionWeather(iso: string): Promise<Record<string, WeatherRecord>> {
    const monthly = await fetch(`/regions-by-mounts/${encodeURIComponent(iso)}.json`)
    if (monthly.ok) return monthly.json()
    const annual = await fetch(`/output_json/${encodeURIComponent(iso)}.json`)
    if (annual.ok) return annual.json()
    return {}
}

export async function loadWorld(): Promise<{
    countries: MapFeatureCollection
    labels: MapFeatureCollection
}> {
    const [worldResponse, weatherResponse] = await Promise.all([
        fetch('/world_50.geo.json'),
        fetch('/all_countries_data.json'),
    ])
    if (!worldResponse.ok) {
        throw new Error(`Не удалось загрузить карту стран (${worldResponse.status})`)
    }
    if (!weatherResponse.ok) {
        throw new Error(`Не удалось загрузить погоду стран (${weatherResponse.status})`)
    }

    const world = (await worldResponse.json()) as FeatureCollection<
        Geometry,
        WorldFeatureProperties
    >
    const weather = (await weatherResponse.json()) as Record<string, WeatherRecord>

    const countries: MapFeatureCollection = {
        type: 'FeatureCollection',
        features: world.features.flatMap(feature => {
            const iso = feature.properties?.adm0_iso
            const name = feature.properties?.name
            if (!iso || !name || !feature.geometry) return []
            return [
                {
                    type: 'Feature' as const,
                    geometry: feature.geometry,
                    properties: withWeather(name, iso, weather[iso]),
                },
            ]
        }),
    }

    const labels: MapFeatureCollection = {
        type: 'FeatureCollection',
        features: world.features.flatMap(feature => {
            const iso = feature.properties?.adm0_iso
            const name = feature.properties?.name
            const longitude = feature.properties?.label_x
            const latitude = feature.properties?.label_y
            if (!iso || !name || longitude == null || latitude == null) return []
            return [
                {
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [longitude, latitude] },
                    properties: {
                        ...withWeather(name, iso, weather[iso]),
                        labelrank: feature.properties?.labelrank ?? 8,
                    },
                },
            ]
        }),
    }

    return { countries, labels }
}

export async function loadProvinces(iso: string): Promise<ProvinceLayers | null> {
    const [geometryResponse, weather] = await Promise.all([
        fetch(`/countries/${encodeURIComponent(iso)}.json`),
        loadRegionWeather(iso),
    ])
    if (!geometryResponse.ok) return null

    const geometry = (await geometryResponse.json()) as FeatureCollection<
        Geometry,
        { shapeName?: string }
    >

    const regions: MapFeatureCollection = {
        type: 'FeatureCollection',
        features: (geometry.features ?? []).flatMap(feature => {
            const name = feature.properties?.shapeName
            if (!name || !feature.geometry) return []
            if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
                return []
            }
            return [
                {
                    type: 'Feature' as const,
                    geometry: feature.geometry,
                    properties: withWeather(name, iso, weather[name]),
                },
            ]
        }),
    }
    if (regions.features.length === 0) return null

    const labels: MapFeatureCollection = {
        type: 'FeatureCollection',
        features: regions.features.map(feature => ({
            type: 'Feature' as const,
            geometry: pointOnFeature(feature as CountryPolygon).geometry,
            properties: feature.properties,
        })),
    }

    return { regions, labels }
}

function boundsOfGeometry(geometry: Geometry): [number, number, number, number] | null {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    const walk = (node: unknown) => {
        if (!Array.isArray(node) || node.length === 0) return
        if (typeof node[0] === 'number' && typeof node[1] === 'number') {
            const x = node[0]
            const y = node[1]
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
            return
        }
        node.forEach(walk)
    }

    if (geometry.type === 'GeometryCollection') {
        geometry.geometries.forEach(child => {
            const childBounds = boundsOfGeometry(child)
            if (!childBounds) return
            minX = Math.min(minX, childBounds[0])
            minY = Math.min(minY, childBounds[1])
            maxX = Math.max(maxX, childBounds[2])
            maxY = Math.max(maxY, childBounds[3])
        })
    } else {
        walk(geometry.coordinates)
    }

    if (!Number.isFinite(minX)) return null
    return [minX, minY, maxX, maxY]
}

export function indexCountries(countries: MapFeatureCollection): CountryIndexEntry[] {
    return countries.features.flatMap(feature => {
        const geometryType = feature.geometry?.type
        if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') return []
        const bounds = boundsOfGeometry(feature.geometry)
        if (!bounds) return []
        const polygon = feature as CountryPolygon
        return [
            {
                iso: polygon.properties.adm0_iso,
                name: polygon.properties.name,
                feature: polygon,
                minX: bounds[0],
                minY: bounds[1],
                maxX: bounds[2],
                maxY: bounds[3],
            },
        ]
    })
}

export function countryAt(
    index: CountryIndexEntry[],
    longitude: number,
    latitude: number
): { iso: string; name: string } | null {
    const cursor = point([longitude, latitude])
    for (const entry of index) {
        if (
            longitude < entry.minX ||
            longitude > entry.maxX ||
            latitude < entry.minY ||
            latitude > entry.maxY
        ) {
            continue
        }
        if (booleanPointInPolygon(cursor, entry.feature)) {
            return { iso: entry.iso, name: entry.name }
        }
    }
    return null
}

export function boundsOf(
    collection: MapFeatureCollection
): [number, number, number, number] | null {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    collection.features.forEach(feature => {
        if (!feature.geometry) return
        const bounds = boundsOfGeometry(feature.geometry)
        if (!bounds) return
        minX = Math.min(minX, bounds[0])
        minY = Math.min(minY, bounds[1])
        maxX = Math.max(maxX, bounds[2])
        maxY = Math.max(maxY, bounds[3])
    })

    if (!Number.isFinite(minX)) return null
    return [minX, minY, maxX, maxY]
}
