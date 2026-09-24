import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { centroid } from '@turf/turf'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = path.resolve(__dirname, '../')

const COUNTRIES_DIR = path.join(ROOT, 'public/countries')
const OUTPUT_DIR = path.join(ROOT, 'public/weather/nasa')

const CONCURRENCY = 4

const PARAMETERS = ['T2M', 'T2M_MIN', 'T2M_MAX', 'WS2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN'].join(
    ','
)

const MONTHS = {
    '01': 'jan',
    '02': 'feb',
    '03': 'mar',
    '04': 'apr',
    '05': 'may',
    '06': 'jun',
    '07': 'jul',
    '08': 'aug',
    '09': 'sep',
    10: 'oct',
    11: 'nov',
    12: 'dec',
}

async function main() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })

    const files = await fs.readdir(COUNTRIES_DIR)

    const countryFiles = files.filter(file => file.endsWith('.json')).sort()

    console.log(`Found ${countryFiles.length} countries`)

    const queue = [...countryFiles]

    async function worker(workerId) {
        while (queue.length > 0) {
            const file = queue.shift()

            if (!file) {
                return
            }

            try {
                await processCountry(file)

                console.log(`[worker ${workerId}] ✓ ${file}`)
            } catch (error) {
                console.error(`[worker ${workerId}] ✗ ${file}`, error)
            }
        }
    }

    const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))

    await Promise.all(workers)

    console.log('Done')
}

async function processCountry(file) {
    const countryCode = path.basename(file, '.json')

    const inputPath = path.join(COUNTRIES_DIR, file)
    const outputPath = path.join(OUTPUT_DIR, `${countryCode}.json`)

    /*
     * Если файл уже существует — пропускаем.
     *
     * Это позволит остановить скрипт и потом
     * спокойно запустить снова.
     */
    try {
        await fs.access(outputPath)

        console.log(`Skip ${countryCode}: already exists`)

        return
    } catch {
        // file doesn't exist — continue
    }

    const raw = await fs.readFile(inputPath, 'utf8')
    const geojson = JSON.parse(raw)

    const result = {
        country: countryCode,
        source: 'NASA POWER',
        provinces: {},
    }

    for (const feature of geojson.features) {
        const props = feature.properties

        const provinceId = props.shapeID
        const provinceName = props.shapeName

        if (!provinceId) {
            console.warn(`${countryCode}: province without shapeID`)

            continue
        }

        const center = centroid(feature)

        const [lon, lat] = center.geometry.coordinates

        console.log(`  ${countryCode} / ${provinceName} (${lat}, ${lon})`)

        const weather = await fetchNASA(lat, lon)

        result.provinces[provinceId] = {
            name: provinceName,
            lat,
            lon,
            months: weather,
        }

        /*
         * Небольшая задержка между запросами.
         */
        await sleep(150)
    }

    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8')
}

async function fetchNASA(lat, lon) {
    const url = new URL('https://power.larc.nasa.gov/api/temporal/climatology/point')

    url.searchParams.set('parameters', PARAMETERS)
    url.searchParams.set('community', 'AG')
    url.searchParams.set('longitude', lon.toFixed(6))
    url.searchParams.set('latitude', lat.toFixed(6))
    url.searchParams.set('format', 'JSON')

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`NASA HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    return normalizeNASA(data)
}

function normalizeNASA(data) {
    const properties = data?.properties?.parameter

    if (!properties) {
        throw new Error('Unexpected NASA POWER response')
    }

    const result = {}

    for (const [monthNumber, monthName] of Object.entries(MONTHS)) {
        result[monthName] = {
            tempAvg: getValue(properties.T2M, monthNumber),
            tempMin: getValue(properties.T2M_MIN, monthNumber),
            tempMax: getValue(properties.T2M_MAX, monthNumber),

            windSpeed: getValue(properties.WS2M, monthNumber),

            precipitation: getValue(properties.PRECTOTCORR, monthNumber),

            solarRadiation: getValue(properties.ALLSKY_SFC_SW_DWN, monthNumber),
        }
    }

    return result
}

function getValue(parameter, month) {
    if (!parameter) {
        return null
    }

    const value = parameter[month]

    if (value === undefined || value === null || Number.isNaN(Number(value))) {
        return null
    }

    return Number(value)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})