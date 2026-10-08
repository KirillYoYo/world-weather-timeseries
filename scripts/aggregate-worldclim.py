import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.mask import mask
from shapely.geometry import shape
from shapely.ops import unary_union


# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

COUNTRIES_DIR = PUBLIC / "countries"
JSON_FILE = PUBLIC / "all_countries_data.json"
REGIONS_DIR = PUBLIC / "regions-by-mounts"

SRAD_DIR = PUBLIC / "wc2.1_10m_srad"
WIND_DIR = PUBLIC / "wc2.1_10m_wind"

TMAX_DIR = PUBLIC / "wc2.1_cruts4.09_10m_tmax_2020-2024"
TMIN_DIR = PUBLIC / "wc2.1_cruts4.09_10m_tmin_2020-2024"


# ============================================================
# HELPERS
# ============================================================

def load_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def get_monthly_files(directory, prefix):
    """
    Например:

    wc2.1_10m_srad_01.tif
    wc2.1_10m_srad_02.tif
    ...
    wc2.1_10m_srad_12.tif
    """

    result = {}

    for month in range(1, 13):
        path = directory / f"{prefix}_{month:02d}.tif"

        if not path.exists():
            raise FileNotFoundError(f"Не найден файл: {path}")

        result[month] = path

    return result


def get_cruts_files(directory, variable):
    """
    Например:

    wc2.1_cruts4.09_10m_tmax_2020-01.tif
    wc2.1_cruts4.09_10m_tmax_2020-02.tif
    ...
    wc2.1_cruts4.09_10m_tmax_2024-12.tif
    """

    result = {}

    for year in range(2020, 2025):
        for month in range(1, 13):
            path = (
                directory
                / f"wc2.1_cruts4.09_10m_{variable}_{year}-{month:02d}.tif"
            )

            if not path.exists():
                raise FileNotFoundError(f"Не найден файл: {path}")

            result[(year, month)] = path

    return result


# ============================================================
# GEOJSON
# ============================================================

def load_country_features(country_code):
    """
    Загружает ADM1 features конкретной страны.
    """

    path = COUNTRIES_DIR / f"{country_code}.json"

    if not path.exists():
        raise FileNotFoundError(f"Не найден GeoJSON: {path}")

    data = load_json(path)

    return data.get("features", [])


def country_geometry(country_code):
    """
    Объединяет все ADM1 полигоны страны.
    Используется для all_countries_data.json.
    """

    features = load_country_features(country_code)

    geometries = [
        shape(feature["geometry"])
        for feature in features
        if feature.get("geometry")
    ]

    if not geometries:
        raise ValueError(f"{country_code}: нет геометрий")

    return unary_union(geometries)


def build_region_index(country_code):
    """
    Создаёт:

        {
            "Ali Sabieh": geometry,
            "Dikhil": geometry,
            ...
        }

    из ADM1 GeoJSON конкретной страны.
    """

    features = load_country_features(country_code)

    result = {}

    for feature in features:
        properties = feature.get("properties", {})
        name = properties.get("shapeName")
        geometry = feature.get("geometry")

        if not name or not geometry:
            continue

        result[name] = shape(geometry)

    return result


# ============================================================
# RASTER
# ============================================================

def raster_mean_for_geometry(raster_path, geometry):
    """
    Среднее значение raster внутри polygon.
    """

    with rasterio.open(raster_path) as src:
        out_image, _ = mask(
            src,
            [geometry],
            crop=True,
            filled=False
        )

        data = out_image[0]

        # masked array -> обычные валидные значения
        values = data.compressed()

        if values.size == 0:
            return None

        values = values.astype(np.float64)

        # Убираем NaN / inf
        values = values[np.isfinite(values)]

        if values.size == 0:
            return None

        return float(values.mean())


def calculate_worldclim_monthly(geometry, files):
    """
    Для WorldClim:
        month -> mean
    """

    result = {}

    for month, path in files.items():
        value = raster_mean_for_geometry(path, geometry)
        result[month] = value

    return result


def calculate_cruts_monthly(geometry, files):
    """
    Для CRU TS:

    2020-01
    2021-01
    2022-01
    2023-01
    2024-01

    -> среднее января

    И так для всех месяцев.
    """

    by_month = {
        month: []
        for month in range(1, 13)
    }

    for (year, month), path in files.items():
        value = raster_mean_for_geometry(path, geometry)

        if value is not None:
            by_month[month].append(value)

    result = {}

    for month in range(1, 13):
        values = by_month[month]

        if not values:
            result[month] = None
        else:
            result[month] = float(np.mean(values))

    return result


