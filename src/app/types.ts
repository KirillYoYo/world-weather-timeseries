export interface GeoJSONData {
    type: 'FeatureCollection'
    features: CountryFeature[]
}

export interface CountryFeature {
    type: 'Feature'
    properties: CountryProperties
    geometry: CountryGeometry
}

// Свойства страны (зависит от вашего файла)
interface CountryProperties {
    ADMIN: string // Название страны
    NAME?: string // Альтернативное название
    ISO_A2?: string // Код страны (2 буквы)
    ISO_A3?: string // Код страны (3 буквы)
    POP_EST?: number // Население
    CONTINENT?: string // Континент
    [key: string]: any // Для других свойств
}

// Геометрия страны
interface CountryGeometry {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
}