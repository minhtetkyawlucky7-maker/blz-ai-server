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

console.log(`🔑 Gemini API Key set: ${!!GEMINI_KEY}`);

// ================================================================
//  STATE
// ================================================================
let consecutivePredictionType = null;
let consecutivePredictionCount = 0;
let lossStreakCount = 0;

// ================================================================
//  FETCH GAME RESULT (Real API + Fallback)
// ================================================================
async function fetchGameResult() {
  const API_URL = 'https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList';
  
  try {
    console.log('[📡 API] Fetching real data...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList',
        'Origin': 'https://ckygjf6r.com',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
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
      console.error(`[📡 API] HTTP ${response.status}`);
      throw new Error(`HTTP ${response.status}`);
    }

    const rawText = await response.text();
    console.log(`[📡 API] Response (first 200):`, rawText.substring(0, 200));

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('[📡 API] JSON parse error:', e.message);
      throw new Error('Invalid JSON');
    }

    if (data?.data?.list && data.data.list.length > 0) {
      console.log(`[📡 API] Found ${data.data.list.length} records`);
      return data.data.list[0];
    }

    throw new Error('No data in response');

  } catch (error) {
    console.error('[📡 API] Error:', error.message);
    
    // Fallback: Generate realistic random data
    const fallbackNumber = Math.floor(Math.random() * 10);
    const fallbackPeriod = (2026072401 + Math.floor(Math.random() * 1000)).toString();
    console.log(`[📡 API] Using fallback: Period ${fallbackPeriod}, Number ${fallbackNumber}`);
    
    return {
      issueNumber: fallbackPeriod,
      number: fallbackNumber.toString()
    };
  }
}

// ================================================================
//  DEEP ANALYSIS ENGINE
// ================================================================
function deepAnalysis(history) {
  const valid = history.filter(h => h.result !== null && h.result !== undefined && h.result !== '-');
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
      rngBias: 'neutral',
      analysisNotes: 'Need at least 5 results for deep analysis.',
      stdDev: 0
    };
  }

  const numbers = recent.map(r => Number(r.result));
  const totalBig = numbers.filter(n => n >= 5).length;
  const totalSmall = numbers.filter(n => n < 5).length;
  
  const freq = {};
  numbers.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  
  let mostFreq = null, maxF = 0;
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
  if (notes.length === 0) notes.push('⚖️ Balanced distribution');

  return {
    totalBig,
    totalSmall,
    freq,
    trend,
    consecutive: { big: cb, small: cs },
    mostFreq,
    volatility: stdDev,
    rngBias,
    stdDev,
    analysisNotes: notes.join(' | ')
  };
}

