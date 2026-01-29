const express = require("express");
const path = require("path");
const axios = require("axios");
const dayjs = require("dayjs");
const db = require("./db");
const { sendReportInEmailQueue, sendWeeklyReportInEmailQueue } = require("./send_report");

const app = express();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "public")));
const PORT = 3000;
let vegData = [];

function deleteRecordsForDate(date, city) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM prices WHERE date = ? AND city = ?", [date, city], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function scrapeDate(city, date) {
  const baseUrl = `https://vegetablemarketprice.com/api/dataapi/market/${city}/daywisedata`;
  const url = `${baseUrl}?date=${date}`;

  try {
    await deleteRecordsForDate(date, city);

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
    });

    if (!data?.data) {
      console.log(`No data found for ${date}`);
      return 0;
    }

    const insertStmt = db.prepare(`
      INSERT INTO prices
      (date, vegetable, wholesale_price, retail_max_price, retail_min_price, shopmall_max_price, shopmall_min_price, unit, image, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const item of data.data) {
      const [retailMin, retailMax] = item.retailprice ? item.retailprice.split("-").map(x => x.trim()) : [null, null];
      const [shopmallMin, shopmallMax] = item.shopingmallprice ? item.shopingmallprice.split("-").map(x => x.trim()) : [null, null];

      insertStmt.run([
        date,
        item.vegetablename,
        item.price || null,
        retailMax,
        retailMin,
        shopmallMax,
        shopmallMin,
        item.units,
        "https://vegetablemarketprice.com/" + item.table.imageUrl,
        city
      ]);
      count++;
      vegData.push({
        vegetable: item.vegetablename,
        wholesale_price: item.price || null,
        retail_max_price: retailMax,
        retail_min_price: retailMin,
        shopmall_max_price: shopmallMax,
        shopmall_min_price: shopmallMin,
        unit: item.units,
        image: "https://vegetablemarketprice.com/" + item.table.imageUrl,
        city: city,
        date: date
      })
    } 
    insertStmt.finalize();
    return count;
  } catch (err) {
    console.error(`Error scraping ${date}:`, err.message);
    return 0;
  }
}

app.get("/scrape", async (req, res) => {
  try {
    vegData = [];
    const city = req.query.city || "kerala";
    let start, end;

    if (req.query.startDate && req.query.endDate) {
      start = dayjs(req.query.startDate);
      end = dayjs(req.query.endDate);
    } else if (req.query.date) {
      start = dayjs(req.query.date);
      end = dayjs(req.query.date);
    } else {
      start = dayjs();
      end = dayjs();
    }

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).send("Invalid date format. Use YYYY-MM-DD.");
    }

    let current = start;
    let totalRecords = 0;
    while (current.isBefore(end) || current.isSame(end)) {
      const dateStr = current.format("YYYY-MM-DD");
      const count = await scrapeDate(city, dateStr);
      totalRecords += count;
      
      if (!current.isSame(end)) {
        await new Promise((r) => setTimeout(r, 400));
      }
      
      current = current.add(1, "day");
    }

    res.send({
      message: "Scraping completed",
      city,
      vegData,
      from: start.format("YYYY-MM-DD"),
      to: end.format("YYYY-MM-DD"),
      totalRecords:  totalRecords,

    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// const cron = require("node-cron");

app.get("/prices", (req, res) => {
  db.all("SELECT * FROM prices", [], (err, rows) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.send({data: rows, totalRecords: rows.length});
  });
});

app.use(express.json());
app.post("/send-mail-queue", async (req, res) => {
  try {
    const result = await sendReportInEmailQueue();
    if (result && result.length > 0) {
        res.send({success: true, message: "Saved In Email Queue", data: { ids: result }});
    } else {
        res.send({success: false, message: "No data to report or criteria not met."});
    }
  } catch (e) {
    console.error(e);
    res.status(500).send({success: false, message: e.message});
  }
});

app.post("/send-weekly-report", async (req, res) => {
  try {
    const result = await sendWeeklyReportInEmailQueue();
    if (result && result.length > 0) {
        res.send({success: true, message: "Saved In Email Queue", data: { ids: result }});
    } else {
        res.send({success: false, message: "No data to report."});
    }
  } catch (e) {
    console.error(e);
    res.status(500).send({success: false, message: e.message});
  }
});

app.get("/view-email/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT HtmlBody FROM EmailQueue WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Internal Server Error");
    }
    if (!row) {
      return res.status(404).send("Email not found");
    }
    res.set('Content-Type', 'text/html');
    res.send(row.HtmlBody);
  });
});

// Runs every day at 10:00 AM
// cron.schedule("0 10 * * *", async () => {
//   const today = dayjs().format("YYYY-MM-DD");
//   console.log(`⏰ Running daily cron job for ${today}...`);
//   try {
//     await scrapeDate("kerala", today);
//     console.log("✅ Daily cron job completed.");
//   } catch (error) {
//     console.error("❌ Daily cron job failed:", error);
//   }
// });



app.get("/criteria", (req, res) => {
  const fs = require("fs");
  try {
    const data = fs.readFileSync("./filter_criteria.json", "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
// });

module.exports = app;

