import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from 'maplibre-gl'
import type { LayerProps } from 'react-map-gl/maplibre'

import {
    metricFractionDigits,
    metricProperty,
    metricUnit,
    tmaxProperty,
    tminProperty,
    valueBounds,
    type WeatherFilter,
} from './filter'

const FONT = ['Noto Sans Regular']
const FADED_FILL = 0.22
const FADED_LABEL = 0.35

function formatNumber(property: string, digits: number): ExpressionSpecification {
    return [
        'number-format',
        ['to-number', ['get', property]],
        { 'min-fraction-digits': digits, 'max-fraction-digits': digits },
    ]
}

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

function precipitationColor(property: string): ExpressionSpecification {
    return [
        'case',
        ['has', property],
        [
            'interpolate',
            ['linear'],
            ['to-number', ['get', property]],
            0,
            '#ffffd9',
            20,
            '#edf8b1',
            50,
            '#c7e9b4',
            100,
            '#7fcdbb',
            150,
            '#41b6c4',
            200,
            '#1d91c0',
            300,
            '#225ea8',
            400,
            '#0c2c84',
        ],
        '#d0d0d0',
    ]
}

function windColor(property: string): ExpressionSpecification {
    return [
        'case',
        ['has', property],
        [
            'interpolate',
            ['linear'],
            ['to-number', ['get', property]],
            0,
            '#f7fcf5',
            1,
            '#c7e9c0',
            2,
            '#74c476',
            3,
            '#31a354',
            4,
            '#006d2c',
            6,
            '#00441b',
            8,
            '#001a0f',
        ],
        '#d0d0d0',
    ]
}

function sradColor(property: string): ExpressionSpecification {
    return [
        'case',
        ['has', property],
        [
            'interpolate',
            ['linear'],
            ['to-number', ['get', property]],
            0,
            '#ffffe5',
            5000,
            '#fff7bc',
            10000,
            '#fee391',
            15000,
            '#fec44f',
            20000,
            '#fe9929',
            25000,
            '#ec7014',
            30000,
            '#cc4c02',
            40000,
            '#8c2d04',
        ],
        '#d0d0d0',
    ]
}

function metricColor(filter: WeatherFilter): ExpressionSpecification {
    const property = metricProperty(filter)
    if (filter.metric === 'prec') return precipitationColor(property)
    if (filter.metric === 'wind') return windColor(property)
    if (filter.metric === 'srad') return sradColor(property)
    return temperatureColor(property)
}

function matchOpacity(filter: WeatherFilter, faded: number): ExpressionSpecification | number {
    const bounds = valueBounds(filter)
    if (bounds.min == null && bounds.max == null) return 1

    const property = metricProperty(filter)
    const tests: ExpressionSpecification[] = [['has', property]]
    if (bounds.min != null) {
        tests.push(['>=', ['to-number', ['get', property]], bounds.min])
    }
    if (bounds.max != null) {
        tests.push(['<=', ['to-number', ['get', property]], bounds.max])
    }
    return ['case', ['all', ...tests], 1, faded]
}

function temperatureLabel(filter: WeatherFilter): ExpressionSpecification {
    const temp = metricProperty(filter)
    const tmin = tminProperty(filter.month)
    const tmax = tmaxProperty(filter.month)
    return [
        'case',
        ['has', temp],
        [
            'concat',
            ['get', 'name'],
            '\n',
            formatNumber(temp, 1),
            '°',
            [
                'case',
                ['all', ['has', tmin], ['has', tmax]],
                ['concat', '\n', formatNumber(tmin, 1), '–', formatNumber(tmax, 1), '°'],
                '',
            ],
        ],
        ['get', 'name'],
    ]
}

function simpleMetricLabel(filter: WeatherFilter): ExpressionSpecification {
    const property = metricProperty(filter)
    const unit = metricUnit(filter.metric)
    const digits = metricFractionDigits(filter.metric)
    return [
        'case',
        ['has', property],
        ['concat', ['get', 'name'], '\n', formatNumber(property, digits), unit],
        ['get', 'name'],
    ]
}

function metricLabel(filter: WeatherFilter): ExpressionSpecification {
    return filter.metric === 'temp' ? temperatureLabel(filter) : simpleMetricLabel(filter)
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
    return {
        id: 'countries-fill',
        type: 'fill' as const,
        'source-layer': 'data',
        paint: {
            'fill-color': metricColor(filter),
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
            'text-field': metricLabel(filter),
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
    return {
        id: 'provinces-fill',
        type: 'fill' as const,
        paint: {
            'fill-color': metricColor(filter),
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
            'text-field': metricLabel(filter),
            'text-font': FONT,
            'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 5, 13, 8, 16],
            'text-line-height': 1.15,
            'text-max-width': 8,
            'text-anchor': 'center' as const,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
        },
        paint: {
            ...labelPaint,
            'text-opacity': matchOpacity(filter, FADED_LABEL),
        },
    } satisfies LayerProps
}