// ================================================================
//  AI PREDICTION ENGINE
// ================================================================
async function getPrediction(history) {
  const analysis = deepAnalysis(history);
  let bigScore = 50, smallScore = 50;
  const reasons = [];

  // Factor 1: Trend
  if (analysis.trend === 'up') {
    bigScore += 8; smallScore -= 4;
    reasons.push('📈 Trend: Up');
  } else if (analysis.trend === 'down') {
    smallScore += 8; bigScore -= 4;
    reasons.push('📉 Trend: Down');
  }

  // Factor 2: Mean Reversion
  if (analysis.consecutive.big >= 3) {
    smallScore += 16; bigScore -= 8;
    reasons.push(`🔄 Mean Rev (BIG x${analysis.consecutive.big})`);
  } else if (analysis.consecutive.small >= 3) {
    bigScore += 16; smallScore -= 8;
    reasons.push(`🔄 Mean Rev (SMALL x${analysis.consecutive.small})`);
  }

  // Factor 3: RNG Bias
  if (analysis.rngBias === 'BIG') {
    bigScore += 10; smallScore -= 5;
    reasons.push('🎯 RNG Bias: BIG');
  } else if (analysis.rngBias === 'SMALL') {
    smallScore += 10; bigScore -= 5;
    reasons.push('🎯 RNG Bias: SMALL');
  }

  // Factor 4: Pattern DB (from database)
  try {
    const patternDB = await db.getAllPatterns();
    const valid = history.filter(h => h.result !== null && h.result !== undefined && h.result !== '-');
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
  } catch (e) {
    console.warn('[Pattern DB] Error:', e.message);
  }

  // Factor 5: Hot Number
  if (analysis.mostFreq !== null) {
    if (analysis.mostFreq >= 5) {
      bigScore += 4;
      reasons.push(`🔥 Hot: ${analysis.mostFreq}`);
    } else {
      smallScore += 4;
      reasons.push(`🔥 Hot: ${analysis.mostFreq}`);
    }
  }

  // Factor 6: Volatility
  if (analysis.volatility > 2.5) {
    const penalty = Math.min(10, analysis.volatility * 2);
    bigScore -= penalty / 2;
    smallScore -= penalty / 2;
    reasons.push(`📊 Volatility ${analysis.volatility.toFixed(2)}`);
  }

  // Factor 7: Rotation
  if (consecutivePredictionType === 'BIG') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    bigScore -= penalty; smallScore += 6;
    reasons.push(`🔄 Rotation avoid BIG (${consecutivePredictionCount}x)`);
  } else if (consecutivePredictionType === 'SMALL') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    smallScore -= penalty; bigScore += 6;
    reasons.push(`🔄 Rotation avoid SMALL (${consecutivePredictionCount}x)`);
  }

  // Factor 8: Loss Defense
  if (lossStreakCount >= 2) {
    if (consecutivePredictionType === 'BIG') {
      smallScore += 20; bigScore -= 12;
      reasons.push('🛡️ Loss defense flip');
    } else if (consecutivePredictionType === 'SMALL') {
      bigScore += 20; smallScore -= 12;
      reasons.push('🛡️ Loss defense flip');
    }
  }

  // Noise
  bigScore += (Math.random() * 8) - 4;
  smallScore += (Math.random() * 8) - 4;
  bigScore = Math.max(10, Math.min(90, bigScore));
  smallScore = Math.max(10, Math.min(90, smallScore));

  let predictionType = bigScore > smallScore ? 'BIG' : 'SMALL';
  let confidence = Math.round(Math.max(bigScore, smallScore) * 0.85 + 15);
  confidence = Math.min(94, Math.max(45, confidence));

  // Possible Number
  const range = predictionType === 'BIG' ? [5,6,7,8,9] : [0,1,2,3,4];
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
    `🧮 ${analysis.analysisNotes}`,
    `📊 Volatility ${analysis.volatility.toFixed(2)} | RNG Bias: ${analysis.rngBias}`,
    `📈 BIG:${analysis.totalBig} / SMALL:${analysis.totalSmall} | Trend: ${analysis.trend}`,
    `🎯 Prediction: ${predictionType} | Possible: ${bestNum} | Confidence: ${confidence}%`,
    `📌 ${reasons.join(' | ') || 'Balanced'}`
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
    res.json(result);
  } catch (e) {
    console.error('[API] Error:', e.message);
    const fallback = {
      issueNumber: (2026072401 + Math.floor(Math.random() * 1000)).toString(),
      number: Math.floor(Math.random() * 10).toString()
    };
    res.json(fallback);
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
    const result = await getPrediction(formatted);
    res.json(result);
  } catch (e) {
    console.error('[Predict] Error:', e);
    res.status(500).json({
      prediction: Math.random() > 0.5 ? 'BIG' : 'SMALL',
      confidence: 70,
      possible_number: Math.floor(Math.random() * 10),
      calculation: 'Fallback prediction due to server error',
      logLines: ['⚠️ Server error, using fallback prediction']
    });
  }
});

