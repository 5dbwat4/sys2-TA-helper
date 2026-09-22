import pandas as pd
import json
import csv

# dmc.xlsx -> mapping of Student ID to Name and Board DB No etc? Let's check columns
df = pd.read_excel('../dmc.xlsx')
dmc_data = df.to_dict(orient='records')

sign_data = []
with open('../sign.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        sign_data.append(row)

with open('init_data.json', 'w', encoding='utf-8') as f:
    json.dump({'dmc': dmc_data, 'sign': sign_data}, f, ensure_ascii=False, indent=2)
