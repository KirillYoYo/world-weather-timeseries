import React from 'react'

import {
    DEFAULT_FILTER,
    filterIsActive,
    METRICS,
    MONTHS,
    metricLabel,
    metricUnit,
    type WeatherFilter,
    type WeatherMetric,
} from './filter'

type FilterBarProps = {
    value: WeatherFilter
    onChange: (next: WeatherFilter) => void
}

function parseBound(raw: string): number | null {
    if (raw.trim() === '') return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
}

export default function FilterBar({ value, onChange }: FilterBarProps) {
    const rangeActive = value.min != null || value.max != null
    const unit = metricUnit(value.metric)
    const boundLabel = metricLabel(value.metric)

    return (
        <form className="weather-menu" onSubmit={event => event.preventDefault()}>
            <label>
                Показатель
                <select
                    value={value.metric}
                    onChange={event =>
                        onChange({
                            ...value,
                            metric: event.target.value as WeatherMetric,
                            min: null,
                            max: null,
                        })
                    }
                >
                    {METRICS.map(metric => (
                        <option key={metric.value} value={metric.value}>
                            {metric.label}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                Месяц
                <select
                    value={value.month ?? ''}
                    onChange={event =>
                        onChange({
                            ...value,
                            month: event.target.value === '' ? null : Number(event.target.value),
                        })
                    }
                >
                    {MONTHS.map(month => (
                        <option key={month.label} value={month.value ?? ''}>
                            {month.label}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                {boundLabel} от
                <input
                    type="number"
                    step="1"
                    value={value.min ?? ''}
                    aria-label={`${boundLabel} от`}
                    onChange={event => onChange({ ...value, min: parseBound(event.target.value) })}
                />
                {unit}
            </label>
            <label>
                до
                <input
                    type="number"
                    step="1"
                    value={value.max ?? ''}
                    aria-label={`${boundLabel} до`}
                    onChange={event => onChange({ ...value, max: parseBound(event.target.value) })}
                />
                {unit}
            </label>
            {rangeActive && <span className="weather-menu-note">Вне диапазона — бледнее</span>}
            {filterIsActive(value) && (
                <button type="button" onClick={() => onChange(DEFAULT_FILTER)}>
                    Сбросить
                </button>
            )}
        </form>
    )
}
