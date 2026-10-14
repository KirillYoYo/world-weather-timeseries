"""
Население провинций через глобальный растр WorldPop 1km.
Вход:  data/countries/*.json
Выход: province_population.json
       { "RUS": { "Moscow": { "population": ..., "symbol_sort_key": 0 }, ... } }
"""

import os
import json
import glob
import requests
import numpy as np
import geopandas as gpd
from rasterstats import zonal_stats

# ---------- НАСТРОЙКИ ----------
COUNTRIES_DIR = "scripts/data/countries"
OUT_FILE      = "province_population.json"
RASTER_PATH   = "global_pop_1km.tif"

RASTER_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2021_2022_1km_UNadj/"
    "constrained/2021/0_Mosaicked/global_ppp_2021_1km_UNadj_constrained.tif"
)

NAME_CANDIDATES = ["shapeName", "name", "NAME", "NAME_1", "name_en", "province"]

# ---------- 1. Скачиваем глобальный растр (один раз) ----------
def download_raster():
    if os.path.exists(RASTER_PATH):
        size_mb = os.path.getsize(RASTER_PATH) / 1024 / 1024
        print(f"Растр уже есть: {RASTER_PATH} ({size_mb:.1f} MB)")
        return

    print(f"Скачиваем {RASTER_URL}")
    r = requests.get(RASTER_URL, stream=True, timeout=600)
    r.raise_for_status()
    total = int(r.headers.get("content-length", 0))
    done = 0
    with open(RASTER_PATH, "wb") as f:
        for chunk in r.iter_content(1024 * 1024):
            f.write(chunk)
            done += len(chunk)
            if total:
                pct = done * 100 / total
                print(f"\r  {pct:.1f}% ({done/1024/1024:.0f}/{total/1024/1024:.0f} MB)", end="")
    print("\nГотово")

download_raster()

# ---------- 2. Проходим по странам ----------
files = sorted(glob.glob(os.path.join(COUNTRIES_DIR, "*.json")))
print(f"\nСтран: {len(files)}")

result = {}

for path in files:
    country = os.path.splitext(os.path.basename(path))[0].upper()
    print(f"\n=== {country} ===")

    try:
        gdf = gpd.read_file(path)
    except Exception as e:
        print(f"  ошибка чтения: {e}")
        continue

    if gdf.empty:
        print("  пусто")
        continue

    # zonal_stats: сумма населения по каждому полигону
    try:
        stats = zonal_stats(
            gdf.geometry,
            RASTER_PATH,
            stats=["sum"],
            all_touched=False,
        )
    except Exception as e:
        print(f"  ошибка zonal_stats: {e}")
        continue

    prov_pop = {}
    for pos, (_, row) in enumerate(gdf.iterrows()):
        props = row.to_dict()

        prov_name = None
        for k in NAME_CANDIDATES:
            if props.get(k):
                prov_name = str(props[k])
                break
        if not prov_name:
            prov_name = f"province_{pos}"

        val = stats[pos].get("sum") if stats[pos] else None
        pop = int(round(val)) if val is not None and not np.isnan(val) else 0
        prov_pop[prov_name] = {"population": pop}

    # symbol_sort_key: чем больше население → меньше ключ
    ordered = sorted(prov_pop.items(), key=lambda kv: -kv[1]["population"])
    for rank, (pname, _) in enumerate(ordered):
        prov_pop[pname]["symbol_sort_key"] = rank

    result[country] = prov_pop
    print(f"  провинций: {len(prov_pop)}")

with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n✅ {OUT_FILE}")
print(f"   стран: {len(result)}")