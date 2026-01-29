const express = require("express");
const path = require("path");
const axios = require("axios");
const dayjs = require("dayjs");
const serverless = require("serverless-http");

const db = require("../db");
const { sendReportInEmailQueue, sendWeeklyReportInEmailQueue } = require("../send_report");

const app = express();

/* -------------------- MIDDLEWARE -------------------- */

app.use(express.json());

// Static files (NOTE: Vercel is read-only, use only for serving)
app.use("/public", express.static(path.join(__dirname, "../public")));

/* -------------------- HELPERS -------------------- */

let vegData = [];

function deleteRecordsForDate(date, city) {
  return new Promise((resolve, reject) => {
    db.run(
      "DELETE FROM prices WHERE date = ? AND city = ?",
      [date, city],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function scrapeDate(city, date) {
  const url = `https://vegetablemarketprice.com/api/dataapi/market/${city}/daywisedata?date=${date}`;

  try {
    await deleteRecordsForDate(date, city);

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    if (!data?.data) return 0;

    const insertStmt = db.prepare(`
      INSERT INTO prices
      (date, vegetable, wholesale_price, retail_max_price, retail_min_price,
       shopmall_max_price, shopmall_min_price, unit, image, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;

    for (const item of data.data) {
      const [retailMin, retailMax] =
        item.retailprice?.split("-").map((x) => x.trim()) || [null, null];

      const [shopmallMin, shopmallMax] =
        item.shopingmallprice?.split("-").map((x) => x.trim()) || [null, null];

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
        city,
      ]);

      vegData.push({
        vegetable: item.vegetablename,
        wholesale_price: item.price || null,
        retail_max_price: retailMax,
        retail_min_price: retailMin,
        shopmall_max_price: shopmallMax,
        shopmall_min_price: shopmallMin,
        unit: item.units,
        image: "https://vegetablemarketprice.com/" + item.table.imageUrl,
        city,
        date,
      });

      count++;
    }

    insertStmt.finalize();
    return count;
  } catch (err) {
    console.error("Scrape error:", err.message);
    return 0;
  }
}

/* -------------------- ROUTES -------------------- */

app.get("/scrape", async (req, res) => {
  try {
    vegData = [];
    const city = req.query.city || "kerala";

    let start = dayjs(req.query.startDate || req.query.date || dayjs());
    let end = dayjs(req.query.endDate || req.query.date || dayjs());

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).send("Invalid date format (YYYY-MM-DD)");
    }

    let current = start;
    let totalRecords = 0;

    while (current.isSame(end) || current.isBefore(end)) {
      totalRecords += await scrapeDate(city, current.format("YYYY-MM-DD"));
      current = current.add(1, "day");
    }

    res.json({
      message: "Scraping completed",
      city,
      from: start.format("YYYY-MM-DD"),
      to: end.format("YYYY-MM-DD"),
      totalRecords,
      vegData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/prices", (req, res) => {
  db.all("SELECT * FROM prices", [], (err, rows) => {
    if (err) return res.status(500).send("DB Error");
    res.json({ data: rows, totalRecords: rows.length });
  });
});

app.post("/send-mail-queue", async (req, res) => {
  try {
    const result = await sendReportInEmailQueue();
    res.json({
      success: !!result?.length,
      data: result || [],
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/send-weekly-report", async (req, res) => {
  try {
    const result = await sendWeeklyReportInEmailQueue();
    res.json({
      success: !!result?.length,
      data: result || [],
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/view-email/:id", (req, res) => {
  db.get(
    "SELECT HtmlBody FROM EmailQueue WHERE id = ?",
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).send("DB Error");
      if (!row) return res.status(404).send("Not found");
      res.set("Content-Type", "text/html").send(row.HtmlBody);
    }
  );
});

app.get("/criteria", (req, res) => {
  const fs = require("fs");
  try {
    const data = fs.readFileSync("./filter_criteria.json", "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* -------------------- EXPORT (IMPORTANT) -------------------- */

module.exports = serverless(app);
