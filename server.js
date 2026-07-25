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
//  STATE - AI Tracking
// ================================================================
let consecutivePredictionType = null;
let consecutivePredictionCount = 0;
let lossStreakCount = 0;

// ================================================================
//  FETCH REAL GAME RESULT (Only from API - NO SIMULATION)
// ================================================================
async function fetchRealGameResult() {
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
    
    // Check if we got real data
    if (data?.data?.list && data.data.list.length > 0) {
      const result = data.data.list[0];
      // Validate the result has proper number
      if (result && result.issueNumber && result.number !== undefined) {
        return result;
      }
    }
    
    console.log('[Real API] No data received from API');
    return null;
  } catch (error) {
    console.error('[Real API] Fetch error:', error.message);
    return null;
  }
}

// ================================================================
//  DEEP ANALYSIS ENGINE (Same as before)
// ================================================================
function deepAnalysis(history) {
  const valid = history.filter(h => h.result !== null && h.result !== undefined);
  const recent = valid.slice(0, 30);
  
  if (recent.length < 3) {
    return {
      totalBig: 0, totalSmall: 0, freq: {}, trend: 'neutral',
      consecutive: { big: 0, small: 0 }, mostFreq: null,
      volatility: 0, mean: 0, median: 0, stdDev: 0,
      patternStrength: 0, rngBias: 'neutral',
      analysisNotes: 'Need at least 3 results for analysis.'
    };
  }

  const numbers = recent.map(r => Number(r.result));
  const totalBig = numbers.filter(n => n >= 5).length;
  const totalSmall = numbers.filter(n => n < 5).length;
  
  const freq = {};
  numbers.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  
  let maxF = 0, mostFreq = null;
  for (const [n, c] of Object.entries(freq)) {
    if (c > maxF) { maxF = c; mostFreq = Number(n); }
  }

  const types = numbers.map(n => n >= 5 ? 'BIG' : 'SMALL');
  let cb = 0, cs = 0;
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === 'BIG') { cb++; cs = 0; }
    else { cs++; cb = 0; }
    if (i === types.length - 1) continue;
    if (types[i] !== types[types.length - 1]) break;
  }

  const weights = numbers.map((_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = numbers.reduce((sum, n, i) => sum + n * weights[i], 0);
  const wma = weightedSum / totalWeight;
  const simpleMean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const trend = wma > simpleMean + 0.5 ? 'up' : wma < simpleMean - 0.5 ? 'down' : 'neutral';

  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  // RNG Bias detection
  const expectedPerNumber = numbers.length / 10;
  let chiSquare = 0;
  for (let i = 0; i <= 9; i++) {
    const observed = freq[i] || 0;
    chiSquare += Math.pow(observed - expectedPerNumber, 2) / expectedPerNumber;
  }
  const isBiased = chiSquare > 16.92;
  const rngBias = isBiased ? (mostFreq >= 5 ? 'BIG' : 'SMALL') : 'neutral';

  const notes = [];
  if (cb >= 3) notes.push(`🔥 BIG streak (${cb})`);
  if (cs >= 3) notes.push(`❄️ SMALL streak (${cs})`);
  if (stdDev > 2.5) notes.push(`📊 High volatility (${stdDev.toFixed(2)})`);
  if (isBiased) notes.push(`🎯 RNG Bias: ${rngBias}`);
  if (notes.length === 0) notes.push('⚖️ Balanced');

  return {
    totalBig, totalSmall, freq, trend,
    consecutive: { big: cb, small: cs },
    mostFreq,
    volatility: stdDev,
    mean,
    stdDev,
    rngBias,
    analysisNotes: notes.join(' | ')
  };
}

// ================================================================
//  PREDICTION ENGINE
// ================================================================
async function advancedAIPredict(history) {
  const patternDB = await db.getAllPatterns();
  const analysis = deepAnalysis(history);
  
  let bigScore = 50;
  let smallScore = 50;
  const reasons = [];

  // Trend
  if (analysis.trend === 'up') { bigScore += 8; smallScore -= 4; reasons.push('Trend: Up'); }
  else if (analysis.trend === 'down') { smallScore += 8; bigScore -= 4; reasons.push('Trend: Down'); }

  // Mean Reversion
  if (analysis.consecutive.big >= 3) { smallScore += 16; bigScore -= 8; reasons.push(`Mean Rev (BIG x${analysis.consecutive.big})`); }
  else if (analysis.consecutive.small >= 3) { bigScore += 16; smallScore -= 8; reasons.push(`Mean Rev (SMALL x${analysis.consecutive.small})`); }

  // RNG Bias
  if (analysis.rngBias === 'BIG') { bigScore += 10; smallScore -= 5; reasons.push('RNG Bias: BIG'); }
  else if (analysis.rngBias === 'SMALL') { smallScore += 10; bigScore -= 5; reasons.push('RNG Bias: SMALL'); }

  // Pattern DB
  const lastThree = history.slice(0, 3).map(h => Number(h.result)).filter(n => !isNaN(n));
  const lastThreeTypes = lastThree.map(n => n >= 5 ? 'BIG' : 'SMALL');
  if (lastThreeTypes.length === 3) {
    const key = lastThreeTypes.join(',');
    const data = patternDB[key];
    if (data && data.total >= 3) {
      const bigRatio = data.nextBig / data.total;
      const smallRatio = data.nextSmall / data.total;
      if (bigRatio > 0.65) {
        const boost = Math.min(25, bigRatio * 30);
        bigScore += boost; smallScore -= boost * 0.5;
        reasons.push(`Pattern DB: ${key} → BIG ${(bigRatio*100).toFixed(0)}% (${data.total} occ)`);
      } else if (smallRatio > 0.65) {
        const boost = Math.min(25, smallRatio * 30);
        smallScore += boost; bigScore -= boost * 0.5;
        reasons.push(`Pattern DB: ${key} → SMALL ${(smallRatio*100).toFixed(0)}% (${data.total} occ)`);
      }
    }
  }

  // Hot number
  if (analysis.mostFreq !== null) {
    if (analysis.mostFreq >= 5) { bigScore += 4; reasons.push(`Hot: ${analysis.mostFreq}`); }
    else { smallScore += 4; reasons.push(`Hot: ${analysis.mostFreq}`); }
  }

  // Rotation
  if (consecutivePredictionType === 'BIG') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    bigScore -= penalty; smallScore += 6;
    reasons.push(`Rotation: avoid BIG (${consecutivePredictionCount}x)`);
  } else if (consecutivePredictionType === 'SMALL') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    smallScore -= penalty; bigScore += 6;
    reasons.push(`Rotation: avoid SMALL (${consecutivePredictionCount}x)`);
  }

  // Loss Defense
  if (lossStreakCount >= 2) {
    if (consecutivePredictionType === 'BIG') { smallScore += 20; bigScore -= 12; reasons.push('Loss defense: flip from BIG'); }
    else if (consecutivePredictionType === 'SMALL') { bigScore += 20; smallScore -= 12; reasons.push('Loss defense: flip from SMALL'); }
  }

  bigScore += (Math.random() * 6) - 3;
  smallScore += (Math.random() * 6) - 3;
  bigScore = Math.max(10, Math.min(90, bigScore));
  smallScore = Math.max(10, Math.min(90, smallScore));

  let predictionType = bigScore > smallScore ? 'BIG' : 'SMALL';
  let confidence = Math.round(Math.max(bigScore, smallScore) * 0.85 + 15);
  confidence = Math.min(94, Math.max(45, confidence));

  const range = predictionType === 'BIG' ? [5,6,7,8,9] : [0,1,2,3,4];
  let bestNum = null, bestCount = -1;
  for (const n of range) {
    const c = analysis.freq[n] || 0;
    if (c > bestCount) { bestCount = c; bestNum = n; }
  }
  if (bestNum === null) {
    bestNum = predictionType === 'BIG' ? 7 : 2;
  }

  if (consecutivePredictionType === predictionType) {
    consecutivePredictionCount++;
  } else {
    consecutivePredictionType = predictionType;
    consecutivePredictionCount = 1;
  }

  const logLines = [
    `🧮 ${analysis.analysisNotes}`,
    `📊 Volatility: ${analysis.volatility.toFixed(2)} | RNG Bias: ${analysis.rngBias}`,
    `📈 BIG:${analysis.totalBig} / SMALL:${analysis.totalSmall} | Trend: ${analysis.trend}`,
    `🧠 Scores: BIG=${Math.round(bigScore)} SMALL=${Math.round(smallScore)}`,
    `🎯 Prediction: ${predictionType} | Possible: ${bestNum} | Confidence: ${confidence}%`,
    `📌 ${reasons.join(' | ')}`
  ];

  return {
    prediction: predictionType,
    confidence: confidence,
    possible_number: bestNum,
    calculation: logLines.join(' | '),
    logLines,
    analysis: analysis
  };
}

