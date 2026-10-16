import json
import math
import time
import logging
from pathlib import Path
from collections import defaultdict

import requests
import unicodedata
from shapely.geometry import shape, Point
from shapely.prepared import prep

# ============ Настройки ============
COUNTRIES_DIR = Path("public/countries")
REGIONS_DIR = Path("public/regions-by-mounts")
LOG_PATH = Path("nasa_power.log")

START_YEAR = 2005
END_YEAR = 2024

CSI_THRESHOLD = 0.65

# Безопасные задержки
REQUEST_DELAY = 2.0          # между обычными запросами
RETRY_DELAY_429 = 90.0       # если получили 429 — ждём 1.5 минуты
RETRY_DELAY_503 = 30.0       # если 503 — ждём 30 сек
MAX_RETRIES = 5

# Флаги
SKIP_ALREADY_DONE = True     # пропускать провинции с sunny_days_year

NAME_FIELDS = ["shapeName", "name", "NAME", "NAME_1"]
SHAPE_TYPE_FILTER = "ADM1"


# ---------- Логирование ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


# ---------- Утилиты ----------
def normalize(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return " ".join(name.lower().split())


def geometry_centroid_lat_lon(geometry: dict):
    coords = []

    def collect(g):
        t = g.get("type")
        if t == "Polygon":
            for ring in g["coordinates"]:
                coords.extend(ring)
        elif t == "MultiPolygon":
            for polygon in g["coordinates"]:
                for ring in polygon:
                    coords.extend(ring)

    collect(geometry)
    if not coords:
        return None, None
    lats = [c[1] for c in coords]
    lons = [c[0] for c in coords]
    return sum(lats) / len(lats), sum(lons) / len(lons)


def polygon_area_km2(geometry: dict) -> float:
    coords = []

    def collect(g):
        t = g.get("type")
        if t == "Polygon":
            for ring in g["coordinates"]:
                coords.extend(ring)
        elif t == "MultiPolygon":
            for polygon in g["coordinates"]:
                for ring in polygon:
                    coords.extend(ring)

    collect(geometry)
    if not coords:
        return 0.0

    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    dlat = max(lats) - min(lats)
    dlon = max(lons) - min(lons)
    mid_lat = (max(lats) + min(lats)) / 2

    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.0 * math.cos(math.radians(mid_lat))

    return abs(dlat * km_per_deg_lat * dlon * km_per_deg_lon)


def points_count_for_area(area_km2: float) -> int:
    if area_km2 < 10_000:
        return 1
    if area_km2 < 50_000:
        return 2
    if area_km2 < 200_000:
        return 3
    if area_km2 < 500_000:
        return 5
    return 8


def generate_sample_points(geometry: dict, n: int) -> list:
    if n <= 1:
        lat, lon = geometry_centroid_lat_lon(geometry)
        return [(lat, lon)] if lat is not None else []

    try:
        geom = shape(geometry)
    except Exception as e:
        log.warning(f"shapely не смог разобрать геометрию: {e}")
        lat, lon = geometry_centroid_lat_lon(geometry)
        return [(lat, lon)] if lat is not None else []

    minx, miny, maxx, maxy = geom.bounds
    side = max(2, int(math.ceil(math.sqrt(n))))
    prepared = prep(geom)

    for _ in range(6):
        xs = [minx + (maxx - minx) * (i + 0.5) / side for i in range(side)]
        ys = [miny + (maxy - miny) * (j + 0.5) / side for j in range(side)]

        candidates = []
        for x in xs:
            for y in ys:
                if prepared.contains(Point(x, y)):
                    candidates.append((y, x))

        if len(candidates) >= n:
            step = len(candidates) / n
            return [candidates[int(i * step)] for i in range(n)]

        side += 1

    if candidates:
        return candidates[:n]

    lat, lon = geometry_centroid_lat_lon(geometry)
    return [(lat, lon)] if lat is not None else []


# ---------- NASA POWER с retry ----------
def fetch_daily_data(lat: float, lon: float, start_year: int, end_year: int) -> dict:
    params = "ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN"
    url = (
        f"https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters={params}"
        f"&community=RE"
        f"&longitude={lon}&latitude={lat}"
        f"&start={start_year}0101&end={end_year}1231"
        f"&format=JSON"
    )

    last_exc = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=180)

            if resp.status_code == 429:
                log.warning(f"    429 Too Many Requests, ждём {RETRY_DELAY_429} сек")
                time.sleep(RETRY_DELAY_429)
                continue

            if resp.status_code == 503:
                log.warning(f"    503 Service Unavailable, ждём {RETRY_DELAY_503} сек")
                time.sleep(RETRY_DELAY_503)
                continue

            resp.raise_for_status()
            data = resp.json()
            break

        except requests.exceptions.Timeout as e:
            last_exc = e
            wait = 10 * attempt
            log.warning(f"    таймаут (попытка {attempt}), ждём {wait} сек")
            time.sleep(wait)
        except requests.exceptions.RequestException as e:
            last_exc = e
            wait = 5 * attempt
            log.warning(f"    ошибка запроса: {e}, ждём {wait} сек")
            time.sleep(wait)
    else:
        raise RuntimeError(f"Не удалось получить данные после {MAX_RETRIES} попыток: {last_exc}")

    params_data = data["properties"]["parameter"]
    allsky = params_data.get("ALLSKY_SFC_SW_DWN", {})
    clrsky = params_data.get("CLRSKY_SFC_SW_DWN", {})

    result = {}
    for date_key, allsky_val in allsky.items():
        clrsky_val = clrsky.get(date_key)
        if allsky_val is None or clrsky_val is None:
            continue
        if allsky_val == -999.0 or clrsky_val == -999.0:
            continue
        if clrsky_val <= 0:
            continue
        result[date_key] = {"allsky": allsky_val, "clrsky": clrsky_val}

    return result


