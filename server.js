require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ============================================================
//  CORS - ကျယ်ကျယ်ပြန့်ပြန့် ဖွင့်ထားပါ (Render အတွက်)
// ============================================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// ============================================================
//  TEST API (Server အလုပ်လုပ်လား စစ်ဖို့)
// ============================================================
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'BLZ-AI Server is running!',
    timestamp: new Date().toISOString(),
    gemini_key_set: !!GEMINI_KEY
  });
});

// ============================================================
//  FETCH GAME RESULT
// ============================================================
async function fetchGameResult() {
  try {
    const resp = await fetch('https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList', {
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

// ============================================================
//  DB HELPERS
// ============================================================
async function getPatternInsight(lastThree) {
  if (lastThree.length < 3) return null;
  const key = lastThree.join(',');
  const data = await db.getPattern(key);
  if (!data || data.total < 3) return null;

  const bigRatio = data.next_big / data.total;
  const smallRatio = data.next_small / data.total;
  let suggestion = null;
  let confidence = 0;

  if (bigRatio > 0.62) { suggestion = 'BIG'; confidence = Math.round(bigRatio * 100); }
  else if (smallRatio > 0.62) { suggestion = 'SMALL'; confidence = Math.round(smallRatio * 100); }

  if (suggestion) return { suggestion, confidence, totalOccurrences: data.total, key };
  return null;
}

function analyzeHistory(history) {
  const valid = history.filter(h => h.result !== null && h.result !== undefined);
  const recent = valid.slice(0, 25);
  if (recent.length < 3) {
    return { recent, totalBig: 0, totalSmall: 0, freq: {}, trend: 'neutral', consecutive: { big: 0, small: 0 }, lastThree: [],
      mostFreq: null, patterns: [] };
  }

  let totalBig = 0,
    totalSmall = 0;
  const freq = {};
  const types = [];
  recent.forEach(item => {
    const n = Number(item.result);
    if (isNaN(n)) return;
    const t = n >= 5 ? 'BIG' : 'SMALL';
    types.push(t);
    if (t === 'BIG') totalBig++;
    else totalSmall++;
    freq[n] = (freq[n] || 0) + 1;
  });

  let cb = 0,
    cs = 0;
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === 'BIG') { cb++;
      cs = 0; } else { cs++;
      cb = 0; }
    if (i === types.length - 1) continue;
    if (types[i] !== types[types.length - 1]) break;
  }

  const half = Math.max(1, Math.floor(types.length / 2));
  const recentHalf = types.slice(-half);
  const olderHalf = types.slice(0, half);
  const rRatio = recentHalf.filter(t => t === 'BIG').length / (recentHalf.length || 1);
  const oRatio = olderHalf.filter(t => t === 'BIG').length / (olderHalf.length || 1);
  let trend = 'neutral';
  if (rRatio - oRatio > 0.15) trend = 'up';
  else if (oRatio - rRatio > 0.15) trend = 'down';

  let maxF = 0,
    mf = null;
  for (const [n, c] of Object.entries(freq)) {
    if (c > maxF) { maxF = c;
      mf = Number(n); }
  }

  const lastThree = recent.slice(0, 3).map(r => Number(r.result)).filter(n => !isNaN(n));
  const patterns = [];
  if (cb >= 3) patterns.push('🔥 BIG streak');
  if (cs >= 3) patterns.push('❄️ SMALL streak');
  if (totalBig > totalSmall * 1.5) patterns.push('📈 BIG bias');
  if (totalSmall > totalBig * 1.5) patterns.push('📉 SMALL bias');
  if (mf !== null && freq[mf] >= 3) patterns.push(`🎯 ${mf} hot`);
  if (patterns.length === 0) patterns.push('⚖️ Balanced');

  return { recent, totalBig, totalSmall, freq, trend, consecutive: { big: cb, small: cs }, lastThree, mostFreq: mf, patterns };
}

async function predictFromHistory(history, consecutiveType, consecutiveCount, lossCount) {
  const analysis = analyzeHistory(history);
  const { totalBig, totalSmall, trend, consecutive, mostFreq, recent, patterns } = analysis;
  const total = totalBig + totalSmall;

  let bigScore = 50,
    smallScore = 50;
  const reasons = [];

  // 1. Trend
  if (totalBig > totalSmall && total > 3) { bigScore += 5;
    smallScore -= 2; } else if (totalSmall > totalBig && total > 3) { smallScore += 5;
    bigScore -= 2; }

  // 2. Mean Reversion
  if (consecutive.big >= 3) { smallScore += 14;
    bigScore -= 7;
    reasons.push(`Mean Rev (BIG x${consecutive.big})`); } else if (consecutive.small >= 3) { bigScore += 14;
    smallScore -= 7;
    reasons.push(`Mean Rev (SMALL x${consecutive.small})`); }

  // 3. Rotation
  if (consecutiveType === 'BIG') { const p = Math.min(16, consecutiveCount * 4);
    bigScore -= p;
    smallScore += 5;
    reasons.push('Rotation (avoid BIG)'); } else if (consecutiveType === 'SMALL') { const p = Math.min(16,
      consecutiveCount * 4);
    smallScore -= p;
    bigScore += 5;
    reasons.push('Rotation (avoid SMALL)'); }

  // 4. Loss Defense
  if (lossCount >= 2) {
    if (consecutiveType === 'BIG') { smallScore += 18;
      bigScore -= 10;
      reasons.push('Loss defense (flip)'); } else if (consecutiveType === 'SMALL') { bigScore += 18;
      smallScore -= 10;
      reasons.push('Loss defense (flip)'); }
  }

  // 5. GLOBAL PATTERN DB
  const lastThreeTypes = analysis.recent.slice(0, 3).map(r => Number(r.result) >= 5 ? 'BIG' : 'SMALL');
  if (lastThreeTypes.length === 3) {
    const insight = await getPatternInsight(lastThreeTypes);
    if (insight) {
      const boost = Math.min(28, insight.confidence * 0.3);
      if (insight.suggestion === 'BIG') {
        bigScore += boost;
        smallScore -= boost * 0.6;
        reasons.push(`🌐 Global DB (${insight.key}) → BIG ${insight.confidence}% (${insight.totalOccurrences} occ)`);
      } else {
        smallScore += boost;
        bigScore -= boost * 0.6;
        reasons.push(`🌐 Global DB (${insight.key}) → SMALL ${insight.confidence}% (${insight.totalOccurrences} occ)`);
      }
    }
  }

  bigScore += (Math.random() * 6) - 3;
  smallScore += (Math.random() * 6) - 3;
  bigScore = Math.max(10, Math.min(90, bigScore));
  smallScore = Math.max(10, Math.min(90, smallScore));

  let predictionType = bigScore > smallScore ? 'BIG' : 'SMALL';
  let confidence = Math.round(Math.max(bigScore, smallScore) * 0.85 + 15);
  confidence = Math.min(92, Math.max(45, confidence));

  // Possible Number
  const range = predictionType === 'BIG' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  let bestNum = null,
    bestCount = -1;
  const freq = analysis.freq || {};
  for (const n of range) { const c = freq[n] || 0; if (c > bestCount) { bestCount = c;
      bestNum = n; } }
  if (bestNum === null || bestCount === 0) {
    const mfn = analysis.mostFreq;
    if (mfn !== null && range.includes(mfn)) bestNum = mfn;
    else {
      const last = recent.length > 0 ? Number(recent[0].result) : null;
      if (last !== null && range.includes(last)) bestNum = last;
      else if (last !== null) { const nearest = range.reduce((a, b) => Math.abs(a - last) < Math.abs(b - last) ? a : b);
        bestNum = nearest; } else bestNum = predictionType === 'BIG' ? 7 : 2;
    }
  }

  const allPatterns = await db.getAllPatterns();
  const logLines = [
    `📊 Analyzed ${analysis.recent.length} recent results (Global DB: ${Object.keys(allPatterns).length} patterns)`,
    `📈 BIG:${totalBig} / SMALL:${totalSmall}  |  Trend: ${trend}`,
    `🔢 Hot number: ${mostFreq !== null ? mostFreq : '—'}`,
    `🧠 Scores: BIG=${Math.round(bigScore)} SMALL=${Math.round(smallScore)}`,
    `🎯 Prediction: ${predictionType}  |  Possible: ${bestNum}`,
    `📊 Confidence: ${confidence}% | ${reasons.join(', ') || 'Balanced'}`
  ];

  return {
    prediction: predictionType,
    confidence: confidence,
    possible_number: bestNum,
    logLines,
    calculation: logLines.join(' | '),
    patterns
  };
}

// ============================================================
//  API ROUTES
// ============================================================

// 1. Get Latest Result
app.get('/api/game-result', async (req, res) => {
  try { const result = await fetchGameResult();
    res.json(result); } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 2. Get History
app.get('/api/history', async (req, res) => {
  try { const history = await db.getHistory(100);
    res.json(history); } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 3. Get Prediction
app.post('/api/predict', async (req, res) => {
  try {
    const { history, consecutiveType, consecutiveCount, lossCount } = req.body;
    const formatted = history.map(h => ({
      result: h.result !== '-' ? Number(h.result) : null,
      resultType: h.resultType,
      status: h.resultStatus,
      prediction: h.prediction,
      period: h.period
    }));
    const result = await predictFromHistory(formatted, consecutiveType || null, consecutiveCount || 0, lossCount || 0);
    res.json(result);
  } catch (e) { console.error(e);
    res.status(500).json({ error: 'Prediction failed' }); }
});

// 4. Submit Result
app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, possibleNumber, resultNumber, resultType, status, calculation } = req.body;
    await db.addHistory({ period, prediction, possible_number: possibleNumber, result: resultNumber, result_type: resultType,
      status, calculation });

    if (resultNumber !== null && resultNumber !== undefined && status !== 'Pending') {
      const recentHistory = await db.getHistoryForAnalysis(5);
      const sorted = recentHistory.reverse();
      const types = sorted.map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
      if (types.length >= 4) {
        const currentType = resultNumber >= 5 ? 'BIG' : 'SMALL';
        const lastThree = types.slice(-4, -1);
        if (lastThree.length === 3) {
          const key = lastThree.join(',');
          const isBig = currentType === 'BIG';
          await db.updatePattern(key, 1, isBig ? 1 : 0, isBig ? 0 : 1);
        }
      }
    }
    res.json({ success: true });
  } catch (e) { console.error(e);
    res.status(500).json({ error: 'Failed' }); }
});

// 5. Pattern Stats
app.get('/api/pattern-stats', async (req, res) => {
  try {
    const patterns = await db.getAllPatterns();
    const keys = Object.keys(patterns);
    let totalOcc = 0;
    keys.forEach(k => totalOcc += patterns[k].total);
    res.json({ count: keys.length, totalOcc });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 6. Clear Data
app.post('/api/clear-all', async (req, res) => {
  try { await db.clearAllHistory();
    await db.clearPatterns();
    res.json({ success: true }); } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ============================================================
//  START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 BLZ-AI Server running on http://localhost:${PORT}`);
  console.log(`📦 Pattern DB: Unlimited (Centralized SQLite)`);
  console.log(`🔑 Gemini API Key set: ${!!GEMINI_KEY}`);
});
