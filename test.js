const db = require("./db");
const fs = require("fs");

console.log("Fetching all records from DB...");

db.all("SELECT * FROM prices ORDER BY date DESC", [], (err, rows) => {
  if (err) {
    console.error("Error fetching data:", err);
    return;
  }

  const fileName = "prices_dump.json";
  fs.writeFileSync(fileName, JSON.stringify(rows, null, 2));
  console.log(`✅ Successfully exported ${rows.length} records to ${fileName}`);
});
