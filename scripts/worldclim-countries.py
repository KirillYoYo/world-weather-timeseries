import os
import json
import glob

IN_DIR = "output_json"
OUT_FILE = "all_countries_temps.json"

result = {}

for path in sorted(glob.glob(os.path.join(IN_DIR, "*.json"))):
    country = os.path.splitext(os.path.basename(path))[0]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    country_block = {}
    for prov, entry in data.items():
        prov_block = {"average_temp": entry.get("average_temp")}
        for key, val in entry.items():
            if key.isdigit():
                prov_block[key] = {"temp": val.get("temp")}
        country_block[prov] = prov_block

    result[country] = country_block

with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

n_countries = len(result)
n_provinces = sum(len(v) for v in result.values())
print(f"✅ {OUT_FILE}")
print(f"   стран:     {n_countries}")
print(f"   провинций: {n_provinces}")