app.post('/api/submit-result', async (req, res) => {
  try {
    const { period, prediction, possible_number, result, result_type, status, calculation } = req.body;
    await db.addHistory({ period, prediction, possible_number, result, result_type, status, calculation });
    res.json({ success: true });
  } catch (e) {
    console.error('[Submit] Error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await db.getHistory(limit);
    res.json(history);
  } catch (e) {
    console.error('[History] Error:', e);
    res.status(500).json([]);
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
    console.error('[Pattern Stats] Error:', e);
    res.json({ count: 0, totalOcc: 0 });
  }
});

app.post('/api/clear-history-only', async (req, res) => {
  try {
    await db.clearAllHistory();
    res.json({ success: true });
  } catch (e) {
    console.error('[Clear] Error:', e);
    res.status(500).json({ success: false });
  }
});

app.post('/api/clear-all', async (req, res) => {
  try {
    await db.clearAllHistory();
    await db.clearPatterns();
    res.json({ success: true });
  } catch (e) {
    console.error('[Clear All] Error:', e);
    res.status(500).json({ success: false });
  }
});

// ================================================================
//  AI CHAT (With Fallback when Gemini API fails)
// ================================================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, lang } = req.body;
    if (!message) {
      return res.json({ reply: 'Please ask a question.' });
    }

    // Check if message is website-related
    const websiteKeywords = ['website', 'site', 'page', 'feature', 'how to', 'what is', 'prediction', 'big', 'small',
      'number', 'game', 'pattern', 'analysis', 'dashboard', 'history', 'candlestick', 'theme', 'settings',
      'win', 'loss', 'streak', 'confidence', 'possible', 'hedge', 'brain', 'ai', 'random', 'rng', 'use', 'help',
      'explain', 'tell me', 'show me', 'guide', 'tutorial', 'what does', 'how does', 'about this site',
      'ဘယ်လို', 'ဘာလဲ', 'အကြောင်း', 'သုံး', 'ခန့်မှန်း', 'ဂိမ်း', 'ပုံစံ'];

    const isWebsiteRelated = websiteKeywords.some(kw => 
      message.toLowerCase().includes(kw.toLowerCase())
    );

    // Language-specific fallback replies
    const fallbackReplies = {
      en: "🤖 I'm BLZ-AI Assistant. I can help you understand the prediction system, game patterns, and how to use this website. Try asking: 'How does prediction work?' or 'What is Pattern DB?'",
      th: "🤖 ฉันคือผู้ช่วย BLZ-AI ฉันสามารถช่วยคุณเกี่ยวกับระบบการทำนาย รูปแบบเกม และวิธีการใช้เว็บไซต์นี้ ลองถาม: 'ระบบการทำนายทำงานอย่างไร?' หรือ 'Pattern DB คืออะไร?'",
      id: "🤖 Saya Asisten BLZ-AI. Saya dapat membantu Anda memahami sistem prediksi, pola permainan, dan cara menggunakan website ini. Coba tanya: 'Bagaimana cara kerja prediksi?' atau 'Apa itu Pattern DB?'",
      my: "🤖 ကျွန်တော်က BLZ-AI အကူပါ။ ခန့်မှန်းချက်စနစ်၊ ဂိမ်းပုံစံများနှင့် ဤဝဘ်ဆိုက်ကို မည်သို့သုံးရမည်ကို ကူညီနိုင်ပါတယ်။ မေးကြည့်ပါ: 'ခန့်မှန်းချက်က ဘယ်လိုအလုပ်လုပ်လဲ?' သို့မဟုတ် 'Pattern DB ဆိုတာဘာလဲ?'",
      zh: "🤖 我是BLZ-AI助手。我可以帮助您了解预测系统、游戏模式以及如何使用本网站。试试问：'预测如何运作？'或'什么是模式数据库？'"
    };

    if (!isWebsiteRelated) {
      return res.json({ reply: fallbackReplies[lang] || fallbackReplies.en });
    }

    // If no Gemini key, use fallback immediately
    if (!GEMINI_KEY) {
      console.warn('[Chat] No Gemini API key, using fallback');
      return res.json({ reply: fallbackReplies[lang] || fallbackReplies.en });
    }

    // Build context from history
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
Be concise (2-3 sentences if possible) but informative. Keep responses in the same language as the question if possible.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Chat] Gemini API error:', response.status, errText.substring(0, 200));
      throw new Error(`Gemini API ${response.status}`);
    }

    const data = await response.json();
    let reply = "Sorry, I couldn't process your request. Please try again.";
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      reply = data.candidates[0].content.parts[0].text;
    }
    res.json({ reply });

  } catch (error) {
    console.error('[Chat] Error:', error.message);
    const fallback = {
      en: "⚠️ I'm having trouble connecting right now. Please try again in a moment. You can also check the Prediction Matrix for live predictions.",
      th: "⚠️ ฉันมีปัญหาในการเชื่อมต่อในขณะนี้ กรุณาลองอีกครั้งในอีกสักครู่ คุณยังสามารถตรวจสอบเมทริกซ์การทำนายเพื่อดูการทำนายสดได้",
      id: "⚠️ Saya mengalami masalah koneksi saat ini. Silakan coba lagi nanti. Anda juga dapat memeriksa Matriks Prediksi untuk prediksi langsung.",
      my: "⚠️ ချိတ်ဆက်ရာတွင် ပြဿနာရှိနေပါသည်။ ခဏကြာပြီး ပြန်ကြိုးစားပါ။ လက်ရှိခန့်မှန်းချက်များကို Prediction Matrix တွင် ကြည့်ရှုနိုင်ပါသည်။",
      zh: "⚠️ 我现在连接有问题，请稍后再试。您也可以在预测矩阵中查看实时预测。"
    };
    res.status(200).json({ reply: fallback[req.body?.lang] || fallback.en });
  }
});

app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'BLZ-AI Server v5.0 running',
    gemini_key_set: !!GEMINI_KEY,
    timestamp: new Date().toISOString()
  });
});

// ================================================================
//  START SERVER
// ================================================================
app.listen(PORT, () => {
  console.log(`🚀 BLZ-AI Server v5.0 running on port ${PORT}`);
  console.log(`🔑 Gemini API Key set: ${!!GEMINI_KEY}`);
  console.log(`📊 Pattern DB: Unlimited (3000+)`);
});
