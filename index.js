const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("App running");
});

app.get("/health", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port", PORT);
});

// KEEP ALIVE
setInterval(() => {}, 60000);
