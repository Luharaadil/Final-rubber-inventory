import re
import urllib.request

url = 'https://docs.google.com/spreadsheets/d/1rVuQf4nBfpFrvDzUHfgYIbKSOvklZCGcOcKZ7zhHdcE/edit'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')

# Find string that looks like tab names
# Google Sheets stores sheet names in a JS array.
# Usually "name":"Sheet1" or ["Sheet1", gid, ...
print("TAB NAMES:")
for m in set(re.findall(r'"([^"]+)",\d+,[0-9]+', html)) | set(re.findall(r'\["([^"]+)",(\d+)\]', html)):
    print(m)
