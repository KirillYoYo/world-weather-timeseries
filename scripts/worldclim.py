# pip install rioxarray rasterstats geopandas numpy

import os
import re
import json
import glob
from collections import defaultdict

import numpy as np
import rioxarray
import geopandas as gpd
from rasterstats import zonal_stats

# ================== НАСТРОЙКИ ==================
BASE          = "../public"
PREC_DIR      = os.path.join(BASE, "wc2.1_cruts4.09_10m_prec_2020-2024")
TMAX_DIR      = os.path.join(BASE, "wc2.1_cruts4.09_10m_tmax_2020-2024")
TMIN_DIR      = os.path.join(BASE, "wc2.1_cruts4.09_10m_tmin_2020-2024")
COUNTRIES_DIR = os.path.join(BASE, "countries")
OUT_DIR       = "output_json"

NODATA      = -9999.0
ALL_TOUCHED = False

NAME_CANDIDATES = ["NAME_1", "NAME", "name", "Name", "province",
                   "PROVINCE", "admin", "ADMIN", "ADM1_EN", "shapeName"]

# ================== ХЕЛПЕРЫ ==================
def parse_month(path):
    m = re.search(r"(\d{4})[-_](\d{2})", os.path.basename(path))
    return int(m.group(2)) if m else None

def group_by_month(paths):
    by_month = defaultdict(list)
    for p in paths:
        mo = parse_month(p)
        if mo is not None:
            by_month[mo].append(p)
    return by_month

def average_tifs(paths):
    """Усредняет несколько GeoTIFF-ов в один 2D массив.
    Возвращает (array, transform, crs)."""
    arrays, transform, crs = [], None, None
    for p in paths:
        da = rioxarray.open_rasterio(p, masked=True).squeeze(drop=True)
        arrays.append(da.values.astype("float32"))
        if transform is None:
            transform = da.rio.transform()
            crs       = da.rio.crs
    stacked  = np.ma.stack(arrays, axis=0)
    mean_arr = np.ma.mean(stacked, axis=0).filled(np.nan)
    return mean_arr, transform, crs

def guess_name_column(gdf):
    for c in NAME_CANDIDATES:
        if c in gdf.columns:
            return c
    for c in gdf.columns:
        if c != "geometry" and gdf[c].dtype == object:
            return c
    raise ValueError("Не найдена колонка с названием провинции")

def zonal_mean(gdf, arr, transform):
    stats = zonal_stats(
        gdf.geometry, arr,
        affine=transform,          # ← важно: передаём transform!
        nodata=NODATA,
        stats=["mean"],
        all_touched=ALL_TOUCHED,
    )
    return [s["mean"] for s in stats]

# ================== ЭТАП 1: усредняем по годам ==================
print("ЭТАП 1: усреднение растров по годам")
prec_files = group_by_month(glob.glob(os.path.join(PREC_DIR, "*.tif")))
tmax_files = group_by_month(glob.glob(os.path.join(TMAX_DIR, "*.tif")))
tmin_files = group_by_month(glob.glob(os.path.join(TMIN_DIR, "*.tif")))

months = sorted(set(prec_files) & set(tmax_files) & set(tmin_files))
if not months:
    raise SystemExit("Не нашёл TIFF-ов.")
print(f"  месяцы: {months}")

prec_monthly, tmax_monthly, tmin_monthly = {}, {}, {}
raster_transform, raster_crs = None, None

for mo in months:
    prec_monthly[mo], raster_transform, raster_crs = average_tifs(prec_files[mo])
    tmax_monthly[mo], _, _ = average_tifs(tmax_files[mo])
    tmin_monthly[mo], _, _ = average_tifs(tmin_files[mo])
    print(f"  месяц {mo:02d}: усреднено "
          f"{len(prec_files[mo])}×prec, {len(tmax_files[mo])}×tmax, "
          f"{len(tmin_files[mo])}×tmin")

print(f"  CRS: {raster_crs}")

# ================== ЭТАП 2: считаем средние по провинциям ==================
print("\nЭТАП 2: расчёт средних по провинциям")
os.makedirs(OUT_DIR, exist_ok=True)

country_files = sorted(
    glob.glob(os.path.join(COUNTRIES_DIR, "*.json")) +
    glob.glob(os.path.join(COUNTRIES_DIR, "*.geojson"))
)

for country_path in country_files:
    country_name = os.path.splitext(os.path.basename(country_path))[0]
    print(f"\n=== {country_name} ===")

    try:
        gdf = gpd.read_file(country_path)
    except Exception as e:
        print(f"  ошибка чтения: {e}")
        continue

    if gdf.empty:
        print("  пусто, пропускаем")
        continue

    if raster_crs is not None and gdf.crs is not None and gdf.crs != raster_crs:
        gdf = gdf.to_crs(raster_crs)
    gdf = gdf.reset_index(drop=True)

    name_col = guess_name_column(gdf)
    print(f"  колонка названий: '{name_col}', провинций: {len(gdf)}")

    per_month_temp = {}
    per_month_prec = {}
    for mo in months:
        prec_means = zonal_mean(gdf, prec_monthly[mo], raster_transform)
        tmax_means = zonal_mean(gdf, tmax_monthly[mo], raster_transform)
        tmin_means = zonal_mean(gdf, tmin_monthly[mo], raster_transform)
        temp_means = [
            (a + b) / 2 if (a is not None and b is not None) else None
            for a, b in zip(tmax_means, tmin_means)
        ]
        per_month_prec[mo] = prec_means
        per_month_temp[mo] = temp_means

    out = {}
    for pos, (_, row) in enumerate(gdf.iterrows()):
        prov_name = str(row[name_col])

        month_block = {}
        all_t, all_p = [], []
        for mo in months:
            t = per_month_temp[mo][pos]
            p = per_month_prec[mo][pos]
            t_val = float(t) if (t is not None and not np.isnan(t)) else None
            p_val = float(p) if (p is not None and not np.isnan(p)) else None
            month_block[str(mo)] = {
                "temp": round(t_val, 2) if t_val is not None else None,
                "prec": round(p_val, 2) if p_val is not None else None,
            }
            if t_val is not None: all_t.append(t_val)
            if p_val is not None: all_p.append(p_val)

        entry = {
            "average_temp": round(float(np.mean(all_t)), 2) if all_t else None,
            "average_prec": round(float(np.mean(all_p)), 2) if all_p else None,
        }
        entry.update(month_block)
        out[prov_name] = entry

    out_path = os.path.join(OUT_DIR, f"{country_name}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"  → {out_path}")

print("\nГотово.")