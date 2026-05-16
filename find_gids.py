import re
with open("sheet.html", "r", encoding="utf-8") as f:
    text = f.read()
matches = re.findall(r'.{0,50}Calendering.{0,50}', text)
for m in matches[:10]: print(m)
print("---")
matches2 = re.findall(r'\["[^"]+",(\d+)\]', text)
for m in matches2[:10]: print(m)
matches3 = re.findall(r'\["Calendering".{0,100}', text)
for m in matches3[:10]: print(m)
