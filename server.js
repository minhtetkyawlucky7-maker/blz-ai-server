require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// CORS
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.static('public'));

// ================================================================
//  FETCH GAME RESULT (Real API)
// ================================================================
async function fetchGameResult() {
  const API_URL = 'https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList';
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList',
        'Origin': 'https://ckygjf6r.com',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        pageSize: 10, pageNo: 1, typeId: 1, language: 0,
        random: '69b04bcd437f496c8c97e763af16ba03',
        signature: '10BDFF509233B671B9DB6C661F1DC2F3',
        timestamp: Math.floor(Date.now() / 1000)
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data?.data?.list?.[0]) return data.data.list[0];
    throw new Error('No data');
  } catch (e) {
    console.error('[API] Error:', e.message);
    return null;
  }
}

// ================================================================
//  AI PREDICTION ENGINE (for /api/predict)
// ================================================================
let consecutivePredictionType = null;
let consecutivePredictionCount = 0;
let lossStreakCount = 0;

function deepAnalysis(history) {
  const valid = history.filter(h => h.result !== null && h.result !== undefined);
  const recent = valid.slice(0, 30);
  if (recent.length < 5) {
    return { totalBig: 0, totalSmall: 0, freq: {}, trend: 'neutral', consecutive: { big: 0, small: 0 },
      mostFreq: null, volatility: 0, rngBias: 'neutral', analysisNotes: 'Need more data' };
  }
  const numbers = recent.map(r => Number(r.result));
  const totalBig = numbers.filter(n => n >= 5).length;
  const totalSmall = numbers.filter(n => n < 5).length;
  const freq = {};
  numbers.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  let mostFreq = null, maxF = 0;
  for (const [n, c] of Object.entries(freq)) if (c > maxF) { maxF = c; mostFreq = Number(n); }
  const types = numbers.map(n => n >= 5 ? 'BIG' : 'SMALL');
  let cb = 0, cs = 0;
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === 'BIG') { cb++; cs = 0; } else { cs++; cb = 0; }
    if (i === types.length - 1) continue;
    if (types[i] !== types[types.length - 1]) break;
  }
  const weights = numbers.map((_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = numbers.reduce((sum, n, i) => sum + n * weights[i], 0);
  const wma = weightedSum / totalWeight;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const trend = wma > mean + 0.5 ? 'up' : wma < mean - 0.5 ? 'down' : 'neutral';
  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);
  const expected = numbers.length / 10;
  let chiSquare = 0;
  for (let i = 0; i <= 9; i++) {
    const observed = freq[i] || 0;
    chiSquare += Math.pow(observed - expected, 2) / expected;
  }
  const isBiased = chiSquare > 16.92;
  const rngBias = isBiased ? (mostFreq >= 5 ? 'BIG' : 'SMALL') : 'neutral';
  const notes = [];
  if (cb >= 4) notes.push(`🔥 BIG streak (${cb})`);
  if (cs >= 4) notes.push(`❄️ SMALL streak (${cs})`);
  if (stdDev > 2.5) notes.push(`📊 High volatility (${stdDev.toFixed(2)})`);
  if (isBiased) notes.push(`🎯 RNG Bias: ${rngBias}`);
  if (notes.length === 0) notes.push('⚖️ Balanced');
  return { totalBig, totalSmall, freq, trend, consecutive: { big: cb, small: cs }, mostFreq, volatility: stdDev,
    rngBias, analysisNotes: notes.join(' | ') };
}

