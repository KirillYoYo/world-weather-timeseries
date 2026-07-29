import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { CountryFeature, GeoJSONData } from '@/app/types'
import { MapControls } from '@/app/mainPage/MapControls'

interface WorldMapProps {
    // position: { x: number; y: number }
    // worldWidth?: number
    // worldHeight?: number
    // getColorByContinent: (continent: string) => string
    // getHoverColor: () => string
    // onCountryClick: (countryName: string) => void
}

export const WorldMap: React.FC<WorldMapProps> = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoveredCountry, setHoveredCountry] = useState<null | CountryFeature>(null)
    const [selectedCountry, setSelectedCountry] = useState<null | CountryFeature>(null)
    const [screenD, setScreenD] = useState([0, 0])

    // Состояния для трансформации (зум и панорамирование)
    const [transform, setTransform] = useState({
        k: 1, // масштаб
        x: 0, // смещение по X
        y: 0, // смещение по Y
    })

    // Храним данные и проекцию в ref, чтобы не пересоздавать при каждом рендере
    const geoDataRef = useRef<GeoJSONData | null>(null)
    const projectionRef = useRef<d3.GeoProjection | null>(null)
    // const pathRef = useRef(null)

    // Загрузка данных
    useEffect(() => {
        async function fetchData() {
            const response = await fetch('/world_110.json')
            return response.json()
        }
        fetchData().then(res => {
            geoDataRef.current = res
            drawMap()
        })
        setScreenD([window.innerWidth, window.innerHeight * 0.8])
    }, [])

    // Функция рисования карты
    const drawMap = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) {
            return
        }
        const ctx = canvas.getContext('2d')
        const width = canvas.width
        const height = canvas.height

        if (!geoDataRef.current) return
        if (!ctx) return

        // Очищаем холст
        ctx.clearRect(0, 0, width, height)

        // Создаем проекцию с учетом текущего zoom/pan
        const projection = d3
            .geoMercator()
            .fitSize([width, height], geoDataRef.current)
            .translate([width / 2 + transform.x, height / 2 + transform.y])
            .scale(transform.k * (width / 2 / Math.PI)) // Приблизительный расчет

        projectionRef.current = projection

        const path = d3.geoPath(projection, ctx)

        // Рисуем страны
        const countries = geoDataRef.current

        // Сначала рисуем все страны (заливка)
        ctx.beginPath()
        path(countries)
        ctx.fillStyle = '#69b3a2'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Если есть выделенная страна — перерисовываем её поверх
        if (selectedCountry) {
            ctx.beginPath()
            path(selectedCountry)
            ctx.fillStyle = '#ff6b6b'
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.stroke()
        }
    }, [transform, selectedCountry])

    // Перерисовка при изменении transform
    useEffect(() => {
        drawMap()
    }, [transform, drawMap])

    // --- Обработчики взаимодействий ---

    // Панорамирование
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const startX = e.clientX
        const startY = e.clientY
        const startTransform = { ...transform }

        const onMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - startX
            const dy = e.clientY - startY
            setTransform({
                ...startTransform,
                x: startTransform.x + dx,
                y: startTransform.y + dy,
            })
        }

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
    }

    // Зум колесиком
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setTransform(prev => ({
            ...prev,
            k: Math.min(Math.max(prev.k * delta, 0.5), 10), // Ограничиваем зум
        }))
    }

    // Определение страны под курсором (для кликов)
    const getCountryAtPosition = (x: number, y: number) => {
        if (!geoDataRef.current || !projectionRef.current) return null

        // 1. Преобразуем пиксели Canvas в географические координаты
        const coords = projectionRef.current.invert([x, y])
        if (!coords) return null

        // 2. Используем d3.geoContains для проверки каждой страны
        for (const country of geoDataRef.current.features) {
            // d3.geoContains(feature, [longitude, latitude])
            if (d3.geoContains(country, coords)) {
                return country
            }
        }
        return null
    }

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const country = getCountryAtPosition(x, y)
        if (country) {
            setSelectedCountry(country)
            console.log('Clicked country:', country.properties.ADM0_A3)
        } else {
            setSelectedCountry(null) // Снимаем выделение при клике на пустое место
        }
    }

    const resetView = () => {
        setTransform({
            k: 1,
            x: 0,
            y: 0,
        })
    }

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transformOrigin: '0 0',
                willChange: 'transform',
            }}
        >
            <MapControls scale={transform.k} onReset={resetView} />
            <canvas
                ref={canvasRef}
                width={screenD[0]}
                height={screenD[1]}
                style={{
                    width: '100%',
                    height: '100%',
                    cursor: 'grab',
                    border: '1px solid #ccc',
                }}
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
                onClick={handleClick}
                onMouseMove={e => {
                    // Для hover эффекта (можно добавить)
                    const rect = canvasRef.current!.getBoundingClientRect()
                    const x = e.clientX - rect.left
                    const y = e.clientY - rect.top
                    const country = getCountryAtPosition(x, y)
                    setHoveredCountry(country)
                    canvasRef.current!.style.cursor = country ? 'pointer' : 'grab'
                }}
            />
            {hoveredCountry && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 20,
                        left: 20,
                        background: 'white',
                        padding: 10,
                    }}
                >
                    {hoveredCountry.properties.name}
                </div>
            )}
        </div>
    )
}