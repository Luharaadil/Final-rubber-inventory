fetch('https://docs.google.com/spreadsheets/d/1rVuQf4nBfpFrvDzUHfgYIbKSOvklZCGcOcKZ7zhHdcE/edit')
  .then(res => res.text())
  .then(text => {
    const fs = require('fs');
    fs.writeFileSync('sheet.html', text);
  })
  .catch(console.error);