def count_sunny_days(daily_data: dict):
    monthly_counts = defaultdict(lambda: defaultdict(int))
    yearly_counts = defaultdict(int)

    for date_key, vals in daily_data.items():
        year = int(date_key[:4])
        month = int(date_key[4:6])
        csi = vals["allsky"] / vals["clrsky"]
        if csi >= CSI_THRESHOLD:
            monthly_counts[year][month] += 1
            yearly_counts[year] += 1

    monthly_avg = {}
    for month in range(1, 13):
        counts = [monthly_counts[y][month] for y in range(START_YEAR, END_YEAR + 1)]
        monthly_avg[str(month)] = round(sum(counts) / len(counts), 1) if counts else 0.0

    yearly_avg = (
        sum(yearly_counts.values()) / len(yearly_counts)
        if yearly_counts else 0.0
    )
    return monthly_avg, round(yearly_avg, 1)


def average_sunny_days(points: list) -> tuple:
    monthly_acc = defaultdict(list)
    yearly_acc = []

    for i, (lat, lon) in enumerate(points, 1):
        log.info(f"      точка {i}/{len(points)} ({lat:.3f}, {lon:.3f})")
        try:
            daily = fetch_daily_data(lat, lon, START_YEAR, END_YEAR)
        except Exception as e:
            log.error(f"      точка не удалась: {e}")
            continue

        monthly, yearly = count_sunny_days(daily)
        for month, count in monthly.items():
            monthly_acc[month].append(count)
        yearly_acc.append(yearly)

        time.sleep(REQUEST_DELAY)

    if not monthly_acc:
        return {str(m): 0.0 for m in range(1, 13)}, 0.0

    monthly_avg = {
        month: round(sum(vals) / len(vals), 1)
        for month, vals in monthly_acc.items()
    }
    yearly_avg = round(sum(yearly_acc) / len(yearly_acc), 1) if yearly_acc else 0.0
    return monthly_avg, yearly_avg


# ---------- Основная логика ----------
def build_name_to_geom(geojson_path: Path) -> dict:
    with open(geojson_path, "r", encoding="utf-8") as f:
        gj = json.load(f)

    result = {}
    for feature in gj.get("features", []):
        props = feature.get("properties", {})
        if SHAPE_TYPE_FILTER and props.get("shapeType") != SHAPE_TYPE_FILTER:
            continue

        name = None
        for field in NAME_FIELDS:
            if field in props and props[field]:
                name = str(props[field]).strip()
                break
        if name is None:
            continue

        geom = feature.get("geometry", {})
        if geom:
            result[normalize(name)] = geom

    return result


def process_country(iso3: str) -> None:
    geojson_path = None
    for ext in (".geojson", ".json"):
        p = COUNTRIES_DIR / f"{iso3}{ext}"
        if p.exists():
            geojson_path = p
            break

    regions_path = REGIONS_DIR / f"{iso3}.json"
    if geojson_path is None or not regions_path.exists():
        log.info(f"  {iso3}: пропуск (нет файлов)")
        return

    name_to_geom = build_name_to_geom(geojson_path)
    if not name_to_geom:
        log.warning(f"  {iso3}: пустой словарь геометрий")
        return

    with open(regions_path, "r", encoding="utf-8") as f:
        regions = json.load(f)

    updated = 0
    skipped = 0
    failed = []

    for state_name, data in regions.items():
        if not isinstance(data, dict):
            continue

        # Пропуск уже обработанных
        if SKIP_ALREADY_DONE and "sunny_days_year" in data:
            skipped += 1
            continue

        geom = name_to_geom.get(normalize(state_name))
        if geom is None:
            failed.append(state_name)
            log.warning(f"    {state_name}: геометрия не найдена")
            continue

        area = polygon_area_km2(geom)
        n_points = points_count_for_area(area)
        points = generate_sample_points(geom, n_points)

        log.info(f"    {state_name}: площадь ~{area:.0f} км², точек {len(points)}")

        try:
            monthly, yearly = average_sunny_days(points)
        except Exception as e:
            log.error(f"    {state_name}: ошибка — {e}")
            failed.append(state_name)
            continue

        for month, count in monthly.items():
            if month in data and isinstance(data[month], dict):
                data[month]["sunny_days"] = count

        data["sunny_days_year"] = yearly
        updated += 1

        # Сохраняем после каждой провинции, чтобы не потерять прогресс
        with open(regions_path, "w", encoding="utf-8") as f:
            json.dump(regions, f, ensure_ascii=False, indent=2)

        log.info(f"    {state_name}: {yearly} солнечных дней в году (сохранено)")

    log.info(f"  {iso3}: обновлено {updated}, пропущено {skipped}, ошибок {len(failed)}")
    if failed:
        log.warning(f"    неудачные: {', '.join(failed[:10])}")


def main():
    files = sorted(COUNTRIES_DIR.glob("*.geojson")) or sorted(COUNTRIES_DIR.glob("*.json"))
    if not files:
        log.error(f"Нет файлов в {COUNTRIES_DIR}")
        return

    log.info(f"Начинаем обработку {len(files)} стран")
    for gj_path in files:
        log.info(f"{gj_path.stem}:")
        process_country(gj_path.stem)

    log.info("Готово.")


if __name__ == "__main__":
    main()