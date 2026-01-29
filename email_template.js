const dayjs = require("dayjs");

function getPriceChangeHtml(currentPrice, previousPrice) {
  if (!previousPrice) return { text: "N/A", color: "gray", arrow: "", bgColor: "transparent" };
  
  const diff = currentPrice - previousPrice;
  const percent = ((diff / previousPrice) * 100).toFixed(1);
  
  if (diff > 0) {
    return {
      text: `${percent}%`,
      color: "#d32f2f",
      arrow: "▲",
      bgColor: "#ffebee" 
    };
  } else if (diff < 0) {
    return {
      text: `${Math.abs(percent)}%`,
      color: "#388e3c", 
      arrow: "▼",
      bgColor: "#e8f5e9" 
    };
  } else {
    return {
      text: "0%",
      color: "#757575",
      arrow: "-",
      bgColor: "transparent"
    };
  }
}

// ... (previous code for getPriceChangeHtml and generateWeeklyReportHtml)

function generateWeeklyReportHtml(startDate, endDate, items) {
  const rows = items.map((item) => {
    // Calculate percentage change relative to moving average
    const diff = item.price - item.avgPrice;
    const percent = item.avgPrice !== 0 ? ((diff / item.avgPrice) * 100).toFixed(1) : "0.0";
    const isIncrease = diff > 0;
    
    const badgeColor = isIncrease ? "#d32f2f" : "#388e3c";
    const badgeBg = isIncrease ? "#ffebee" : "#e8f5e9";
    const arrow = isIncrease ? "▲" : "▼";

    return `
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 15px 0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${item.image || 'https://via.placeholder.com/40'}" alt="${item.name}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; background-color: #F1F5F9;">
            <span style="font-weight: 600; color: #1E293B;">${item.name}</span>
          </div>
        </td>
        <td style="padding: 15px 0; text-align: center; font-weight: 500; color: #1E293B; border-right: 1px solid #F1F5F9;">₹${item.prevPrice.toFixed(2)}</td>
        <td style="padding: 15px 0; text-align: center; font-weight: 500; color: #1E293B;">₹${item.price.toFixed(2)}</td>
        <td style="padding: 15px 0; text-align: right;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background-color: ${badgeBg}; color: ${badgeColor};">
            ${arrow} ${Math.abs(percent)}%
          </span>
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #F8FAFC; color: #334155; }
  .container { max-width: 650px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
  .header { background-color: #10B981; color: white; padding: 30px 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .content { padding: 40px; }
  .intro-text { color: #64748B; font-size: 15px; line-height: 1.6; margin-bottom: 30px; }
  .report-period { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 30px; }
  .report-period-label { color: #94A3B8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .report-period-date { color: #1E293B; font-size: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th { color: #94A3B8; font-size: 11px; font-weight: 700; text-transform: uppercase; padding-bottom: 10px; border-bottom: 1px solid #E2E8F0; }
  .sub-header { font-size: 10px; color: #64748B; font-weight: 600; padding-top: 5px; }
  .footer { background-color: #F8FAFC; padding: 30px; text-align: center; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Weekly Vegetable Price Update</h1>
    </div>
    <div class="content">
      <div class="intro-text">
        Hello Exec Team,<br>
        Here is the weekly summary of wholesale vegetable prices. We are observing market fluctuations. Please review the detailed breakdown below.
      </div>
      
      <div class="report-period">
        <div class="report-period-label">REPORT PERIOD</div>
        <div class="report-period-date">${dayjs(startDate).format("MMM DD")} - ${dayjs(endDate).format("MMM DD, YYYY")}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="text-align: left; vertical-align: bottom;">Vegetable</th>
            <th colspan="2" style="text-align: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 5px;">Price/Kg</th>
            <th rowspan="2" style="text-align: right; vertical-align: bottom;">Weekly Change</th>
          </tr>
          <tr>
            <th class="sub-header" style="text-align: center; border-right: 1px solid #F1F5F9;">${dayjs(startDate).format("MMM DD")}</th>
            <th class="sub-header" style="text-align: center;">${dayjs(endDate).format("MMM DD")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <div class="footer">
      🤖 This email is automatically generated.<br>
      Maintained by Dev Team, Contact: Vishal Gupta <br>
      Email: <a href="mailto:vishal@babcofoods.com" class="footer-link" style="text-decoration: none; color: #3B82F6;">vishal@babcofoods.com</a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates the Price Alert Email HTML (Increase or Decrease)
 */
function generatePriceAlertHtml(vegName, currentPrice, prevPrice, isIncrease, label = "60-day average") {
  const diff = currentPrice - prevPrice;
  const percent = ((Math.abs(diff) / prevPrice) * 100).toFixed(1);
  
  const themeColor = isIncrease ? "#EF4444" : "#10B981"; // Red or Green
  const bgColor = isIncrease ? "#FEF2F2" : "#ECFDF5";
  const arrow = isIncrease ? "▲" : "▼";
  const actionText = isIncrease ? "INCREASED" : "DROPPED";
  const titleText = isIncrease ? "Price Increase" : "Price Drop";
  const descText = isIncrease ? "increased" : "dropped";
  const iconPath = isIncrease 
    ? `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline>`
    : `<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline>`;

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Price Alert - ${vegName}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 0; color: #334155; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background-color: ${themeColor}; color: #ffffff; padding: 20px; text-align: center; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 40px; text-align: center; }
        .icon-wrapper { margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: 800; color: #0F172A; margin-bottom: 10px; }
        .subtitle { color: #64748B; font-size: 16px; line-height: 1.5; margin-bottom: 25px; }
        .badge { display: inline-block; background-color: ${bgColor}; color: ${themeColor}; padding: 8px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-bottom: 30px; }
        .stats-grid { display: flex; gap: 20px; margin-top: 20px; }
        .stat-card { flex: 1; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; }
        .stat-label { color: #64748B; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
        .stat-value { color: ${themeColor}; font-size: 24px; font-weight: 800; }
        .stat-value.neutral { color: #0F172A; }
        .footer { background-color: #F8FAFC; padding: 30px; text-align: center; border-top: 1px solid #E2E8F0; }
        .footer-text { color: #94A3B8; font-size: 12px; line-height: 1.5; }
        .footer-link { color: #3B82F6; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${isIncrease ? '⚠️' : '📉'} Alert: Prices of ${vegName} have ${actionText}!
        </div>
        <div class="content">
            <div class="icon-wrapper">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${themeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${iconPath}
                </svg>
            </div>
            
            <h1 class="title">${vegName} ${titleText}</h1>
            <p class="subtitle">Market price has ${descText} <strong>${percent}%</strong> ${isIncrease ? 'above' : 'below'} the ${label}.</p>
            
            <div class="badge">${arrow} ${percent}% ${isIncrease ? 'Increase' : 'Drop'}</div>
 
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Current Price</div>
                    <div class="stat-value">₹${currentPrice}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">${label}</div>
                    <div class="stat-value neutral">₹${prevPrice}</div>
                </div>
            </div>
        </div>
        <div class="footer">
            <div class="footer-text">
                🤖 This email is automatically generated at ${dayjs().format("h:mm A")}<br>
                Maintained by Dev Team, Contact: Vishal Gupta<br>
                Email: <a href="mailto:vishal@babcofoods.com" class="footer-link">vishal@babcofoods.com</a>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = { generateWeeklyReportHtml, generatePriceAlertHtml };
