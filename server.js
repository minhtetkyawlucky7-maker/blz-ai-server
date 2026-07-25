require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.static('public'));

// ================================================================
//  REAL API ONLY - NO FALLBACK
// ================================================================
const REAL_API_URL = 'https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList';

async function fetchRealGameResult() {
  const response = await fetch(REAL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageSize: 10,
      pageNo: 1,
      typeId: 1,
      language: 0,
      random: '69b04bcd437f496c8c97e763af16ba03',
      signature: '10BDFF509233B671B9DB6C661F1DC2F3',
      timestamp: Math.floor(Date.now() / 1000)
    })
  });

  if (!response.ok) {
    throw new Error(`API responded with status ${response.status}`);
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON from API: ${text.substring(0, 100)}...`);
  }

  if (!data?.data?.list?.[0]) {
    throw new Error('No data in API response');
  }

  return data.data.list[0];
}

// ================================================================
//  BACKGROUND WORKER (24/7 - Runs every 60 seconds)
// ================================================================
async function backgroundWorker() {
  const now = new Date().toISOString();
  console.log(`[${now}] 🔄 Background worker started...`);

  try {
    // 1. Fetch real result
    const result = await fetchRealGameResult();
    console.log(`[${now}] ✅ Real data fetched: ${result.issueNumber} → ${result.number}`);

    // 2. Check if already processed
    const recentHistory = await db.getHistory(5);
    if (recentHistory.length > 0 && recentHistory[0].period === result.issueNumber) {
      console.log(`[${now}] ⏭️ Period ${result.issueNumber} already processed`);
      return;
    }

    const actualNumber = Number(result.number);
    const actualType = actualNumber >= 5 ? 'BIG' : 'SMALL';

    // 3. Get history for analysis
    const history = await db.getHistoryForAnalysis(25);

    // 4. Resolve pending prediction if exists
    if (history.length > 0 && history[0].status === 'Pending') {
      const matched = (actualType === history[0].prediction || actualNumber === history[0].possible_number);
      await db.updateHistoryResult(
        history[0].id,
        actualNumber,
        actualType,
        matched ? 'WIN' : 'LOSS'
      );
      console.log(`[${now}] 📝 Resolved: ${history[0].period} → ${actualType} (${matched ? 'WIN' : 'LOSS'})`);
    }

    // 5. Generate new prediction (using your AI logic)
    const aiDecision = await advancedAIPredict(history);

    // 6. Save new prediction
    const nextPeriod = (BigInt(result.issueNumber) + 1n).toString();
    await db.addHistory({
      period: nextPeriod,
      prediction: aiDecision.prediction,
      possible_number: aiDecision.possible_number,
      result: null,
      result_type: null,
      status: 'Pending',
      calculation: aiDecision.calculation
    });
    console.log(`[${now}] ✅ Saved prediction for period ${nextPeriod}: ${aiDecision.prediction}`);

    // 7. Update Pattern DB
    if (history.length >= 3) {
      const sorted = history.reverse();
      const types = sorted.map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
      if (types.length >= 4) {
        const lastThree = types.slice(-4, -1);
        if (lastThree.length === 3) {
          const key = lastThree.join(',');
          const isBig = actualType === 'BIG';
          await db.updatePattern(key, 1, isBig ? 1 : 0, isBig ? 0 : 1);
          console.log(`[${now}] 📊 Pattern DB updated: ${key} → ${actualType}`);
        }
      }
    }

  } catch (error) {
    console.error(`[${now}] ❌ Background worker error:`, error.message);
  }
}

// ================================================================
//  AI PREDICT LOGIC (ခင်ဗျားရဲ့ Original Logic)
// ================================================================
async function advancedAIPredict(history) {
  // ... (ခင်ဗျားရဲ့ Original AI Logic ကို ဒီမှာ ထည့်ပါ) ...
  // အတိုချုံးဖို့ ရှိပြီးသား Logic ကို ပြန်သုံးပါ
  return {
    prediction: 'BIG',
    confidence: 75,
    possible_number: 7,
    calculation: 'Analysis complete'
  };
}

// ================================================================
//  API ROUTES
// ================================================================
app.get('/api/game-result', async (req, res) => {
  try {
    const result = await fetchRealGameResult();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/predict', async (req, res) => {
  try {
    const { history } = req.body;
    const formatted = history.map(h => ({
      period: h.period,
      prediction: h.prediction,
      result: h.result !== '-' ? Number(h.result) : null,
      resultType: h.resultType,
      status: h.resultStatus,
      calculation: h.calculation
    }));
    const result = await advancedAIPredict(formatted);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Prediction failed' });
  }
});

app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, possible_number, result, result_type, status, calculation } = req.body;
    await db.addHistory({ period, prediction, possible_number, result, result_type, status, calculation });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await db.getHistory(limit);
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

app.get('/api/pattern-stats', async (req, res) => {
  try {
    const patterns = await db.getAllPatterns();
    const keys = Object.keys(patterns);
    let totalOcc = 0;
    keys.forEach(k => totalOcc += patterns[k].total);
    res.json({ count: keys.length, totalOcc });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/clear-history-only', async (req, res) => {
  try {
    await db.clearAllHistory();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/clear-all', async (req, res) => {
  try {
    await db.clearAllHistory();
    await db.clearPatterns();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'BLZ-AI Server running - Real API only' });
});

// ================================================================
//  START SERVER
// ================================================================
app.listen(PORT, () => {
  console.log(`🚀 BLZ-AI Server running on port ${PORT}`);
  console.log(`📡 Using REAL API: ${REAL_API_URL}`);
  console.log(`⏰ Background worker running every 60 seconds (24/7)`);
});

// Start background worker immediately and then every 60 seconds
setTimeout(backgroundWorker, 3000);
setInterval(backgroundWorker, 60000);
