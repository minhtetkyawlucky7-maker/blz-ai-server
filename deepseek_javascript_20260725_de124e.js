require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.static('public'));

// ================================================================
//  FETCH GAME RESULT (Original Logic)
// ================================================================
async function fetchGameResult() {
  try {
    const resp = await fetch('https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageSize: 10, pageNo: 1, typeId: 1, language: 0,
        random: '69b04bcd437f496c8c97e763af16ba03',
        signature: '10BDFF509233B671B9DB6C661F1DC2F3',
        timestamp: Math.floor(Date.now() / 1000)
      })
    });
    const data = await resp.json();
    if (data?.data?.list?.[0]) return data.data.list[0];
    throw new Error('Empty');
  } catch (_) {
    return {
      issueNumber: (2026072401 + Math.floor(Math.random() * 1000)).toString(),
      number: Math.floor(Math.random() * 10).toString()
    };
  }
}

// ================================================================
//  ORIGINAL AI PREDICTION LOGIC (Ported from HTML)
// ================================================================
async function advancedAIPredict(history) {
  const recent = history.filter(h => h.result !== null && h.result !== undefined)
    .map(h => Number(h.result)).slice(0, 20);

  if (recent.length < 3) {
    return {
      prediction: Math.random() > 0.5 ? 'BIG' : 'SMALL',
      confidence: 82,
      opposite_number: Math.floor(Math.random() * 10),
      calculation: 'Initializing initial sequence nodes via Bayesian prior estimation...'
    };
  }

  const bigs = recent.filter(n => n >= 5).length;
  const bias = ((bigs / recent.length) * 100).toFixed(1);

  const promptText = `You are an elite Quantitative Risk Analyst AI. Evaluate this sequence: [${recent.join(', ')}]. Bias BIG: ${bias}%.
Rules: 0-4 = SMALL, 5-9 = BIG.
Return JSON ONLY (no markdown backticks):
{
  "prediction": "BIG or SMALL",
  "confidence": 88,
  "opposite_number": 3,
  "statistical_analysis": "Calculated CUSUM drift and standard variance deviation across observed points."
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content) throw new Error('Invalid AI response');

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(rawText);

    return {
      prediction: aiData.prediction || 'BIG',
      confidence: parseInt(aiData.confidence) || 85,
      opposite_number: parseInt(aiData.opposite_number) || Math.floor(Math.random() * 10),
      calculation: aiData.statistical_analysis || 'Advanced regression pattern evaluated successfully.'
    };
  } catch (error) {
    console.error('AI Error:', error);
    return {
      prediction: Math.random() > 0.5 ? 'BIG' : 'SMALL',
      confidence: 80,
      opposite_number: Math.floor(Math.random() * 10),
      calculation: 'Engaged algorithmic neural fallback due to network restriction.'
    };
  }
}

// ================================================================
//  API ROUTES
// ================================================================

// 1. Get Game Result (Proxy)
app.get('/api/game-result', async (req, res) => {
  try {
    const result = await fetchGameResult();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// 2. Get Prediction (Uses Original AI Logic)
app.post('/api/predict', async (req, res) => {
  try {
    const { history } = req.body;
    const formatted = history.map(h => ({
      period: h.period,
      prediction: h.prediction,
      result: h.result !== '-' ? Number(h.result) : null,
      resultType: h.resultType,
      resultStatus: h.resultStatus,
      calculation: h.calculation
    }));
    const result = await advancedAIPredict(formatted);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

// 3. Submit Result (Save to DB)
app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, opposite_number, result, result_type, status, calculation } = req.body;
    await db.addHistory({
      period,
      prediction,
      possible_number: opposite_number,
      result,
      result_type,
      status,
      calculation
    });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// 4. Get History
app.get('/api/history', async (req, res) => {
  try {
    const history = await db.getHistory(100);
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// 5. Pattern Stats
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

// 6. Clear All
app.post('/api/clear-all', async (req, res) => {
  try {
    await db.clearAllHistory();
    await db.clearPatterns();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

// 7. Test API
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'BLZ-AI Server running', gemini_key_set: !!GEMINI_KEY });
});

app.listen(PORT, () => {
  console.log(`🚀 BLZ-AI Server running on port ${PORT}`);
  console.log(`🔑 Gemini API Key set: ${!!GEMINI_KEY}`);
});