import json
import math
import unicodedata
from pathlib import Path
from datetime import date

# ============ Настройки ============
COUNTRIES_DIR = Path("public/countries")
REGIONS_DIR = Path("public/regions-by-mounts")

THRESHOLD_W_M2 = 150.0
SRAD_UNITS = "kJ_m2_day"   # "kJ_m2_day" для WorldClim, "kWh_m2_day" для NASA

# Поля, где может лежать название провинции. shapeName — из твоего GeoJSON.
NAME_FIELDS = ["shapeName", "name", "NAME", "NAME_1", "name_ru", "province", "state"]

# Обрабатывать только ADM1 (провинции/штаты). Если у тебя другие уровни — поменяй.
SHAPE_TYPE_FILTER = "ADM1"

DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


# ---------- Астрономия ----------
def solar_declination(day_of_year: int) -> float:
    return 23.45 * math.sin(math.radians(360 * (284 + day_of_year) / 365))


def day_length_hours(latitude_deg: float, day_of_year: int) -> float:
    lat_rad = math.radians(latitude_deg)
    dec_rad = math.radians(solar_declination(day_of_year))
    cos_omega = -math.tan(lat_rad) * math.tan(dec_rad)
    if cos_omega >= 1:
        return 0.0
    if cos_omega <= -1:
        return 24.0
    omega = math.acos(cos_omega)
    return 2 * math.degrees(omega) / 15.0


def mid_month_day(month: int) -> int:
    return date(2023, month, 15).timetuple().tm_yday


# ---------- Геометрия ----------
def geometry_centroid_lat(geometry: dict) -> float | None:
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
        return None
    lats = [c[1] for c in coords]
    return sum(lats) / len(lats)


# ---------- Нормализация названий ----------
def normalize(name: str) -> str:
    """Убирает диакритику, лишние пробелы, приводит к нижнему регистру."""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return " ".join(name.lower().split())


# ---------- Радиация ----------
def srad_to_w_m2(srad: float) -> float:
    if SRAD_UNITS == "kJ_m2_day":
        return srad * 1000.0 / 86400.0
    elif SRAD_UNITS == "kWh_m2_day":
        return srad * 1000.0 / 24.0
    raise ValueError(f"Неизвестные единицы srad: {SRAD_UNITS}")


def estimate_sunny_days(srad: float, latitude: float, month: int) -> float:
    if srad is None or srad <= 0:
        return 0.0
    srad_avg = srad_to_w_m2(srad)
    dl = day_length_hours(latitude, mid_month_day(month))
    if dl <= 0:
        return 0.0
    srad_day = srad_avg * (24.0 / dl)
    ratio = min(srad_day / THRESHOLD_W_M2, 1.0)
    return round(DAYS_IN_MONTH[month - 1] * ratio, 2)


# ---------- Основная логика ----------
def build_name_to_lat(geojson_path: Path) -> dict:
    """Возвращает {нормализованное_название: широта}."""
    with open(geojson_path, "r", encoding="utf-8") as f:
        gj = json.load(f)

    result = {}
    for feature in gj.get("features", []):
        props = feature.get("properties", {})

        # Фильтр по типу (ADM1)
        if SHAPE_TYPE_FILTER and props.get("shapeType") != SHAPE_TYPE_FILTER:
            continue

        name = None
        for field in NAME_FIELDS:
            if field in props and props[field]:
                name = str(props[field]).strip()
                break
        if name is None:
            continue

        lat = geometry_centroid_lat(feature.get("geometry", {}))
        if lat is None:
            continue

        result[normalize(name)] = lat

    return result


def find_lat_for_state(state_name: str, name_to_lat: dict) -> float | None:
    norm = normalize(state_name)

    # 1. Точное совпадение после нормализации
    if norm in name_to_lat:
        return name_to_lat[norm]

    # 2. Мягкое совпадение по подстроке
    for k, v in name_to_lat.items():
        if norm in k or k in norm:
            return v

    return None


def process_country(iso3: str) -> None:
    # Пробуем оба расширения
    geojson_path = None
    for ext in (".geojson", ".json"):
        p = COUNTRIES_DIR / f"{iso3}{ext}"
        if p.exists():
            geojson_path = p
            break

    regions_path = REGIONS_DIR / f"{iso3}.json"

    if geojson_path is None:
        print(f"  {iso3}: нет GeoJSON в {COUNTRIES_DIR}")
        return
    if not regions_path.exists():
        print(f"  {iso3}: нет {regions_path.name}")
        return

    name_to_lat = build_name_to_lat(geojson_path)
    if not name_to_lat:
        print(f"  {iso3}: не удалось извлечь названия (проверь shapeType/NAME_FIELDS)")
        return

    with open(regions_path, "r", encoding="utf-8") as f:
        regions = json.load(f)

    updated = 0
    missed = []
    for state_name, data in regions.items():
        if not isinstance(data, dict):
            continue

        lat = find_lat_for_state(state_name, name_to_lat)
        if lat is None:
            missed.append(state_name)
            continue

        total = 0.0
        for month in range(1, 13):
            key = str(month)
            if key not in data or not isinstance(data[key], dict):
                continue
            srad = data[key].get("srad")
            sunny = estimate_sunny_days(srad, lat, month)
            data[key]["sunny_days"] = sunny
            total += sunny

        data["sunny_days_year"] = round(total, 1)
        updated += 1

    with open(regions_path, "w", encoding="utf-8") as f:
        json.dump(regions, f, ensure_ascii=False, indent=2)

    print(f"  {iso3}: обновлено {updated} провинций")
    if missed:
        print(f"    не найдено широт для: {', '.join(missed[:10])}"
              + (" ..." if len(missed) > 10 else ""))


def main():
    geojson_files = sorted(COUNTRIES_DIR.glob("*.geojson"))
    if not geojson_files:
        # На случай, если страны лежат как .json
        geojson_files = sorted(COUNTRIES_DIR.glob("*.json"))

    if not geojson_files:
        print(f"Не найдено файлов стран в {COUNTRIES_DIR}")
        return

    for gj_path in geojson_files:
        iso3 = gj_path.stem
        print(f"{iso3}:")
        process_country(iso3)

    print("\nГотово.")


if __name__ == "__main__":
    main()