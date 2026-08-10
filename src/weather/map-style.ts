import type { LayerProps } from 'react-map-gl/maplibre'

// For more information on data-driven styles, see https://maplibre.org/maplibre-style-spec/expressions/
export const dataLayer: LayerProps = {
    id: 'data-layer',
    'source-layer': 'data',
    type: 'fill',
    paint: {
        'fill-color': 'rgba(234, 241, 233, 0.5)',
        'fill-opacity': 1,

        'fill-translate': [0, 0],
        'fill-translate-anchor': 'map',
        'fill-antialias': true,
    },
}

export const borderLayer: LayerProps = {
    id: 'data-border',
    type: 'line',
    'source-layer': 'data',
    paint: {
        // Цвет границ, как у административных границ в Positron
        'line-color': '#ead5d7', // Нежный розовато-серый[reference:8]
        'line-width': 0.5, // Очень тонкая линия[reference:9]
        'line-opacity': 0.8,
    },
}

export const labelLayer: LayerProps = {
    id: 'data',
    type: 'symbol',
    'source-layer': 'data',
    layout: {
        'text-field': ['get', 'sovereignt'],
        'text-size': 12,
        'text-font': ['Open Sans Regular'],
        'text-transform': 'uppercase', // опционально
        'text-offset': [0, 0],
        'text-anchor': 'center',
    },
    // filter: ['==', ['get', 'geounit'], ['get', 'name']],
    // filter: ['!=', ['get', 'type'], 'Dependency'],
    paint: {
        'text-color': '#222',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.5,
    },
}