// ================================================================
//  BACKGROUND WORKER (24/7 - Only Real API Data)
// ================================================================
async function backgroundWorker() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 Background worker started...`);

  try {
    // 1. Fetch REAL result from API
    const realResult = await fetchRealGameResult();
    
    if (!realResult) {
      console.log(`[${timestamp}] ⚠️ No real data from API. Skipping.`);
      return;
    }

    const period = realResult.issueNumber;
    const actualNumber = Number(realResult.number);
    
    if (isNaN(actualNumber) || actualNumber < 0 || actualNumber > 9) {
      console.log(`[${timestamp}] ⚠️ Invalid number: ${realResult.number}`);
      return;
    }

    // 2. Check if already processed
    const existing = await db.getHistory(5);
    const lastPeriod = existing.length > 0 ? existing[0].period : null;
    
    if (lastPeriod === period) {
      console.log(`[${timestamp}] ⏭️ Period ${period} already processed`);
      return;
    }

    const actualType = actualNumber >= 5 ? 'BIG' : 'SMALL';
    console.log(`[${timestamp}] 📥 Real result: ${period} → ${actualNumber} (${actualType})`);

    // 3. Get history for analysis
    const history = await db.getHistoryForAnalysis(25);
    
    // 4. Resolve pending prediction
    let lastPrediction = null;
    let lastPossibleNumber = null;
    if (history.length > 0 && history[0].status === 'Pending') {
      lastPrediction = history[0].prediction;
      lastPossibleNumber = history[0].possible_number;
      
      const matched = (actualType === lastPrediction || actualNumber == lastPossibleNumber);
      await db.updateHistoryResult(history[0].id, actualNumber, actualType, matched ? 'WIN' : 'LOSS');
      
      if (matched) {
        lossStreakCount = 0;
      } else {
        lossStreakCount++;
      }
      
      console.log(`[${timestamp}] 📝 Resolved: ${history[0].period} → ${matched ? 'WIN' : 'LOSS'}`);
    }

    // 5. Generate new prediction
    const aiDecision = await advancedAIPredict(history);
    
    // 6. Save prediction
    const nextPeriod = (BigInt(period) + 1n).toString();
    await db.addHistory({
      period: nextPeriod,
      prediction: aiDecision.prediction,
      possible_number: aiDecision.possible_number,
      result: null,
      result_type: null,
      status: 'Pending',
      calculation: aiDecision.calculation
    });

    console.log(`[${timestamp}] ✅ Saved prediction for ${nextPeriod}: ${aiDecision.prediction}`);

    // 7. Update Pattern DB with REAL result
    const recentHistory = await db.getHistoryForAnalysis(5);
    const sorted = recentHistory.reverse();
    const types = sorted.map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
    
    if (types.length >= 4) {
      const currentType = actualType;
      const lastThree = types.slice(-4, -1);
      if (lastThree.length === 3) {
        const key = lastThree.join(',');
        const isBig = currentType === 'BIG';
        await db.updatePattern(key, 1, isBig ? 1 : 0, isBig ? 0 : 1);
        console.log(`[${timestamp}] 📊 Pattern DB updated: ${key} → ${currentType}`);
      }
    }

    // 8. Update pattern stats in DB for tracking
    const patternCount = await db.getPatternCount();
    console.log(`[${timestamp}] 📊 Total patterns: ${patternCount}`);

  } catch (error) {
    console.error(`[${timestamp}] ❌ Background worker error:`, error.message);
  }
}

// ================================================================
//  API ROUTES
// ================================================================

app.get('/api/game-result', async (req, res) => {
  try {
    const result = await fetchRealGameResult();
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'No real data available' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch' });
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
    console.error(e);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, possible_number, result, result_type, status, calculation } = req.body;
    await db.addHistory({
      period, prediction, possible_number,
      result, result_type, status, calculation
    });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
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

// Clear ONLY current history (Pattern DB stays)
app.post('/api/clear-history-only', async (req, res) => {
  try {
    await db.clearAllHistory();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Clear ALL (History + Pattern DB)
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
  res.json({
    status: 'ok',
    message: 'BLZ-AI Server running',
    gemini_key_set: !!GEMINI_KEY,
    background_worker: 'running (60s interval)'
  });
});

// ================================================================
//  START SERVER + BACKGROUND WORKER (24/7)
// ================================================================

// Run immediately on startup
setTimeout(() => {
  backgroundWorker();
}, 3000);

// Run every 60 seconds (24/7)
setInterval(backgroundWorker, 60000);

app.listen(PORT, () => {
  console.log(`🚀 BLZ-AI Server running on port ${PORT}`);
  console.log(`🔑 Gemini API Key set: ${!!GEMINI_KEY}`);
  console.log(`⏰ Background worker running every 60 seconds (24/7)`);
  console.log(`📊 Pattern DB: Unlimited storage`);
});