async function getPrediction(history) {
  const analysis = deepAnalysis(history);
  let bigScore = 50, smallScore = 50, reasons = [];
  const { totalBig, totalSmall, trend, consecutive, mostFreq, freq, rngBias, volatility } = analysis;
  if (trend === 'up') { bigScore += 8; smallScore -= 4; reasons.push('📈 Trend: Up'); }
  else if (trend === 'down') { smallScore += 8; bigScore -= 4; reasons.push('📉 Trend: Down'); }
  if (consecutive.big >= 3) { smallScore += 16; bigScore -= 8; reasons.push(`🔄 Mean Rev (BIG x${consecutive.big})`); }
  else if (consecutive.small >= 3) { bigScore += 16; smallScore -= 8; reasons.push(`🔄 Mean Rev (SMALL x${consecutive.small})`); }
  if (rngBias === 'BIG') { bigScore += 10; smallScore -= 5; reasons.push('🎯 RNG Bias: BIG'); }
  else if (rngBias === 'SMALL') { smallScore += 10; bigScore -= 5; reasons.push('🎯 RNG Bias: SMALL'); }

  // Pattern DB boost (from db)
  const patternDB = await db.getAllPatterns();
  const valid = history.filter(h => h.result !== null && h.result !== undefined);
  if (valid.length >= 3) {
    const lastThree = valid.slice(0, 3).map(r => Number(r.result) >= 5 ? 'BIG' : 'SMALL');
    if (lastThree.length === 3) {
      const key = lastThree.join(',');
      const data = patternDB[key];
      if (data && data.total >= 3) {
        const bigRatio = data.nextBig / data.total;
        const smallRatio = data.nextSmall / data.total;
        if (bigRatio > 0.65) {
          const boost = Math.min(25, bigRatio * 30);
          bigScore += boost; smallScore -= boost * 0.5;
          reasons.push(`🌐 Pattern DB: BIG ${(bigRatio*100).toFixed(0)}%`);
        } else if (smallRatio > 0.65) {
          const boost = Math.min(25, smallRatio * 30);
          smallScore += boost; bigScore -= boost * 0.5;
          reasons.push(`🌐 Pattern DB: SMALL ${(smallRatio*100).toFixed(0)}%`);
        }
      }
    }
  }

  if (mostFreq !== null) {
    if (mostFreq >= 5) { bigScore += 4; reasons.push(`🔥 Hot: ${mostFreq}`); }
    else { smallScore += 4; reasons.push(`🔥 Hot: ${mostFreq}`); }
  }
  if (volatility > 2.5) {
    const penalty = Math.min(10, volatility * 2);
    bigScore -= penalty / 2; smallScore -= penalty / 2;
    reasons.push(`📊 Volatility ${volatility.toFixed(2)}`);
  }
  if (consecutivePredictionType === 'BIG') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    bigScore -= penalty; smallScore += 6;
    reasons.push(`🔄 Rotation avoid BIG (${consecutivePredictionCount}x)`);
  } else if (consecutivePredictionType === 'SMALL') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    smallScore -= penalty; bigScore += 6;
    reasons.push(`🔄 Rotation avoid SMALL (${consecutivePredictionCount}x)`);
  }
  if (lossStreakCount >= 2) {
    if (consecutivePredictionType === 'BIG') { smallScore += 20; bigScore -= 12; reasons.push('🛡️ Loss defense flip'); }
    else if (consecutivePredictionType === 'SMALL') { bigScore += 20; smallScore -= 12; reasons.push('🛡️ Loss defense flip'); }
  }
  bigScore += (Math.random() * 8) - 4;
  smallScore += (Math.random() * 8) - 4;
  bigScore = Math.max(10, Math.min(90, bigScore));
  smallScore = Math.max(10, Math.min(90, smallScore));
  let predictionType = bigScore > smallScore ? 'BIG' : 'SMALL';
  let confidence = Math.round(Math.max(bigScore, smallScore) * 0.85 + 15);
  confidence = Math.min(94, Math.max(45, confidence));

  const range = predictionType === 'BIG' ? [5,6,7,8,9] : [0,1,2,3,4];
  let bestNum = null, bestCount = -1;
  for (const n of range) {
    const c = freq[n] || 0;
    if (c > bestCount) { bestCount = c; bestNum = n; }
  }
  if (bestNum === null || bestCount === 0) {
    const mfn = mostFreq;
    if (mfn !== null && range.includes(mfn)) bestNum = mfn;
    else bestNum = predictionType === 'BIG' ? 7 : 2;
  }
  if (consecutivePredictionType === predictionType) consecutivePredictionCount++;
  else { consecutivePredictionType = predictionType; consecutivePredictionCount = 1; }

  const logLines = [
    `🧮 ${analysis.analysisNotes}`,
    `📊 Volatility ${analysis.volatility.toFixed(2)} | RNG Bias: ${analysis.rngBias}`,
    `📈 BIG:${analysis.totalBig} / SMALL:${analysis.totalSmall} | Trend: ${analysis.trend}`,
    `🎯 Prediction: ${predictionType} | Possible: ${bestNum} | Confidence: ${confidence}%`,
    `📌 ${reasons.join(' | ')}`
  ];
  return {
    prediction: predictionType,
    confidence,
    possible_number: bestNum,
    calculation: logLines.join(' | '),
    logLines
  };
}

// ================================================================
//  API ROUTES
// ================================================================

app.get('/api/game-result', async (req, res) => {
  try {
    const result = await fetchGameResult();
    if (!result) return res.status(503).json({ error: 'No data' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
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
    const result = await getPrediction(formatted);
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Prediction failed' }); }
});

app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, possible_number, result, result_type, status, calculation } = req.body;
    await db.addHistory({ period, prediction, possible_number, result, result_type, status, calculation });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Save failed' }); }
});

