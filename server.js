require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('🚀 BLZ-AI v5.0 (Simple Version)');

// ================================================================
//  REAL API - ဒီတစ်ခါ Simulation မပါဘူး
// ================================================================
async function fetchGameResult() {
  const API_URL = 'https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList';
  
  try {
    console.log(`[API] Fetching from ${API_URL}`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://ckygjf6r.com/',
        'Origin': 'https://ckygjf6r.com'
      },
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
      console.log(`[API] HTTP ${response.status}`);
      return null;
    }

    const text = await response.text();
    
    // Check if it's HTML (error page)
    if (text.trim().startsWith('<')) {
      console.log('[API] Received HTML instead of JSON');
      return null;
    }

    const data = JSON.parse(text);
    if (data?.data?.list?.[0]) {
      console.log(`[API] ✅ Got data: ${data.data.list[0].issueNumber}`);
      return data.data.list[0];
    }
    
    console.log('[API] No data in response');
    return null;
    
  } catch (e) {
    console.error('[API] Error:', e.message);
    return null;
  }
}

// ================================================================
//  PREDICTION LOGIC (ရိုးရိုးလေး)
// ================================================================
let consecutivePrediction = null;
let consecutiveCount = 0;

async function getPrediction(history) {
  // Filter valid results
  const valid = history.filter(h => h.result !== null && h.result !== undefined && h.result !== '-');
  
  // If not enough data, random prediction
  if (valid.length < 5) {
    const pred = Math.random() > 0.5 ? 'BIG' : 'SMALL';
    return {
      prediction: pred,
      confidence: 60,
      possible_number: pred === 'BIG' ? 7 : 2,
      calculation: 'Not enough data for analysis'
    };
  }

  // 1. Count BIG/SMALL
  const numbers = valid.map(h => Number(h.result));
  const bigs = numbers.filter(n => n >= 5).length;
  const smalls = numbers.filter(n => n < 5).length;
  
  // 2. Check consecutive
  const types = numbers.map(n => n >= 5 ? 'BIG' : 'SMALL');
  let consecutiveBig = 0, consecutiveSmall = 0;
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === 'BIG') { consecutiveBig++; } else { break; }
  }
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === 'SMALL') { consecutiveSmall++; } else { break; }
  }

  // 3. Check Pattern DB
  let patternBoost = null;
  if (valid.length >= 3) {
    const lastThree = types.slice(0, 3);
    const key = lastThree.join(',');
    const patterns = await db.getAllPatterns();
    const data = patterns[key];
    if (data && data.total >= 3) {
      const bigRatio = data.nextBig / data.total;
      if (bigRatio > 0.65) patternBoost = 'BIG';
      else if (data.nextSmall / data.total > 0.65) patternBoost = 'SMALL';
    }
  }

  // 4. Decision
  let prediction = 'BIG';
  let confidence = 50;
  let reasons = [];

  // Factor 1: Trend (Big vs Small bias)
  if (bigs > smalls + 3) {
    prediction = 'BIG';
    confidence += 10;
    reasons.push('More BIGs in history');
  } else if (smalls > bigs + 3) {
    prediction = 'SMALL';
    confidence += 10;
    reasons.push('More SMALLs in history');
  }

  // Factor 2: Mean Reversion (if streak is too long)
  if (consecutiveBig >= 4) {
    prediction = 'SMALL';
    confidence += 15;
    reasons.push(`BIG streak ${consecutiveBig} - mean reversion`);
  } else if (consecutiveSmall >= 4) {
    prediction = 'BIG';
    confidence += 15;
    reasons.push(`SMALL streak ${consecutiveSmall} - mean reversion`);
  }

  // Factor 3: Pattern DB
  if (patternBoost) {
    prediction = patternBoost;
    confidence += 10;
    reasons.push('Pattern DB match');
  }

  // Factor 4: Rotation (avoid repeating same prediction too many times)
  if (consecutivePrediction === prediction) {
    consecutiveCount++;
    if (consecutiveCount >= 3) {
      prediction = prediction === 'BIG' ? 'SMALL' : 'BIG';
      confidence -= 5;
      reasons.push('Rotation to avoid repetition');
    }
  } else {
    consecutivePrediction = prediction;
    consecutiveCount = 1;
  }

  // Confidence limits
  confidence = Math.max(45, Math.min(92, confidence));

  // Possible number
  const range = prediction === 'BIG' ? [5,6,7,8,9] : [0,1,2,3,4];
  const freq = {};
  numbers.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  let bestNum = null, bestCount = -1;
  for (const n of range) {
    if ((freq[n] || 0) > bestCount) {
      bestCount = freq[n] || 0;
      bestNum = n;
    }
  }
  if (bestNum === null) bestNum = prediction === 'BIG' ? 7 : 2;

  const logLines = [
    `📊 BIG:${bigs} / SMALL:${smalls}`,
    `📉 Streak: BIG ${consecutiveBig} | SMALL ${consecutiveSmall}`,
    `🎯 Prediction: ${prediction} | Possible: ${bestNum} | Confidence: ${confidence}%`,
    `📌 ${reasons.join(' | ')}`
  ];

  return {
    prediction,
    confidence,
    possible_number: bestNum,
    calculation: logLines.join(' | '),
    logLines
  };
}

