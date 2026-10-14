"""
Добавляет symbol_sort_key в public/regions-by-mounts/*.json
на основе province_population.json.

Логика:
- 0 = самая населённая провинция в стране
- 50 = всё, что дальше 50-го места, или не найдено
"""

import os
import json
import glob

# ---------- НАСТРОЙКИ ----------
POP_FILE       = "province_population.json"
REGIONS_DIR    = "public/regions-by-mounts"
MAX_SORT_KEY   = 50

# ---------- 1. Загружаем население ----------
with open(POP_FILE, encoding="utf-8") as f:
    pop_data = json.load(f)

print(f"Стран в {POP_FILE}: {len(pop_data)}")

# ---------- 2. Проходим по файлам регионов ----------
files = sorted(glob.glob(os.path.join(REGIONS_DIR, "*.json")))
print(f"Файлов регионов: {len(files)}")

total_prov = 0
matched_prov = 0
missed_prov = 0

for path in files:
    iso3 = os.path.splitext(os.path.basename(path))[0].upper()

    with open(path, encoding="utf-8") as f:
        regions = json.load(f)

    country_pop = pop_data.get(iso3, {})
    if not country_pop:
        print(f"  {iso3}: нет данных о населении — всем ставим {MAX_SORT_KEY}")

    for prov_name, entry in regions.items():
        total_prov += 1

        pop_entry = country_pop.get(prov_name)
        if pop_entry is not None:
            matched_prov += 1
            key = pop_entry.get("symbol_sort_key", MAX_SORT_KEY)
        else:
            missed_prov += 1
            key = MAX_SORT_KEY

        # ограничиваем сверху MAX_SORT_KEY
        key = min(key, MAX_SORT_KEY)

        entry["symbol_sort_key"] = key

    with open(path, "w", encoding="utf-8") as f:
        json.dump(regions, f, ensure_ascii=False, indent=2)

    print(f"  {iso3}: провинций {len(regions)}, из них с населением "
          f"{sum(1 for p in regions.values() if p.get('symbol_sort_key', MAX_SORT_KEY) < MAX_SORT_KEY)}")

print(f"\n✅ Готово")
print(f"   всего провинций: {total_prov}")
print(f"   сматчено: {matched_prov}")
print(f"   не найдено: {missed_prov}")