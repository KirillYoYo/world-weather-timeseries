import { useEffect, useState, type RefObject } from 'react'
import type { GeoJSONVTTile } from '@maplibre/geojson-vt'
import { addProtocol, removeProtocol } from 'maplibre-gl'
import { fromGeojsonVt } from '@maplibre/vt-pbf'
import type { MapRef } from 'react-map-gl/maplibre'
import type { GeoJSONVT } from 'geojson-vt'

const PROTOCOL = 'geojsonvt'

export function useGeojsonVtProtocol(
    tileIndex: GeoJSONVT | null,
    mapRef: RefObject<MapRef | null>,
    mapReady: boolean
): boolean {
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        const map = mapRef.current?.getMap()
        if (!mapReady || !map || !tileIndex) {
            setIsReady(false)
            return
        }

        try {
            removeProtocol(PROTOCOL)
        } catch {
            // протокол ещё не зарегистрирован
        }

        addProtocol(PROTOCOL, async params => {
            const match = params.url.match(/geojsonvt:\/\/(\d+)\/(\d+)\/(\d+)/)
            if (!match) return { data: new ArrayBuffer(0) }

            const tile = tileIndex.getTile(Number(match[1]), Number(match[2]), Number(match[3]))
            if (!tile?.features?.length) return { data: new ArrayBuffer(0) }

            try {
                const buffer = fromGeojsonVt({ data: tile as GeoJSONVTTile }, { version: 2, extent: 4096 })
                return {
                    data: buffer.buffer.slice(
                        buffer.byteOffset,
                        buffer.byteOffset + buffer.byteLength
                    ),
                }
            } catch (error) {
                console.error('fromGeojsonVt error:', error)
                return { data: new ArrayBuffer(0) }
            }
        })

        setIsReady(true)

        return () => {
            try {
                removeProtocol(PROTOCOL)
            } catch {
                // протокол уже снят
            }
            setIsReady(false)
        }
    }, [tileIndex, mapRef, mapReady])

    return isReady
}
