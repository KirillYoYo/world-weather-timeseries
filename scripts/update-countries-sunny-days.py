import json
import math
import unicodedata
from pathlib import Path


# ============ Настройки ============
ALL_DATA_PATH = Path("public/all_countries_data.json")
REGIONS_DIR = Path("public/regions-by-mounts")
COUNTRIES_DIR = Path("public/countries")

# Откуда берём в регионарных файлах
SRC_MONTHLY_KEY = "sunny_days_real"
SRC_YEARLY_KEY = "sunny_days_real_year"

# Куда пишем в all_countries_data.json
DST_MONTHLY_KEY = "sunny_days"
DST_YEARLY_KEY = "sunny_days_year"

NAME_FIELDS = ["shapeName", "name", "NAME", "NAME_1"]
SHAPE_TYPE_FILTER = "ADM1"


def normalize(name: str) -> str:
    name = unicodedata.normalize("NFKD", str(name))
    name = "".join(c for c in name if not unicodedata.combining(c))
    return " ".join(name.lower().split())


def polygon_area_km2(geometry: dict) -> float:
    """Грубая площадь по bounding box в км²."""
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


def load_area_index(iso3: str) -> dict:
    """
    Возвращает {нормализованное_название_провинции: площадь_км²}.
    Ищет GeoJSON с любым расширением.
    """
    geojson_path = None
    for ext in (".geojson", ".json"):
        p = COUNTRIES_DIR / f"{iso3}{ext}"
        if p.exists():
            geojson_path = p
            break

    if geojson_path is None:
        return {}

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
        area = polygon_area_km2(geom)
        result[normalize(name)] = area

    return result


def weighted_mean(values_and_weights: list) -> float | None:
    """Взвешенное среднее: [(значение, вес), ...]."""
    total_w = sum(w for v, w in values_and_weights if v is not None and w > 0)
    if total_w <= 0:
        return None
    total_v = sum(v * w for v, w in values_and_weights if v is not None and w > 0)
    return total_v / total_w


def process_country(iso3: str, country_data: dict) -> dict | None:
    """
    Считает взвешенные по площади средние для страны.
    Возвращает {"yearly": ..., "monthly": {...}} или None.
    """
    regions_path = REGIONS_DIR / f"{iso3}.json"
    if not regions_path.exists():
        return None

    with open(regions_path, "r", encoding="utf-8") as f:
        regions = json.load(f)

    area_index = load_area_index(iso3)
    if not area_index:
        return None

    # Собираем (значение, вес) для года и каждого месяца
    yearly_pairs = []
    monthly_pairs = {str(m): [] for m in range(1, 13)}

    for state_name, state_data in regions.items():
        if not isinstance(state_data, dict):
            continue

        area = area_index.get(normalize(state_name))
        if area is None or area <= 0:
            continue

        yearly_val = state_data.get(SRC_YEARLY_KEY)
        if yearly_val is not None:
            yearly_pairs.append((yearly_val, area))

        for month in range(1, 13):
            key = str(month)
            if key in state_data and isinstance(state_data[key], dict):
                val = state_data[key].get(SRC_MONTHLY_KEY)
                if val is not None:
                    monthly_pairs[key].append((val, area))

    result = {}

    yearly = weighted_mean(yearly_pairs)
    if yearly is not None:
        result["yearly"] = round(yearly, 1)

    monthly_result = {}
    for month, pairs in monthly_pairs.items():
        val = weighted_mean(pairs)
        if val is not None:
            monthly_result[month] = round(val, 1)

    if monthly_result:
        result["monthly"] = monthly_result

    return result if result else None


def main():
    with open(ALL_DATA_PATH, "r", encoding="utf-8") as f:
        all_data = json.load(f)

    updated = 0
    skipped = []
    no_data = []

    for iso3, country_data in all_data.items():
        if not isinstance(country_data, dict):
            continue

        result = process_country(iso3, country_data)
        if result is None:
            no_data.append(iso3)
            continue

        # Записываем годовое значение
        if "yearly" in result:
            country_data[DST_YEARLY_KEY] = result["yearly"]
            updated += 1
        else:
            skipped.append(f"{iso3} (нет yearly)")

        # Записываем месячные значения
        if "monthly" in result:
            for month, val in result["monthly"].items():
                if month in country_data and isinstance(country_data[month], dict):
                    country_data[month][DST_MONTHLY_KEY] = val
        else:
            skipped.append(f"{iso3} (нет monthly)")

    with open(ALL_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"Обновлено стран: {updated}")
    if no_data:
        print(f"Нет данных: {len(no_data)} — {', '.join(no_data[:20])}"
              + (" ..." if len(no_data) > 20 else ""))
    if skipped:
        print(f"Пропущено: {len(skipped)} — {', '.join(skipped[:20])}"
              + (" ..." if len(skipped) > 20 else ""))
    print(f"\nГотово: {ALL_DATA_PATH}")


if __name__ == "__main__":
    main()