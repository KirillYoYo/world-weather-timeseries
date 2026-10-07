import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from 'maplibre-gl'
import type { LayerProps } from 'react-map-gl/maplibre'

import { temperatureBounds, temperatureProperty, type WeatherFilter } from './filter'

const FONT = ['Noto Sans Regular']
const FADED_FILL = 0.22
const FADED_LABEL = 0.35

function temperatureColor(property: string): ExpressionSpecification {
    return [
        'case',
        ['has', property],
        [
            'interpolate',
            ['linear'],
            ['to-number', ['get', property]],
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
}

function matchOpacity(filter: WeatherFilter, faded: number): ExpressionSpecification | number {
    const bounds = temperatureBounds(filter)
    if (bounds.min == null && bounds.max == null) return 1

    const property = temperatureProperty(filter.month)
    const tests: ExpressionSpecification[] = [['has', property]]
    if (bounds.min != null) {
        tests.push(['>=', ['to-number', ['get', property]], bounds.min])
    }
    if (bounds.max != null) {
        tests.push(['<=', ['to-number', ['get', property]], bounds.max])
    }
    return ['case', ['all', ...tests], 1, faded]
}

function temperatureLabel(month: number | null): ExpressionSpecification {
    const property = temperatureProperty(month)
    return [
        'case',
        ['has', property],
        [
            'concat',
            ['get', 'name'],
            '\n',
            [
                'number-format',
                ['to-number', ['get', property]],
                { 'min-fraction-digits': 1, 'max-fraction-digits': 1 },
            ],
            '°',
        ],
        ['get', 'name'],
    ]
}

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

export function countryFillLayer(filter: WeatherFilter) {
    const property = temperatureProperty(filter.month)
    return {
        id: 'countries-fill',
        type: 'fill' as const,
        'source-layer': 'data',
        paint: {
            'fill-color': temperatureColor(property),
            'fill-opacity': matchOpacity(filter, FADED_FILL),
        },
    } satisfies LayerProps
}

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

function countryLabelLayer(
    id: string,
    selectedIso: string | null,
    allowOverlap: boolean,
    filter: WeatherFilter
) {
    const featureFilter: FilterSpecification = selectedIso
        ? ['!=', ['get', 'adm0_iso'], selectedIso]
        : ['has', 'name']

    return {
        id,
        type: 'symbol' as const,
        filter: featureFilter,
        ...(allowOverlap ? { minzoom: 4 } : { maxzoom: 4 }),
        layout: {
            'text-field': temperatureLabel(filter.month),
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
        paint: {
            ...labelPaint,
            'text-opacity': matchOpacity(filter, FADED_LABEL),
        },
    } satisfies LayerProps
}

export function countryLabelsOverview(selectedIso: string | null, filter: WeatherFilter) {
    return countryLabelLayer('country-labels', selectedIso, false, filter)
}

export function countryLabelsClose(selectedIso: string | null, filter: WeatherFilter) {
    return countryLabelLayer('country-labels-close', selectedIso, true, filter)
}

export function provinceFillLayer(filter: WeatherFilter) {
    const property = temperatureProperty(filter.month)
    return {
        id: 'provinces-fill',
        type: 'fill' as const,
        paint: {
            'fill-color': temperatureColor(property),
            'fill-opacity': matchOpacity(filter, FADED_FILL),
        },
    } satisfies LayerProps
}

export const provinceLineLayer = {
    id: 'provinces-line',
    type: 'line',
    paint: {
        'line-color': '#ffffff',
        'line-width': 1,
    },
} satisfies LayerProps

export function provinceLabelLayer(filter: WeatherFilter) {
    return {
        id: 'province-labels',
        type: 'symbol' as const,
        layout: {
            'text-field': temperatureLabel(filter.month),
            'text-font': FONT,
            'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 5, 13, 8, 16],
            'text-line-height': 1.15,
            'text-max-width': 8,
            'text-anchor': 'center' as const,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
        },
        paint: {
            ...labelPaint,
            'text-opacity': matchOpacity(filter, FADED_LABEL),
        },
    } satisfies LayerProps
}
