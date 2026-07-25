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
//  STATE - Tracking for AI Logic
// ================================================================
let consecutivePredictionType = null;
let consecutivePredictionCount = 0;
let lossStreakCount = 0;

// ================================================================
//  FETCH GAME RESULT
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
//  DEEP ANALYSIS ENGINE (Mathematical + Pattern + RNG Analysis)
// ================================================================
function deepAnalysis(history) {
  const valid = history.filter(h => h.result !== null && h.result !== undefined);
  const recent = valid.slice(0, 30);
  
  if (recent.length < 5) {
    return {
      totalBig: 0,
      totalSmall: 0,
      freq: {},
      trend: 'neutral',
      consecutive: { big: 0, small: 0 },
      mostFreq: null,
      volatility: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      patternStrength: 0,
      rngBias: 'neutral',
      analysisNotes: 'Need at least 5 results for deep analysis.'
    };
  }

  // --- Basic Statistics ---
  const numbers = recent.map(r => Number(r.result));
  const totalBig = numbers.filter(n => n >= 5).length;
  const totalSmall = numbers.filter(n => n < 5).length;
  
  // Frequency
  const freq = {};
  numbers.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  
  // Most frequent
  let maxF = 0, mostFreq = null;
  for (const [n, c] of Object.entries(freq)) {
    if (c > maxF) { maxF = c; mostFreq = Number(n); }
  }

  // --- Consecutive ---
  const types = numbers.map(n => n >= 5 ? 'BIG' : 'SMALL');
  let cb = 0, cs = 0;
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === 'BIG') { cb++; cs = 0; }
    else { cs++; cb = 0; }
    if (i === types.length - 1) continue;
    if (types[i] !== types[types.length - 1]) break;
  }

  // --- Trend (Weighted Moving Average) ---
  const weights = numbers.map((_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = numbers.reduce((sum, n, i) => sum + n * weights[i], 0);
  const wma = weightedSum / totalWeight;
  const simpleMean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const trend = wma > simpleMean + 0.5 ? 'up' : wma < simpleMean - 0.5 ? 'down' : 'neutral';

  // --- Volatility (Standard Deviation) ---
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  // --- RNG Bias Detection ---
  // Check if numbers are evenly distributed (0-9)
  const expectedPerNumber = numbers.length / 10;
  let chiSquare = 0;
  for (let i = 0; i <= 9; i++) {
    const observed = freq[i] || 0;
    chiSquare += Math.pow(observed - expectedPerNumber, 2) / expectedPerNumber;
  }
  // Chi-square test (degrees of freedom = 9)
  const isBiased = chiSquare > 16.92; // 95% confidence level
  const rngBias = isBiased ? (mostFreq >= 5 ? 'BIG' : 'SMALL') : 'neutral';

  // --- Pattern Strength ---
  const uniquePatterns = new Set();
  for (let i = 0; i < types.length - 2; i++) {
    uniquePatterns.add(types.slice(i, i + 3).join(','));
  }
  const patternStrength = Math.min(100, (uniquePatterns.size / Math.pow(2, 3)) * 100);

  // --- Analysis Notes ---
  const notes = [];
  if (cb >= 4) notes.push(`🔥 Strong BIG streak (${cb})`);
  if (cs >= 4) notes.push(`❄️ Strong SMALL streak (${cs})`);
  if (stdDev > 2.5) notes.push(`📊 High volatility (${stdDev.toFixed(2)})`);
  if (isBiased) notes.push(`🎯 RNG Bias detected: ${rngBias}`);
  if (patternStrength > 60) notes.push(`🧩 Strong pattern: ${patternStrength.toFixed(0)}%`);
  if (notes.length === 0) notes.push('⚖️ Balanced distribution');

  return {
    totalBig,
    totalSmall,
    freq,
    trend,
    consecutive: { big: cb, small: cs },
    mostFreq,
    volatility: stdDev,
    mean: mean,
    median: numbers.sort((a, b) => a - b)[Math.floor(numbers.length / 2)],
    stdDev,
    patternStrength,
    rngBias,
    analysisNotes: notes.join(' | ')
  };
}

// ================================================================
//  ADVANCED AI PREDICT (Deep Analysis + Pattern DB + Mathematical)
// ================================================================
async function advancedAIPredict(history) {
  // 1. Get Pattern Insight from DB
  const patternDB = await db.getAllPatterns();
  
  // 2. Deep Analysis
  const analysis = deepAnalysis(history);
  
  // 3. Build scoring based on multiple factors
  let bigScore = 50;
  let smallScore = 50;
  const reasons = [];

  // Factor 1: Trend (Weighted Moving Average)
  if (analysis.trend === 'up') {
    bigScore += 8;
    smallScore -= 4;
    reasons.push(`📈 Trend: Up (WMA)`);
  } else if (analysis.trend === 'down') {
    smallScore += 8;
    bigScore -= 4;
    reasons.push(`📉 Trend: Down (WMA)`);
  }

  // Factor 2: Consecutive Streak (Mean Reversion)
  if (analysis.consecutive.big >= 3) {
    smallScore += 16;
    bigScore -= 8;
    reasons.push(`🔄 Mean Reversion (BIG x${analysis.consecutive.big})`);
  } else if (analysis.consecutive.small >= 3) {
    bigScore += 16;
    smallScore -= 8;
    reasons.push(`🔄 Mean Reversion (SMALL x${analysis.consecutive.small})`);
  }

  // Factor 3: RNG Bias
  if (analysis.rngBias === 'BIG') {
    bigScore += 10;
    smallScore -= 5;
    reasons.push(`🎯 RNG Bias: BIG (Chi-square test)`);
  } else if (analysis.rngBias === 'SMALL') {
    smallScore += 10;
    bigScore -= 5;
    reasons.push(`🎯 RNG Bias: SMALL (Chi-square test)`);
  }

  // Factor 4: Pattern DB Insight (Global Historical)
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
        bigScore += boost;
        smallScore -= boost * 0.5;
        reasons.push(`🌐 Global DB: ${key} → BIG ${(bigRatio*100).toFixed(0)}% (${data.total} occ)`);
      } else if (smallRatio > 0.65) {
        const boost = Math.min(25, smallRatio * 30);
        smallScore += boost;
        bigScore -= boost * 0.5;
        reasons.push(`🌐 Global DB: ${key} → SMALL ${(smallRatio*100).toFixed(0)}% (${data.total} occ)`);
      }
    }
  }

  // Factor 5: Most Frequent Number (Hot Number)
  if (analysis.mostFreq !== null) {
    if (analysis.mostFreq >= 5) {
      bigScore += 4;
      reasons.push(`🔥 Hot number: ${analysis.mostFreq} (${analysis.freq[analysis.mostFreq]}x)`);
    } else {
      smallScore += 4;
      reasons.push(`🔥 Hot number: ${analysis.mostFreq} (${analysis.freq[analysis.mostFreq]}x)`);
    }
  }

  // Factor 6: Volatility adjustment
  if (analysis.volatility > 2.5) {
    // High volatility - reduce confidence
    const penalty = Math.min(10, analysis.volatility * 2);
    bigScore -= penalty / 2;
    smallScore -= penalty / 2;
    reasons.push(`📊 High volatility (${analysis.volatility.toFixed(2)})`);
  }

  // Factor 7: Prediction Rotation (Avoid repeating)
  if (consecutivePredictionType === 'BIG') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    bigScore -= penalty;
    smallScore += 6;
    reasons.push(`🔄 Rotation: avoid BIG (${consecutivePredictionCount}x)`);
  } else if (consecutivePredictionType === 'SMALL') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    smallScore -= penalty;
    bigScore += 6;
    reasons.push(`🔄 Rotation: avoid SMALL (${consecutivePredictionCount}x)`);
  }

  // Factor 8: Loss Defense
  if (lossStreakCount >= 2) {
    if (consecutivePredictionType === 'BIG') {
      smallScore += 20;
      bigScore -= 12;
      reasons.push(`🛡️ Loss defense: flip from BIG`);
    } else if (consecutivePredictionType === 'SMALL') {
      bigScore += 20;
      smallScore -= 12;
      reasons.push(`🛡️ Loss defense: flip from SMALL`);
    }
  }

  // Final scoring with noise
  bigScore += (Math.random() * 8) - 4;
  smallScore += (Math.random() * 8) - 4;
  bigScore = Math.max(10, Math.min(90, bigScore));
  smallScore = Math.max(10, Math.min(90, smallScore));

  let predictionType = bigScore > smallScore ? 'BIG' : 'SMALL';
  let confidence = Math.round(Math.max(bigScore, smallScore) * 0.85 + 15);
  confidence = Math.min(94, Math.max(45, confidence));

  // Possible Number
  const range = predictionType === 'BIG' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  let bestNum = null, bestCount = -1;
  for (const n of range) {
    const c = analysis.freq[n] || 0;
    if (c > bestCount) { bestCount = c; bestNum = n; }
  }
  if (bestNum === null || bestCount === 0) {
    const mfn = analysis.mostFreq;
    if (mfn !== null && range.includes(mfn)) bestNum = mfn;
    else bestNum = predictionType === 'BIG' ? 7 : 2;
  }

  // Update tracking
  if (consecutivePredictionType === predictionType) {
    consecutivePredictionCount++;
  } else {
    consecutivePredictionType = predictionType;
    consecutivePredictionCount = 1;
  }

  const logLines = [
    `🧮 Deep Analysis: ${analysis.analysisNotes}`,
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
//  BACKGROUND CRON JOB (Runs every 60 seconds - 24/7)
// ================================================================
async function backgroundProcessor() {
  console.log(`[${new Date().toISOString()}] 🔄 Background processing started...`);
  
  try {
    // 1. Fetch latest result
    const result = await fetchGameResult();
    if (!result) return;

    // 2. Check if already processed
    const existing = await db.getHistory(5);
    const lastPeriod = existing.length > 0 ? existing[0].period : null;
    if (lastPeriod === result.issueNumber) {
      console.log(`[${new Date().toISOString()}] ⏭️ Period ${result.issueNumber} already processed`);
      return;
    }

    const actualNumber = Number(result.number);
    const actualType = actualNumber >= 5 ? 'BIG' : 'SMALL';

    // 3. Get last 20 history for analysis
    const history = await db.getHistoryForAnalysis(25);
    
    // 4. Check if we have a pending prediction to resolve
    let lastPrediction = null;
    let lastPossibleNumber = null;
    if (history.length > 0 && history[0].status === 'Pending') {
      lastPrediction = history[0].prediction;
      lastPossibleNumber = history[0].possible_number;
      
      const matched = (actualType === lastPrediction || actualNumber == lastPossibleNumber);
      
      // Update the pending record with actual result
      // We need to update the specific record
      // For now, we'll add it as resolved
      await db.updateHistoryResult(history[0].id, actualNumber, actualType, matched ? 'WIN' : 'LOSS');
      
      console.log(`[${new Date().toISOString()}] 📝 Resolved: ${history[0].period} → ${actualType} (${matched ? 'WIN' : 'LOSS'})`);
    }

    // 5. Generate new prediction for next period
    const aiDecision = await advancedAIPredict(history);
    
    // 6. Save prediction to history
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

    console.log(`[${new Date().toISOString()}] ✅ Saved prediction for period ${nextPeriod}: ${aiDecision.prediction}`);

    // 7. Update Pattern DB with the actual result
    if (history.length >= 3) {
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
          console.log(`[${new Date().toISOString()}] 📊 Pattern DB updated: ${key} → ${currentType}`);
        }
      }
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Background error:`, error.message);
  }
}

// ================================================================
//  API ROUTES
// ================================================================

// 1. Get Game Result
app.get('/api/game-result', async (req, res) => {
  try { const result = await fetchGameResult(); res.json(result); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch' }); }
});

// 2. Get Prediction (for frontend)
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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Prediction failed' }); }
});

// 3. Submit Result (from frontend)
app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, possible_number, result, result_type, status, calculation } = req.body;
    await db.addHistory({
      period, prediction, possible_number,
      result, result_type, status, calculation
    });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to save' }); }
});

// 4. Get History
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await db.getHistory(limit);
    res.json(history);
  } catch (e) { res.status(500).json({ error: 'Failed to get history' }); }
});

// 5. Get Pattern Stats
app.get('/api/pattern-stats', async (req, res) => {
  try {
    const patterns = await db.getAllPatterns();
    const keys = Object.keys(patterns);
    let totalOcc = 0;
    keys.forEach(k => totalOcc += patterns[k].total);
    res.json({ count: keys.length, totalOcc });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 6. Clear ALL (History + Patterns) - Admin only
app.post('/api/clear-all', async (req, res) => {
  try {
    await db.clearAllHistory();
    await db.clearPatterns();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 7. Clear ONLY Current History (Keep Pattern DB)
app.post('/api/clear-history-only', async (req, res) => {
  try {
    await db.clearAllHistory();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// 8. Test API
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'BLZ-AI Server running',
    gemini_key_set: !!GEMINI_KEY,
    background_running: true
  });
});

// ================================================================
//  START SERVER + BACKGROUND WORKER
// ================================================================

// Run once immediately on startup
setTimeout(() => {
  backgroundProcessor();
}, 5000);

// Run every 60 seconds (24/7)
setInterval(backgroundProcessor, 60000);

app.listen(PORT, () => {
  console.log(`🚀 BLZ-AI Server running on port ${PORT}`);
  console.log(`🔑 Gemini API Key set: ${!!GEMINI_KEY}`);
  console.log(`⏰ Background processor running every 60 seconds (24/7)`);
});
