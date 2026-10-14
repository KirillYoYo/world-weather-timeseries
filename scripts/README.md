# Скрипты

Исходные данные лежат в `data/`: границы стран (`countries/`), карта (`world_*.geo.json`, `world_110.json`), растры WorldClim и прочие сырые файлы. Сайт читает карту и страны из `public/` — там симлинки на эти файлы.

Запускать из корня репозитория: `python scripts/<имя>.py` или `node scripts/nasa-power.js`.

## Порядок

WorldClim идёт цепочкой. NASA от неё не зависит и может идти отдельно.

1. `worldclim.py`
2. `worldclim-countries.py`
3. `aggregate-worldclim.py` — после того как в `public/` уже есть `all_countries_data.json` и `regions-by-mounts/`

## Скрипты

**`worldclim.py`** — температура и осадки по провинциям за 2020–2024.

- Читает `data/wc2.1_cruts4.09_10m_{prec,tmax,tmin}_2020-2024/` и `data/countries/`.
- По каждому месяцу усредняет растры по годам, затем среднее по полигону провинции. Температура — среднее tmax и tmin.
- Пишет `output_json/<страна>.json`: годовые `average_temp` / `average_prec` и месяцы `"1"`…`"12"` с `temp` и `prec`.

**`worldclim-countries.py`** — то же, свёрнутое до стран.

- Читает `output_json/`.
- Усредняет провинции внутри страны без веса по площади.
- Пишет `all_countries_data.json` рядом со скриптом. Сайт берёт копию из `public/all_countries_data.json`.

**`aggregate-worldclim.py`** — дополняет уже посчитанные json солнечной радиацией, ветром, tmax и tmin. Поля `temp` и `prec` не меняет.

- Читает `data/wc2.1_10m_srad/`, `data/wc2.1_10m_wind/`, растры tmax/tmin, `data/countries/` и текущие json.
- Дописывает в `public/all_countries_data.json` и в каждый файл `public/regions-by-mounts/` месячные `srad`, `wind`, `tmax`, `tmin` и годовые средние. Перед первой правкой стран делает `public/all_countries_data.json.backup`.
- Файлы регионов не создаёт: обновляет только те, что уже лежат в `regions-by-mounts/`.

**`region-population.py`** — население провинции и приоритет подписи.

- Читает `data/simplemaps_worldcities_basicv1.91.4/worldcities.csv` и `public/regions-by-mounts/`.
- Страна — код файла, он же `iso3` в таблице городов (`adm0_a3`). Имя провинции сопоставляется с `admin_name`, население городов суммируется.
- Дописывает в каждую провинцию `population` и `symbol_sort_key`: `0` у самой населённой провинции страны, `50` у самой маленькой и у тех, кого не удалось сопоставить. В лог пишет страну, имя провинции и население. Запускать после того, как файлы регионов уже есть: `python scripts/region-population.py`.

**`nasa-power.js`** — климатология NASA POWER по центроиду каждой провинции.

- Читает `data/countries/`. Нужен интернет. Уже готовые страны пропускает, скрипт можно останавливать и запускать снова.
- Пишет `public/weather/nasa/<страна>.json`: по провинции (`shapeID`) координаты и месяцы `jan`…`dec` с температурой, ветром, осадками и солнечной радиацией.
