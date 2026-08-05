import { useEffect, useState, RefObject } from 'react'
import * as maplibregl from 'maplibre-gl'
import { fromGeojsonVt } from '@maplibre/vt-pbf'
import type { MapRef } from 'react-map-gl/maplibre'

export function useGeojsonVtProtocol(tileIndex: any, mapRef: RefObject<MapRef | null>): boolean {
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        const map = mapRef.current?.getMap()
        if (!map || !tileIndex) {
            setIsReady(false)
            return
        }

        // Удаляем предыдущую регистрацию протокола (если есть)
        try {
            // @ts-ignore
            map.removeProtocol('geojsonvt')
        } catch (_) {
            // Протокол мог быть не зарегистрирован – игнорируем
        }

        // Регистрируем новый протокол
        maplibregl.addProtocol('geojsonvt', async params => {
            const match = params.url.match(/geojsonvt:\/\/(\d+)\/(\d+)\/(\d+)/)
            if (!match) {
                return { data: new ArrayBuffer(0) }
            }

            const z = parseInt(match[1], 10)
            const x = parseInt(match[2], 10)
            const y = parseInt(match[3], 10)

            const tile = tileIndex.getTile(z, x, y)

            if (!tile || !tile.features || tile.features.length === 0) {
                return { data: new ArrayBuffer(0) }
            }

            try {
                const buff = fromGeojsonVt({ data: tile })
                const arrayBuffer = buff.buffer.slice(
                    buff.byteOffset,
                    buff.byteOffset + buff.byteLength
                )
                return { data: arrayBuffer }
            } catch (err) {
                console.error('fromGeojsonVt error:', err)
                return { data: new ArrayBuffer(0) }
            }
        })

        setIsReady(true)

        // Очистка при размонтировании или изменении зависимостей
        return () => {
            try {
                // @ts-ignore
                map.removeProtocol('geojsonvt')
            } catch (_) {
                // Игнорируем ошибку при удалении
            }
            setIsReady(false)
        }
    }, [tileIndex, mapRef])

    return isReady
}