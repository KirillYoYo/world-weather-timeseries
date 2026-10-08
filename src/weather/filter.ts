export type WeatherMetric = 'temp' | 'prec' | 'wind' | 'srad'

export type WeatherFilter = {
    metric: WeatherMetric
    month: number | null
    min: number | null
    max: number | null
}

export const DEFAULT_FILTER: WeatherFilter = {
    metric: 'temp',
    month: null,
    min: null,
    max: null,
}

export const METRICS: { value: WeatherMetric; label: string }[] = [
    { value: 'temp', label: 'Температура' },
    { value: 'prec', label: 'Осадки' },
    { value: 'wind', label: 'Ветер' },
    { value: 'srad', label: 'Солн. радиация' },
]

export const MONTHS: { value: number | null; label: string }[] = [
    { value: null, label: 'За год' },
    { value: 1, label: 'Январь' },
    { value: 2, label: 'Февраль' },
    { value: 3, label: 'Март' },
    { value: 4, label: 'Апрель' },
    { value: 5, label: 'Май' },
    { value: 6, label: 'Июнь' },
    { value: 7, label: 'Июль' },
    { value: 8, label: 'Август' },
    { value: 9, label: 'Сентябрь' },
    { value: 10, label: 'Октябрь' },
    { value: 11, label: 'Ноябрь' },
    { value: 12, label: 'Декабрь' },
]

const PROPERTY_PREFIX: Record<WeatherMetric, { average: string; month: string }> = {
    temp: { average: 'average_temp', month: 't' },
    prec: { average: 'average_prec', month: 'p' },
    wind: { average: 'average_wind', month: 'w' },
    srad: { average: 'average_srad', month: 's' },
}

export function monthTitle(month: number | null): string {
    return MONTHS.find(item => item.value === month)?.label ?? 'За год'
}

export function metricLabel(metric: WeatherMetric): string {
    return METRICS.find(item => item.value === metric)?.label ?? 'Температура'
}

export function metricTitle(filter: WeatherFilter): string {
    if (filter.month == null) {
        if (filter.metric === 'temp') return 'Средняя температура'
        if (filter.metric === 'prec') return 'Средние осадки'
        if (filter.metric === 'wind') return 'Средний ветер'
        return 'Средняя солнечная радиация'
    }
    return `${metricLabel(filter.metric)} · ${monthTitle(filter.month)}`
}

export function metricUnit(metric: WeatherMetric): string {
    if (metric === 'prec') return 'мм'
    if (metric === 'wind') return 'м/с'
    if (metric === 'srad') return 'кДж'
    return '°'
}

export function metricFractionDigits(metric: WeatherMetric): number {
    return metric === 'srad' ? 0 : 1
}

export function metricProperty(filter: Pick<WeatherFilter, 'metric' | 'month'>): string {
    const prefix = PROPERTY_PREFIX[filter.metric]
    return filter.month == null ? prefix.average : `${prefix.month}${filter.month}`
}

export function tminProperty(month: number | null): string {
    return month == null ? 'average_tmin' : `tn${month}`
}

export function tmaxProperty(month: number | null): string {
    return month == null ? 'average_tmax' : `tx${month}`
}

export function filterIsActive(filter: WeatherFilter): boolean {
    return filter.month != null || filter.min != null || filter.max != null || filter.metric !== 'temp'
}

export function valueBounds(filter: WeatherFilter): {
    min: number | null
    max: number | null
} {
    const { min, max } = filter
    if (min != null && max != null && min > max) return { min: max, max: min }
    return { min, max }
}

export type LegendScale = {
    className: string
    ticks: string[]
}

export function legendScale(metric: WeatherMetric): LegendScale {
    if (metric === 'prec') {
        return {
            className: 'weather-scale weather-scale-prec',
            ticks: ['0', '50', '100', '200', '400 мм'],
        }
    }
    if (metric === 'wind') {
        return {
            className: 'weather-scale weather-scale-wind',
            ticks: ['0', '2', '4', '6', '8 м/с'],
        }
    }
    if (metric === 'srad') {
        return {
            className: 'weather-scale weather-scale-srad',
            ticks: ['0', '10k', '20k', '30k', '40k'],
        }
    }
    return {
        className: 'weather-scale',
        ticks: ['-20°', '0°', '15°', '30°', '40°'],
    }
}
