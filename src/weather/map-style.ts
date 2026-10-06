import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from 'maplibre-gl'
import type { LayerProps } from 'react-map-gl/maplibre'

const FONT = ['Noto Sans Regular']

const temperatureColor: ExpressionSpecification = [
    'case',
    ['has', 'average_temp'],
    [
        'interpolate',
        ['linear'],
        ['to-number', ['get', 'average_temp']],
        -20,
        '#313695',
        -10,
        '#4575b4',
        0,
        '#74add1',
        10,
        '#abd9e9',
        15,
        '#fee090',
        20,
        '#fdae61',
        25,
        '#f46d43',
        30,
        '#d73027',
        40,
        '#a50026',
    ],
    '#d0d0d0',
]

export const mapStyle: StyleSpecification = {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {},
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#d8f2ff' },
        },
    ],
}

const labelPaint = {
    'text-color': '#1c1c1c',
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.4,
} as const

export const countryFillLayer = {
    id: 'countries-fill',
    type: 'fill',
    'source-layer': 'data',
    paint: {
        'fill-color': temperatureColor,
    },
} satisfies LayerProps

export const countryLineLayer = {
    id: 'countries-line',
    type: 'line',
    'source-layer': 'data',
    paint: {
        'line-color': '#ffffff',
        'line-width': 0.6,
        'line-opacity': 0.9,
    },
} satisfies LayerProps

function countryLabelLayer(id: string, selectedIso: string | null, allowOverlap: boolean) {
    const filter: FilterSpecification = selectedIso
        ? ['!=', ['get', 'adm0_iso'], selectedIso]
        : ['has', 'label']

    return {
        id,
        type: 'symbol' as const,
        filter,
        ...(allowOverlap ? { minzoom: 4 } : { maxzoom: 4 }),
        layout: {
            'text-field': ['get', 'label'],
            'text-font': FONT,
            'text-size': ['interpolate', ['linear'], ['zoom'], 0, 9, 3, 12, 6, 15],
            'text-line-height': 1.15,
            'text-max-width': 10,
            'text-anchor': 'center' as const,
            'text-allow-overlap': allowOverlap,
            'text-ignore-placement': allowOverlap,
            'symbol-sort-key': ['coalesce', ['get', 'labelrank'], 8] as ExpressionSpecification,
            'text-padding': allowOverlap ? 0 : 2,
        },
        paint: labelPaint,
    } satisfies LayerProps
}

export function countryLabelsOverview(selectedIso: string | null) {
    return countryLabelLayer('country-labels', selectedIso, false)
}

export function countryLabelsClose(selectedIso: string | null) {
    return countryLabelLayer('country-labels-close', selectedIso, true)
}

export const provinceFillLayer = {
    id: 'provinces-fill',
    type: 'fill',
    paint: {
        'fill-color': temperatureColor,
    },
} satisfies LayerProps

export const provinceLineLayer = {
    id: 'provinces-line',
    type: 'line',
    paint: {
        'line-color': '#ffffff',
        'line-width': 1,
    },
} satisfies LayerProps

export const provinceLabelLayer = {
    id: 'province-labels',
    type: 'symbol',
    layout: {
        'text-field': ['get', 'label'],
        'text-font': FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 5, 13, 8, 16],
        'text-line-height': 1.15,
        'text-max-width': 8,
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
    },
    paint: labelPaint,
} satisfies LayerProps
