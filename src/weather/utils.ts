//@ts-ignore
import { range } from 'd3-array'
//@ts-ignore
import { scaleQuantile } from 'd3-scale'

import type GeoJSON from 'geojson'
import type { Feature, FeatureCollection } from 'geojson'
import { LngLat, Map } from 'maplibre-gl'

export function updatePercentiles(
    featureCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry>,
    accessor: (f: GeoJSON.Feature<GeoJSON.Geometry>) => number
): GeoJSON.FeatureCollection<GeoJSON.Geometry> {
    const { features } = featureCollection
    const scale = scaleQuantile().domain(features.map(accessor)).range(range(9))
    return {
        type: 'FeatureCollection',
        features: features.map(f => {
            const value = accessor(f)
            const properties = {
                ...f.properties,
                value,
                percentile: scale(value),
            }
            return { ...f, properties }
        }),
    }
}

export function getFeatureCenter(feature: any): [number, number] {
    const coords = feature.geometry.coordinates

    if (coords.length === 0) {
        return [999999, 999999]
    }

    if (feature.geometry.type === 'Point') {
        return coords
    } else if (feature.geometry.type === 'Polygon') {
        // Вычисляем среднюю точку по всем координатам внешнего кольца
        const ring = coords[0]
        let lng = 0,
            lat = 0
        for (let i = 0; i < ring.length; i++) {
            lng += ring[i][0]
            lat += ring[i][1]
        }
        lng /= ring.length
        lat /= ring.length
        return [lng, lat]
    } else if (feature.geometry.type === 'MultiPolygon') {
        // Берем первый полигон
        const ring = coords[0][0]
        let lng = 0,
            lat = 0
        for (let i = 0; i < ring.length; i++) {
            lng += ring[i][0]
            lat += ring[i][1]
        }
        lng /= ring.length
        lat /= ring.length
        return [lng, lat]
    }
    // fallback
    return [99999, 999999]
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // радиус Земли в км
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

export function getCountryAtCenter(
    map: Map,
    center: LngLat,
    countries: FeatureCollection['features']
): Feature | null {
    // Получаем пиксельные координаты центра экрана
    const pixel = map.project([center.lng, center.lat])

    // Запрашиваем все фичи слоя 'data' в этой точке
    const features = map.queryRenderedFeatures(pixel, { layers: ['data'] })

    // Отфильтровываем только полигоны (на случай, если есть точки/линии)
    const polygons = features.filter(
        f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
    )

    if (polygons.length > 0) {
        return polygons[0] // берём первый попавшийся (обычно самый верхний)
    }

    // Fallback: если центр в океане — ищем ближайшую страну по центроиду (ваш старый код)
    let minDist = Infinity
    let closest = null
    countries.forEach(feature => {
        const centerCoords = getFeatureCenter(feature)
        const dist = haversineDistance(center.lat, center.lng, centerCoords[1], centerCoords[0])
        if (dist < minDist) {
            minDist = dist
            closest = feature
        }
    })
    return closest
}