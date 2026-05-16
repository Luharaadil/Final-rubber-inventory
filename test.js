// test.js
fetch('https://docs.google.com/spreadsheets/d/1T4tveDcNoiYCjDr6BABeKPfRBlWPUGl_8PRpPrwuiE8/export?format=csv')
  .then(res => console.log(res.status))
  .catch(console.error);
fetch('https://docs.google.com/spreadsheets/d/1LeGsWB0HTLrY-8kb7rxvNh21Qj2-P9AJYhWz2BlfXo0/export?format=csv')
  .then(res => console.log(res.status))
  .catch(console.error);
