import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type MonthTempKey = `t${MonthNumber}`
export type MonthPrecKey = `p${MonthNumber}`
export type MonthTminKey = `tn${MonthNumber}`
export type MonthTmaxKey = `tx${MonthNumber}`
export type MonthWindKey = `w${MonthNumber}`
export type MonthSradKey = `s${MonthNumber}`

export type MapFeatureProperties = {
    name: string
    adm0_iso: string
    average_temp?: number
    average_prec?: number
    average_tmin?: number
    average_tmax?: number
    average_wind?: number
    average_srad?: number
    label?: string
    labelrank?: number
} & Partial<
    Record<
        MonthTempKey | MonthPrecKey | MonthTminKey | MonthTmaxKey | MonthWindKey | MonthSradKey,
        number
    >
>

export type MapFeatureCollection = FeatureCollection<Geometry, MapFeatureProperties>

export type CountryPolygon = Feature<Polygon | MultiPolygon, MapFeatureProperties>

export type CountryIndexEntry = {
    iso: string
    name: string
    feature: CountryPolygon
    minX: number
    minY: number
    maxX: number
    maxY: number
}