app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await db.getHistory(limit);
    res.json(history);
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/pattern-stats', async (req, res) => {
  try {
    const patterns = await db.getAllPatterns();
    const keys = Object.keys(patterns);
    let totalOcc = 0;
    keys.forEach(k => totalOcc += patterns[k].total);
    res.json({ count: keys.length, totalOcc });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/clear-all', async (req, res) => {
  try { await db.clearAllHistory(); await db.clearPatterns(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/clear-history-only', async (req, res) => {
  try { await db.clearAllHistory(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ================================================================
//  AI CHAT (Website-only questions)
// ================================================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, lang } = req.body;
    if (!message) return res.json({ reply: 'Please ask a question.' });

    // Check if message is website-related
    const websiteKeywords = ['website', 'site', 'page', 'feature', 'how to', 'what is', 'prediction', 'big', 'small',
      'number', 'game', 'pattern', 'analysis', 'dashboard', 'history', 'candlestick', 'theme', 'settings',
      'win', 'loss', 'streak', 'confidence', 'possible', 'hedge', 'brain', 'ai', 'random', 'rng', 'use', 'help',
      'explain', 'tell me', 'show me', 'guide', 'tutorial', 'what does', 'how does'];
    const isWebsiteRelated = websiteKeywords.some(kw => message.toLowerCase().includes(kw.toLowerCase()));

    const langReplies = {
      en: "🤖 I'm a specialized assistant for this BLZ-AI prediction website. I can only answer questions about the website features, prediction system, game analysis, and how to use this tool. Please ask me about the website!",
      th: "🤖 ฉันเป็นผู้ช่วยเฉพาะสำหรับเว็บไซต์ทำนาย BLZ-AI นี้ ฉันสามารถตอบคำถามเกี่ยวกับฟีเจอร์ของเว็บไซต์ ระบบการทำนาย การวิเคราะห์เกม และวิธีการใช้เครื่องมือนี้เท่านั้น กรุณาถามฉันเกี่ยวกับเว็บไซต์!",
      id: "🤖 Saya adalah asisten khusus untuk situs web prediksi BLZ-AI ini. Saya hanya dapat menjawab pertanyaan tentang fitur situs web, sistem prediksi, analisis permainan, dan cara menggunakan alat ini. Tolong tanyakan tentang situs web!",
      my: "🤖 ကျွန်တော်က ဒီ BLZ-AI ခန့်မှန်းချက်ဝဘ်ဆိုက်အတွက် အထူးပြုအကူပါ။ ဝဘ်ဆိုက်အင်္ဂါရပ်များ၊ ခန့်မှန်းချက်စနစ်၊ ဂိမ်းခွဲခြမ်းစိတ်ဖြာမှုနှင့် ဤကိရိယာကို မည်သို့အသုံးပြုရမည်အကြောင်းကိုသာ ဖြေနိုင်ပါတယ်။ ဝဘ်ဆိုက်အကြောင်း မေးပါ။",
      zh: "🤖 我是这个BLZ-AI预测网站的专用助手。我只能回答关于网站功能、预测系统、游戏分析和如何使用这个工具的问题。请问我关于网站的问题！"
    };
    if (!isWebsiteRelated) {
      return res.json({ reply: langReplies[lang] || langReplies.en });
    }

    // Build context
    const recentResults = history.slice(0, 10).map(h =>
      `Period ${h.period}: Predicted ${h.prediction}, Result ${h.result !== '-' ? h.result + ' (' + h.resultType + ')' : 'Pending'}`
    ).join('\n');

    const prompt = `You are BLZ-AI, a helpful assistant for a Big/Small prediction website. 
Your job is to help users understand and use the website features.

Website features:
- Real-time Big/Small predictions using AI
- Pattern Database that learns from historical results (3000+ patterns)
- Deep mathematical analysis (WMA, Standard Deviation, RNG bias detection)
- Candlestick chart showing number sequences
- Accuracy dashboard with win/loss tracking
- Multi-language support (English, Thai, Indonesian, Burmese, Chinese)
- AI chat assistant (you!)

Current user's question: "${message}"

Recent prediction history:
${recentResults}

Please provide a helpful, friendly response that answers the user's question about the website. 
Be concise but informative. Keep responses in the same language as the question if possible.`;

    if (!GEMINI_KEY) {
      console.warn('[Chat] No Gemini API key, using fallback.');
      return res.json({ reply: "I'm sorry, the AI service is currently unavailable. Please try again later." });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 350 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Chat] Gemini API error:', errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    let reply = "Sorry, I couldn't process your request. Please try again.";
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      reply = data.candidates[0].content.parts[0].text;
    }
    res.json({ reply });
  } catch (error) {
    console.error('[Chat] Error:', error);
    const fallback = {
      en: "⚠️ I'm having trouble connecting right now. Please try again in a moment.",
      th: "⚠️ ฉันมีปัญหาในการเชื่อมต่อในขณะนี้ กรุณาลองอีกครั้งในอีกสักครู่",
      id: "⚠️ Saya mengalami masalah koneksi saat ini. Silakan coba lagi nanti.",
      my: "⚠️ ချိတ်ဆက်ရာတွင် ပြဿနာရှိနေပါသည်။ ခဏကြာပြီး ပြန်ကြိုးစားပါ။",
      zh: "⚠️ 我现在连接有问题，请稍后再试。"
    };
    res.status(500).json({ reply: fallback[req.body?.lang] || fallback.en });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'BLZ-AI Server running', gemini_key_set: !!GEMINI_KEY });
});

// ================================================================
//  START SERVER
// ================================================================
app.listen(PORT, () => {
  console.log(`🚀 BLZ-AI Server running on port ${PORT}`);
  console.log(`🔑 Gemini API Key set: ${!!GEMINI_KEY}`);
});
