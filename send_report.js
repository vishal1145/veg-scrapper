const sqlite3 = require("sqlite3").verbose();
const dayjs = require("dayjs");
const db = new sqlite3.Database("prices.db");
const { generatePriceAlertHtml,generateWeeklyReportHtml } = require("./email_template");
const EMAIL_CRITERIA = require("./filter_criteria.json");

const RECIPIENTS = "vishal@babcofoods.com";

async function sendReportInEmailQueue() {
  const latestDateRow = await new Promise((resolve, reject) => {
    db.get("SELECT MAX(date) as date FROM prices", (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!latestDateRow || !latestDateRow.date) {
    console.error("No data found in DB.");
    return;
  }

  const today = latestDateRow.date;
  const emailIds = [];

  // Use only the selected criteria
  const criteria = EMAIL_CRITERIA[3];
  const days = parseInt(criteria.interval.split(' ')[0]);
  console.log('days', days);
  const startDate = dayjs(today).subtract(days, 'day').format('YYYY-MM-DD');

  // Get today's prices
  const todayPrices = await new Promise((resolve, reject) => {
    db.all("SELECT vegetable, wholesale_price, image FROM prices WHERE date = ?", [today], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // Get average prices for the interval
  const avgPrices = await new Promise((resolve, reject) => {
    db.all(`
      SELECT vegetable, AVG(wholesale_price) as avg_price 
      FROM prices 
      WHERE date >= ? AND date < ? 
      GROUP BY vegetable
    `, [startDate, today], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const avgPriceMap = new Map(avgPrices.map(r => [r.vegetable, r.avg_price]));
  const label = `${criteria.interval} Average Price`;

  for (const item of todayPrices) {
    const avgPrice = avgPriceMap.get(item.vegetable);
    
    if (avgPrice !== undefined) {
      const roundedAvg = parseFloat(avgPrice.toFixed(2));
      const diff = item.wholesale_price - roundedAvg;
      let matches = false;

      // Check for increase based on the selected criteria
      if (diff > 0) {
        if (criteria.type_value === 'percentage') {
          const percentChange = (diff / roundedAvg) * 100;
          if (percentChange >= parseFloat(criteria.value)) {
            matches = true;
          }
        } else if (criteria.type_value === 'absolute') {
          if (diff >= parseFloat(criteria.value)) {
            matches = true;
          }
        }
      }

      if (matches) {
        console.log(`Match for criteria "${criteria.name}": ${item.vegetable} (+₹${diff})`);
        
        const html = generatePriceAlertHtml(item.vegetable, item.wholesale_price, roundedAvg, true, label);
        
        try {
          const id = await new Promise((resolve, reject) => {
            const insertStmt = db.prepare(`
                INSERT INTO EmailQueue
                (EmailTo, Subject, HtmlBody)
                VALUES (?, ?, ?)
              `);
              insertStmt.run([
                RECIPIENTS,
                `🚨 Price Alert: ${item.vegetable} Increased (${criteria.name})`,
                html,
              ], function(err) {
                if (err) {
                  insertStmt.finalize();
                  reject(err);
                } else {
                  const lastID = this.lastID;
                  insertStmt.finalize();
                  resolve(lastID);
                }
              });
          });
          emailIds.push(id);
        } catch (error) {
          console.error("Error queuing email:", error);
        }
      }
    }
  }
  return emailIds;
}

async function sendWeeklyReportInEmailQueue() {
  const latestDateRow = await new Promise((resolve, reject) => {
    db.get("SELECT MAX(date) as date FROM prices", (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!latestDateRow || !latestDateRow.date) {
    console.error("No data found in DB.");
    return;
  }

  const today = latestDateRow.date;
  const comparisonDate = dayjs(today).subtract(12, 'day').format('YYYY-MM-DD');

  // Get today's prices
  const todayPrices = await new Promise((resolve, reject) => {
    db.all("SELECT vegetable, wholesale_price, image FROM prices WHERE date = ?", [today], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // Get prices from 6 days ago (to show 7-day span)
  const prevPrices = await new Promise((resolve, reject) => {
    db.all("SELECT vegetable, wholesale_price FROM prices WHERE date = ?", [comparisonDate], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // Get moving average for the span
  const avgPrices = await new Promise((resolve, reject) => {
    db.all(`
      SELECT vegetable, AVG(wholesale_price) as avg_price 
      FROM prices 
      WHERE date >= ? AND date <= ? 
      GROUP BY vegetable
    `, [comparisonDate, today], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const prevPriceMap = new Map(prevPrices.map(i => [i.vegetable, i.wholesale_price]));
  const avgPriceMap = new Map(avgPrices.map(i => [i.vegetable, i.avg_price]));

  const comparison = [];
  for (const item of todayPrices) {
    const prevPrice = prevPriceMap.get(item.vegetable);
    const avgPrice = avgPriceMap.get(item.vegetable);
    
    // Only include items where the price has actually changed (up or down)
    if (prevPrice !== undefined && item.wholesale_price !== prevPrice) {
      comparison.push({
        name: item.vegetable,
        price: item.wholesale_price,
        prevPrice: prevPrice,
        avgPrice: avgPrice || item.wholesale_price,
        image: item.image
      });
    }
  }

  // Sort by percentage change (current vs 7 days ago)
  comparison.sort((a, b) => {
    const changeA = Math.abs((a.price - a.prevPrice) / a.prevPrice);
    const changeB = Math.abs((b.price - b.prevPrice) / b.prevPrice);
    return changeB - changeA;
  });

  const topChanges = comparison;  
  console.log("Total items in report:", topChanges.length);
  
  if (topChanges.length === 0) {
    console.log("No data found for the weekly report.");
    return;
  }

  const html = generateWeeklyReportHtml(comparisonDate, today, topChanges);

//   const transporter = nodemailer.createTransport(SMTP_CONFIG);
//   const toList = RECIPIENTS;

  

  try {
    // const info = await transporter.sendMail({
    //   from: `"Vegetable Market Tracker" <${SMTP_CONFIG.auth.user}>`,
    //   to: toList,
    //   subject: `📢 Price Alert: Vegetable Prices Update (${today})`,
    //   html: html,
    // });

    return new Promise((resolve, reject) => {
      const insertStmt = db.prepare(`
          INSERT INTO EmailQueue
          (EmailTo, Subject, HtmlBody)
          VALUES (?, ?, ?)
        `);
        insertStmt.run([
          RECIPIENTS,
          "Vegetable Prices Update",
          html,
        ], function(err) {
          if (err) {
            insertStmt.finalize();
            reject(err);
          } else {
            const lastID = this.lastID;
            insertStmt.finalize();
            // Return the ID in an array to satisfy result.length check and construct correct URL
            resolve([lastID]);
          }
        });
    });
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error;
  }
}

module.exports = { sendReportInEmailQueue, sendWeeklyReportInEmailQueue };