// ================================================================
//  API ROUTES
// ================================================================

// 1. Get Game Result (REAL API ONLY)
app.get('/api/game-result', async (req, res) => {
  const result = await fetchGameResult();
  if (!result) {
    return res.status(503).json({ error: 'API unavailable' });
  }
  res.json(result);
});

// 2. Get Prediction
app.post('/api/predict', async (req, res) => {
  try {
    const { history } = req.body;
    const formatted = history.map(h => ({
      period: h.period,
      prediction: h.prediction,
      result: h.result !== '-' ? Number(h.result) : null,
      resultType: h.resultType,
      status: h.resultStatus
    }));
    const result = await getPrediction(formatted);
    res.json(result);
  } catch (e) {
    console.error('Predict error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 3. Submit Result
app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, possible_number, result, result_type, status, calculation } = req.body;
    await db.addHistory({ period, prediction, possible_number, result, result_type, status, calculation });
    
    // Update pattern DB
    if (result !== null && result !== undefined) {
      const history = await db.getHistory(10);
      const valid = history.filter(h => h.result !== null);
      if (valid.length >= 4) {
        const types = valid.map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
        const lastThree = types.slice(0, 3);
        const key = lastThree.join(',');
        const isBig = Number(result) >= 5;
        const patterns = await db.getAllPatterns();
        const current = patterns[key] || { total: 0, nextBig: 0, nextSmall: 0 };
        await db.updatePattern(key, current.total + 1, current.nextBig + (isBig ? 1 : 0), current.nextSmall + (isBig ? 0 : 1));
      }
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Submit error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 4. Get History
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await db.getHistory(limit);
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Get Pattern Stats
app.get('/api/pattern-stats', async (req, res) => {
  try {
    const patterns = await db.getAllPatterns();
    const keys = Object.keys(patterns);
    let totalOcc = 0;
    keys.forEach(k => totalOcc += patterns[k].total);
    res.json({ count: keys.length, totalOcc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. Clear History Only
app.post('/api/clear-history-only', async (req, res) => {
  try {
    await db.clearAllHistory();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. AI Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, lang } = req.body;
    
    if (!GEMINI_KEY) {
      return res.json({ reply: '⚠️ AI service unavailable.' });
    }

    // Check if website-related
    const keywords = ['website', 'site', 'prediction', 'big', 'small', 'number', 'game', 'pattern', 
      'analysis', 'dashboard', 'history', 'candlestick', 'theme', 'settings', 'win', 'loss', 'streak',
      'confidence', 'possible', 'brain', 'ai', 'random', 'rng', 'help', 'explain', 'how to', 'what is'];
    const isRelated = keywords.some(k => message.toLowerCase().includes(k));

    if (!isRelated) {
      return res.json({ 
        reply: "🤖 I'm a specialized assistant for this prediction website. I can only answer questions about the website features and prediction system." 
      });
    }

    const prompt = `You are an AI assistant for a Big/Small prediction website. Answer questions about the website only.
Keep it short and friendly. User question: ${message}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
        })
      }
    );

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not process that.';
    res.json({ reply });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ reply: '⚠️ Error connecting to AI.' });
  }
});

// 8. Test
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', version: '5.0-simple', gemini: !!GEMINI_KEY });
});

// ================================================================
//  START
// ================================================================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔑 Gemini: ${GEMINI_KEY ? '✅' : '❌'}`);
});
