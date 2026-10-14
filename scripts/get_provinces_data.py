import os
import sys
import zipfile
import urllib.request

# Автоматическая установка необходимых библиотек в виртуальное окружение
try:
    import pandas as pd
    from dbfread import DBF
except ImportError:
    print("Устанавливаю необходимые библиотеки (pandas, dbfread)...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pandas", "dbfread"])
    import pandas as pd
    from dbfread import DBF

# Ссылки на гео-данные Natural Earth (Административное деление 1-го уровня)
URL = "https://naciscdn.org"
ZIP_FILE = "provinces.zip"
EXTRACT_DIR = "provinces_data"

print("1. Скачиваю архив с мировыми провинциями (около 14 МБ)...")
urllib.request.urlretrieve(URL, ZIP_FILE)

print("2. Распаковываю файлы...")
with zipfile.ZipFile(ZIP_FILE, 'r') as zip_ref:
    zip_ref.extractall(EXTRACT_DIR)

# Находим .dbf файл в распакованных данных
dbf_filename = None
for root, dirs, files in os.walk(EXTRACT_DIR):
    for file in files:
        if file.endswith(".dbf"):
            dbf_filename = os.path.join(root, file)
            break

if not dbf_filename:
    print("Ошибка: DBF файл не найден в архиве.")
    sys.exit(1)

print(f"3. Читаю базу данных {dbf_filename}...")
# Исправлено: используем правильный аргумент char_decode_errors для обхода проблем с кодировкой
table = DBF(dbf_filename, encoding='utf-8', char_decode_errors='ignore')
df = pd.DataFrame(iter(table))

# Список колонок, которые нам нужны
# adm0_a3 - ISO код страны, name - название провинции, pop_est - население
columns_mapping = {
    'adm0_a3': 'adm0_iso',
    'name': 'province_name',
    'pop_est': 'population',
    'type_en': 'type'
}

# Проверяем наличие колонок в датасете
available_cols = [col for col in columns_mapping.keys() if col in df.columns]
df_filtered = df[available_cols].rename(columns=columns_mapping)

OUTPUT_CSV = "world_provinces_population_complete.csv"
print(f"4. Сохраняю результат в файл {OUTPUT_CSV}...")
df_filtered.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')

# Очистка временных файлов
print("5. Удаляю временные файлы...")
try:
    import shutil
    os.remove(ZIP_FILE)
    shutil.rmtree(EXTRACT_DIR)
except Exception:
    pass

print(f"\nГотово! Полный список провинций успешно сохранен в файл: {os.path.abspath(OUTPUT_CSV)}")