def average_monthly(values):
    """
    Среднее из 12 месяцев.
    """

    valid = [
        value
        for value in values.values()
        if value is not None and math.isfinite(value)
    ]

    if not valid:
        return None

    return float(np.mean(valid))


# ============================================================
# RASTER FILES
# ============================================================

print("Ищу TIFF-файлы...")

srad_files = get_monthly_files(
    SRAD_DIR,
    "wc2.1_10m_srad"
)

wind_files = get_monthly_files(
    WIND_DIR,
    "wc2.1_10m_wind"
)

tmax_files = get_cruts_files(
    TMAX_DIR,
    "tmax"
)

tmin_files = get_cruts_files(
    TMIN_DIR,
    "tmin"
)

print("TIFF-файлы найдены.")
print()


# ============================================================
# UPDATE COUNTRY DATA
# ============================================================

print("========================================")
print("COUNTRIES")
print("========================================")

country_data = load_json(JSON_FILE)

backup_path = JSON_FILE.with_suffix(".json.backup")

if not backup_path.exists():
    save_json(backup_path, country_data)
    print(f"Backup создан: {backup_path}")

for country_file in sorted(COUNTRIES_DIR.glob("*.json")):

    country_code = country_file.stem.upper()

    if country_code not in country_data:
        print(f"[SKIP] {country_code}: нет в all_countries_data.json")
        continue

    print(f"[COUNTRY] {country_code}")

    try:
        geometry = country_geometry(country_code)

        srad = calculate_worldclim_monthly(
            geometry,
            srad_files
        )

        wind = calculate_worldclim_monthly(
            geometry,
            wind_files
        )

        tmax = calculate_cruts_monthly(
            geometry,
            tmax_files
        )

        tmin = calculate_cruts_monthly(
            geometry,
            tmin_files
        )

        country = country_data[country_code]

        for month in range(1, 13):
            month_key = str(month)

            country.setdefault(month_key, {})

            country[month_key]["srad"] = srad[month]
            country[month_key]["wind"] = wind[month]
            country[month_key]["tmax"] = tmax[month]
            country[month_key]["tmin"] = tmin[month]

        country["average_srad"] = average_monthly(srad)
        country["average_wind"] = average_monthly(wind)
        country["average_tmax"] = average_monthly(tmax)
        country["average_tmin"] = average_monthly(tmin)

        print("  OK")

    except Exception as e:
        print(f"  ERROR: {e}")


save_json(JSON_FILE, country_data)

print()
print(f"Обновлён: {JSON_FILE}")
print()


# ============================================================
# UPDATE REGIONS
# ============================================================

print("========================================")
print("REGIONS")
print("========================================")

for regions_file in sorted(REGIONS_DIR.glob("*.json")):

    country_code = regions_file.stem.upper()

    print(f"[REGIONS] {country_code}")

    try:
        regions_data = load_json(regions_file)

        region_index = build_region_index(country_code)

        updated = 0
        skipped = 0

        for region_name, region_data in regions_data.items():

            if region_name not in region_index:
                print(
                    f"  [SKIP] {region_name}: "
                    f"не найден в {country_code}.json"
                )
                skipped += 1
                continue

            geometry = region_index[region_name]

            srad = calculate_worldclim_monthly(
                geometry,
                srad_files
            )

            wind = calculate_worldclim_monthly(
                geometry,
                wind_files
            )

            tmax = calculate_cruts_monthly(
                geometry,
                tmax_files
            )

            tmin = calculate_cruts_monthly(
                geometry,
                tmin_files
            )

            for month in range(1, 13):

                month_key = str(month)

                region_data.setdefault(month_key, {})

                # НЕ трогаем существующие temp / prec

                region_data[month_key]["srad"] = srad[month]
                region_data[month_key]["wind"] = wind[month]
                region_data[month_key]["tmax"] = tmax[month]
                region_data[month_key]["tmin"] = tmin[month]

            region_data["average_srad"] = average_monthly(srad)
            region_data["average_wind"] = average_monthly(wind)
            region_data["average_tmax"] = average_monthly(tmax)
            region_data["average_tmin"] = average_monthly(tmin)

            updated += 1

            print(f"  OK: {region_name}")

        save_json(regions_file, regions_data)

        print(
            f"  Обновлено: {updated}, "
            f"пропущено: {skipped}"
        )

    except Exception as e:
        print(f"  ERROR: {e}")


print()
print("========================================")
print("ГОТОВО")
print("========================================")