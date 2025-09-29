const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;


const BATCH_INTERVAL_MS = Number(process.env.BATCH_INTERVAL_MS || 120_000);


app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


const logPath = path.resolve(__dirname || '.', 'events.log');
const eventStream = fs.createWriteStream(logPath, { flags: 'a' });
eventStream.on('error', (err) => {
  console.error('Event log write error:', err);
});


let currentBatch = [];
let lastSummary = null;
let windowStart = new Date();


function summarizeAndReset() {
  const windowEnd = new Date();


  const events = currentBatch;
  currentBatch = [];


  const countsByType = events.reduce((acc, ev) => {
    acc[ev.type] = (acc[ev.type] || 0) + 1;
    return acc;
  }, {});

  const summary = {
    batchId: Date.now(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalCount: events.length,
    countsByType
  };

  lastSummary = summary;


  if (summary.totalCount === 0) {
    console.log(`[Batch ${summary.batchId}] ${summary.windowStart} — ${summary.windowEnd}: no events`);
  } else {
    console.log(
      `[Batch ${summary.batchId}] ${summary.windowStart} — ${summary.windowEnd}: total=${summary.totalCount}, byType=${JSON.stringify(countsByType)}`
    );
  }


  try {
    fs.truncateSync(logPath, 0);
  } catch (e) {
    console.error('Failed to clear events.log:', e);
  }


  windowStart = windowEnd;
}


app.post('/log', (req, res) => {
  try {
    const event = req.body;
    const enriched = { ...event, serverTimestamp: new Date().toISOString() };
    const line = JSON.stringify(enriched) + '\n';

    if (!eventStream.write(line)) {
      eventStream.once('drain', () => {
        currentBatch.push(enriched);
        console.log('Event received (delayed write):', enriched);
        res.json({ ok: true });
      });
    } else {
      currentBatch.push(enriched);
      console.log('Event received:', enriched);
      res.json({ ok: true });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

app.get('/summary', (req, res) => {
  if (!lastSummary) {
    return res.json({ ok: true, message: 'No batch produced yet', intervalMs: BATCH_INTERVAL_MS });
  }
  res.json({ ok: true, ...lastSummary });
});


app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});


setInterval(summarizeAndReset, BATCH_INTERVAL_MS);


app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`events.log path: ${logPath}`);
  console.log(`Batch interval: ${BATCH_INTERVAL_MS} ms`);
  console.log(`Use http://localhost:${port}/summary to get the latest batch summary`);
});
