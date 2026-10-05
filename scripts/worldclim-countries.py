import os
import json
import glob
import numpy as np

IN_DIR   = "output_json"                   # папка с по-страновыми json
OUT_FILE = "all_countries_data.json"       # итог: одна запись на страну

result = {}

for path in sorted(glob.glob(os.path.join(IN_DIR, "*.json"))):
    country = os.path.splitext(os.path.basename(path))[0]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    # data = {"Province1": {"average_temp":..., "average_prec":...,
    #                        "1": {"temp":..., "prec":...}, ...}, ...}

    avg_temp_list = []
    avg_prec_list = []
    monthly_temp = {str(m): [] for m in range(1, 13)}
    monthly_prec = {str(m): [] for m in range(1, 13)}

    for prov, entry in data.items():
        if entry.get("average_temp") is not None:
            avg_temp_list.append(entry["average_temp"])
        if entry.get("average_prec") is not None:
            avg_prec_list.append(entry["average_prec"])

        for key, val in entry.items():
            if not key.isdigit() or val is None:
                continue
            t = val.get("temp")
            p = val.get("prec")
            if t is not None:
                monthly_temp[key].append(t)
            if p is not None:
                monthly_prec[key].append(p)

    country_block = {
        "average_temp": round(float(np.mean(avg_temp_list)), 2) if avg_temp_list else None,
        "average_prec": round(float(np.mean(avg_prec_list)), 2) if avg_prec_list else None,
    }
    for m in range(1, 13):
        tv = monthly_temp[str(m)]
        pv = monthly_prec[str(m)]
        country_block[str(m)] = {
            "temp": round(float(np.mean(tv)), 2) if tv else None,
            "prec": round(float(np.mean(pv)), 2) if pv else None,
        }

    result[country] = country_block

with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"✅ {OUT_FILE}")
print(f"   стран: {len(result)}")