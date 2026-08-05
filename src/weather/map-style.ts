import type { LayerProps } from 'react-map-gl/maplibre'

// For more information on data-driven styles, see https://maplibre.org/maplibre-style-spec/expressions/
export const dataLayer: LayerProps = {
    id: 'data',
    type: 'fill',
    paint: {
        'fill-color': {
            type: 'interval',
            property: 'percentile',
            stops: [
                [0, '#3288bd'],
                [1, '#66c2a5'],
                [2, '#abdda4'],
                [3, '#e6f598'],
                [4, '#ffffbf'],
                [5, '#fee08b'],
                [6, '#fdae61'],
                [7, '#f46d43'],
                [8, '#d53e4f'],
            ],
        },
        'fill-opacity': 0.8,
    },
}

export const labelLayer: LayerProps = {
    id: 'country-labels',
    type: 'symbol',
    source: 'data', // название источника – должно совпадать с id вашего <Source> (если не задан, подойдёт)
    'source-layer': 'data', // должно совпадать с именем слоя в fromGeojsonVt (у вас 'data')
    layout: {
        'text-field': ['get', 'name'], // поле с названием страны (можно заменить на 'name_long' или 'formal_en')
        'text-size': 12,
        'text-font': ['Open Sans Regular'],
        'text-transform': 'uppercase', // опционально
        'text-offset': [0, 0],
        'text-anchor': 'center',
        // показывать названия только на зумах от 3 (можно настроить)
    },
    paint: {
        'text-color': '#222',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.5,
    },
}