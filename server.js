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
let thinkingLogs = [];

// ================================================================
//  FETCH GAME RESULT - REAL API ONLY (No Fallback)
// ================================================================
async function fetchGameResult() {
  const API_URL = 'https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList';
  
  try {
    addThinkingLog('🌐', 'Fetching real data from API...');
    
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
      const text = await response.text();
      addThinkingLog('❌', `API Error ${response.status}: ${text.substring(0, 100)}`);
      throw new Error(`API responded with status ${response.status}`);
    }

    const rawText = await response.text();
    const data = JSON.parse(rawText);
    
    if (data?.data?.list && data.data.list.length > 0) {
      addThinkingLog('✅', `Real data received: Period ${data.data.list[0].issueNumber}`);
      return data.data.list[0];
    }
    
    addThinkingLog('⚠️', 'No data in API response');
    return null;

  } catch (error) {
    addThinkingLog('❌', `API Error: ${error.message}`);
    console.error('[Real API] Error:', error.message);
    return null;
  }
}

// ================================================================
//  AI THINKING LOGS
// ================================================================
function addThinkingLog(icon, message) {
  const timestamp = new Date().toISOString();
  const log = { timestamp, icon, message };
  thinkingLogs.unshift(log);
  if (thinkingLogs.length > 100) thinkingLogs.pop();
  console.log(`[AI Think] ${icon} ${message}`);
}

function getThinkingLogs() {
  return thinkingLogs;
}

// ================================================================
//  DEEP ANALYSIS ENGINE (Mathematical + Pattern + RNG Analysis)
// ================================================================
function deepAnalysis(history) {
  addThinkingLog('🧮', 'Starting deep mathematical analysis...');
  
  const valid = history.filter(h => h.result !== null && h.result !== undefined);
  const recent = valid.slice(0, 30);
  
  if (recent.length < 5) {
    addThinkingLog('⚠️', 'Insufficient data for deep analysis (need 5+ results)');
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

  // Consecutive
  const types = numbers.map(n => n >= 5 ? 'BIG' : 'SMALL');
  let cb = 0, cs = 0;
  for (let i = types.length - 1; i >= 0; i--) {
    if (types[i] === 'BIG') { cb++; cs = 0; }
    else { cs++; cb = 0; }
    if (i === types.length - 1) continue;
    if (types[i] !== types[types.length - 1]) break;
  }

  // Weighted Moving Average
  const weights = numbers.map((_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = numbers.reduce((sum, n, i) => sum + n * weights[i], 0);
  const wma = weightedSum / totalWeight;
  const simpleMean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const trend = wma > simpleMean + 0.5 ? 'up' : wma < simpleMean - 0.5 ? 'down' : 'neutral';

  // Standard Deviation
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  // RNG Bias Detection (Chi-square test)
  const expectedPerNumber = numbers.length / 10;
  let chiSquare = 0;
  for (let i = 0; i <= 9; i++) {
    const observed = freq[i] || 0;
    chiSquare += Math.pow(observed - expectedPerNumber, 2) / expectedPerNumber;
  }
  const isBiased = chiSquare > 16.92;
  const rngBias = isBiased ? (mostFreq >= 5 ? 'BIG' : 'SMALL') : 'neutral';

  // Pattern Strength
  const uniquePatterns = new Set();
  for (let i = 0; i < types.length - 2; i++) {
    uniquePatterns.add(types.slice(i, i + 3).join(','));
  }
  const patternStrength = Math.min(100, (uniquePatterns.size / Math.pow(2, 3)) * 100);

  const notes = [];
  if (cb >= 4) notes.push(`🔥 Strong BIG streak (${cb})`);
  if (cs >= 4) notes.push(`❄️ Strong SMALL streak (${cs})`);
  if (stdDev > 2.5) notes.push(`📊 High volatility (${stdDev.toFixed(2)})`);
  if (isBiased) notes.push(`🎯 RNG Bias detected: ${rngBias}`);
  if (patternStrength > 60) notes.push(`🧩 Strong pattern: ${patternStrength.toFixed(0)}%`);
  if (notes.length === 0) notes.push('⚖️ Balanced distribution');

  addThinkingLog('📊', `Analysis: BIG=${totalBig}, SMALL=${totalSmall}, Trend=${trend}, Volatility=${stdDev.toFixed(2)}`);

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
  addThinkingLog('🧠', 'Starting AI prediction process...');
  
  const patternDB = await db.getAllPatterns();
  addThinkingLog('📚', `Pattern DB loaded: ${Object.keys(patternDB).length} patterns`);
  
  const analysis = deepAnalysis(history);
  
  let bigScore = 50;
  let smallScore = 50;
  const reasons = [];

  addThinkingLog('⚖️', `Initial scores: BIG=${bigScore}, SMALL=${smallScore}`);

  // Factor 1: Trend (Weighted Moving Average)
  if (analysis.trend === 'up') {
    bigScore += 8;
    smallScore -= 4;
    reasons.push(`📈 Trend: Up (WMA)`);
    addThinkingLog('📈', 'Upward trend detected - favoring BIG');
  } else if (analysis.trend === 'down') {
    smallScore += 8;
    bigScore -= 4;
    reasons.push(`📉 Trend: Down (WMA)`);
    addThinkingLog('📉', 'Downward trend detected - favoring SMALL');
  }

  // Factor 2: Consecutive Streak (Mean Reversion)
  if (analysis.consecutive.big >= 3) {
    smallScore += 16;
    bigScore -= 8;
    reasons.push(`🔄 Mean Reversion (BIG x${analysis.consecutive.big})`);
    addThinkingLog('🔄', `Mean reversion: BIG streak ${analysis.consecutive.big} -> favoring SMALL`);
  } else if (analysis.consecutive.small >= 3) {
    bigScore += 16;
    smallScore -= 8;
    reasons.push(`🔄 Mean Reversion (SMALL x${analysis.consecutive.small})`);
    addThinkingLog('🔄', `Mean reversion: SMALL streak ${analysis.consecutive.small} -> favoring BIG`);
  }

  // Factor 3: RNG Bias
  if (analysis.rngBias === 'BIG') {
    bigScore += 10;
    smallScore -= 5;
    reasons.push(`🎯 RNG Bias: BIG (Chi-square test)`);
    addThinkingLog('🎯', 'RNG bias detected: favoring BIG');
  } else if (analysis.rngBias === 'SMALL') {
    smallScore += 10;
    bigScore -= 5;
    reasons.push(`🎯 RNG Bias: SMALL (Chi-square test)`);
    addThinkingLog('🎯', 'RNG bias detected: favoring SMALL');
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
        addThinkingLog('🌐', `Pattern DB: ${key} -> BIG ${(bigRatio*100).toFixed(0)}%`);
      } else if (smallRatio > 0.65) {
        const boost = Math.min(25, smallRatio * 30);
        smallScore += boost;
        bigScore -= boost * 0.5;
        reasons.push(`🌐 Global DB: ${key} → SMALL ${(smallRatio*100).toFixed(0)}% (${data.total} occ)`);
        addThinkingLog('🌐', `Pattern DB: ${key} -> SMALL ${(smallRatio*100).toFixed(0)}%`);
      }
    }
  }

  // Factor 5: Most Frequent Number (Hot Number)
  if (analysis.mostFreq !== null) {
    if (analysis.mostFreq >= 5) {
      bigScore += 4;
      reasons.push(`🔥 Hot number: ${analysis.mostFreq} (${analysis.freq[analysis.mostFreq]}x)`);
      addThinkingLog('🔥', `Hot number detected: ${analysis.mostFreq}`);
    } else {
      smallScore += 4;
      reasons.push(`🔥 Hot number: ${analysis.mostFreq} (${analysis.freq[analysis.mostFreq]}x)`);
      addThinkingLog('🔥', `Hot number detected: ${analysis.mostFreq}`);
    }
  }

  // Factor 6: Prediction Rotation (Avoid repeating)
  if (consecutivePredictionType === 'BIG') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    bigScore -= penalty;
    smallScore += 6;
    reasons.push(`🔄 Rotation: avoid BIG (${consecutivePredictionCount}x)`);
    addThinkingLog('🔄', `Rotation: avoiding BIG (predicted ${consecutivePredictionCount}x in a row)`);
  } else if (consecutivePredictionType === 'SMALL') {
    const penalty = Math.min(16, consecutivePredictionCount * 4);
    smallScore -= penalty;
    bigScore += 6;
    reasons.push(`🔄 Rotation: avoid SMALL (${consecutivePredictionCount}x)`);
    addThinkingLog('🔄', `Rotation: avoiding SMALL (predicted ${consecutivePredictionCount}x in a row)`);
  }

  // Factor 7: Loss Defense
  if (lossStreakCount >= 2) {
    if (consecutivePredictionType === 'BIG') {
      smallScore += 20;
      bigScore -= 12;
      reasons.push(`🛡️ Loss defense: flip from BIG`);
      addThinkingLog('🛡️', 'Loss defense activated: flipping from BIG');
    } else if (consecutivePredictionType === 'SMALL') {
      bigScore += 20;
      smallScore -= 12;
      reasons.push(`🛡️ Loss defense: flip from SMALL`);
      addThinkingLog('🛡️', 'Loss defense activated: flipping from SMALL');
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

  addThinkingLog('✅', `Final prediction: ${predictionType} (${confidence}% confidence)`);

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
//  AI CHAT - Website Related Only
// ================================================================
function handleAIChat(message, language) {
  addThinkingLog('💬', `Chat request: "${message}" (${language})`);
  
  const lowerMsg = message.toLowerCase();
  const responses = {
    en: {
      hello: "Hello! I'm BLZ-AI Assistant. I can help you with:\n• How to use this prediction tool\n• Understanding BIG/SMALL predictions\n• Viewing historical data\n• Pattern detection explanations\n\nHow can I help you today?",
      help: "I can help you with:\n1. Prediction Matrix - shows AI predictions\n2. Analytics - view candlestick charts\n3. History - view all past predictions\n4. Settings - customize your experience\n\nWhat would you like to know?",
      predict: "The AI analyzes recent game results using:\n• Mathematical algorithms (WMA, StdDev)\n• Pattern Database (historical patterns)\n• RNG bias detection (Chi-square test)\n• Mean reversion logic\n• Hot number tracking\n\nConfidence levels range from 45-94%.",
      pattern: "Pattern Database stores sequences of 3 results (e.g., BIG,BIG,SMALL). It tracks:\n• How many times each pattern occurred\n• What came next (BIG or SMALL)\n• Statistical probability for each pattern\n\nThis helps the AI make more accurate predictions!",
      history: "You can view all prediction history in the History tab. Each entry shows:\n• Period number\n• AI prediction (BIG/SMALL)\n• Possible number\n• Actual result (if available)\n• Win/Loss status\n• AI thinking log",
      setting: "In Settings you can:\n• Toggle win/loss notifications\n• Adjust candle size for charts\n• View server status\n• Clear current history (keeps Pattern DB safe)",
      default: "I'm not sure about that. I can help with:\n• Using the prediction tool\n• Understanding BIG/SMALL\n• Viewing history\n• Pattern detection\n• Settings\n\nTry asking something related to these topics!"
    },
    th: {
      hello: "สวัสดี! ฉันคือ BLZ-AI Assistant ฉันสามารถช่วยคุณได้เกี่ยวกับ:\n• วิธีใช้เครื่องมือทำนายนี้\n• ทำความเข้าใจการทำนาย BIG/SMALL\n• ดูข้อมูลประวัติ\n• คำอธิบายการตรวจจับรูปแบบ\n\nวันนี้ฉันช่วยอะไรคุณได้บ้าง?",
      help: "ฉันช่วยคุณได้เกี่ยวกับ:\n1. Prediction Matrix - แสดงการทำนายของ AI\n2. Analytics - ดูแผนภูมิแท่งเทียน\n3. History - ดูการทำนายที่ผ่านมาทั้งหมด\n4. Settings - ปรับแต่งประสบการณ์ของคุณ\n\nคุณอยากรู้เกี่ยวกับอะไร?",
      predict: "AI วิเคราะห์ผลลัพธ์เกมล่าสุดโดยใช้:\n• อัลกอริทึมทางคณิตศาสตร์ (WMA, StdDev)\n• ฐานข้อมูลรูปแบบ (รูปแบบประวัติศาสตร์)\n• การตรวจจับอคติ RNG (การทดสอบ Chi-square)\n• ตรรกะการกลับสู่ค่าเฉลี่ย\n• การติดตามหมายเลขยอดนิยม\n\nระดับความมั่นใจอยู่ที่ 45-94%",
      default: "ฉันไม่แน่ใจเกี่ยวกับเรื่องนั้น ฉันสามารถช่วยได้เกี่ยวกับ:\n• การใช้เครื่องมือทำนาย\n• การทำความเข้าใจ BIG/SMALL\n• การดูประวัติ\n• การตรวจจับรูปแบบ\n• การตั้งค่า\n\nลองถามเกี่ยวกับหัวข้อเหล่านี้!"
    },
    id: {
      hello: "Halo! Saya adalah Asisten BLZ-AI. Saya dapat membantu Anda tentang:\n• Cara menggunakan alat prediksi ini\n• Memahami prediksi BIG/SMALL\n• Melihat data historis\n• Penjelasan deteksi pola\n\nAda yang bisa saya bantu hari ini?",
      help: "Saya dapat membantu Anda tentang:\n1. Prediction Matrix - menampilkan prediksi AI\n2. Analytics - melihat grafik candlestick\n3. History - melihat semua prediksi masa lalu\n4. Settings - menyesuaikan pengalaman Anda\n\nApa yang ingin Anda ketahui?",
      predict: "AI menganalisis hasil game terbaru menggunakan:\n• Algoritma matematika (WMA, StdDev)\n• Database Pola (pola historis)\n• Deteksi bias RNG (uji Chi-square)\n• Logika mean reversion\n• Pelacakan angka populer\n\nTingkat keyakinan berkisar 45-94%.",
      default: "Saya tidak yakin tentang itu. Saya dapat membantu dengan:\n• Menggunakan alat prediksi\n• Memahami BIG/SMALL\n• Melihat sejarah\n• Deteksi pola\n• Pengaturan\n\nCoba tanyakan tentang topik-topik ini!"
    },
    mm: {
      hello: "မင်္ဂလာပါ! ကျွန်တော်က BLZ-AI Assistant ပါ။ ကျွန်တော် ကူညီနိုင်တာတွေက:\n• ဒီခန့်မှန်းရေးကိရိယာကို ဘယ်လိုသုံးရမလဲ\n• BIG/SMALL ခန့်မှန်းချက်တွေကို နားလည်ခြင်း\n• သမိုင်းအချက်အလက်တွေကို ကြည့်ခြင်း\n• ပုံစံရှာဖွေတွေ့ရှိခြင်း ရှင်းလင်းချက်\n\nဒီနေ့ ဘာကူညီပေးရမလဲ။",
      help: "ကျွန်တော် ကူညီနိုင်တာတွေက:\n1. Prediction Matrix - AI ခန့်မှန်းချက်တွေကို ပြသခြင်း\n2. Analytics - ဖယောင်းတိုင်ဇယားတွေကို ကြည့်ခြင်း\n3. History - အတိတ်ခန့်မှန်းချက်အားလုံးကို ကြည့်ခြင်း\n4. Settings - အတွေ့အကြုံကို စိတ်ကြိုက်ပြင်ဆင်ခြင်း\n\nဘာသိချင်လဲ။",
      predict: "AI က နောက်ဆုံးဂိမ်းရလဒ်တွေကို အောက်ပါတွေသုံးပြီး ခွဲခြမ်းစိတ်ဖြာတယ်:\n• သင်္ချာဆိုင်ရာ အယ်လဂိုရီသမ်များ (WMA, StdDev)\n• ပုံစံဒေတာဘေ့စ် (သမိုင်းပုံစံများ)\n• RNG Bias ရှာဖွေခြင်း (Chi-square စမ်းသပ်မှု)\n• Mean reversion ယုတ္တိ\n• လူကြိုက်များသောနံပါတ် ခြေရာခံခြင်း\n\nယုံကြည်မှုအဆင့်က 45-94% ကြားရှိတယ်။",
      default: "ကျွန်တော် အဲဒီအကြောင်း မသေချာဘူး။ ကျွန်တော် ကူညီနိုင်တာတွေက:\n• ခန့်မှန်းရေးကိရိယာသုံးခြင်း\n• BIG/SMALL နားလည်ခြင်း\n• သမိုင်းကြည့်ခြင်း\n• ပုံစံရှာဖွေခြင်း\n• ဆက်တင်များ\n\nဒီအကြောင်းအရာတွေနဲ့ ပတ်သက်ပြီး မေးကြည့်ပါ။"
    },
    zh: {
      hello: "你好！我是 BLZ-AI 助手。我可以帮助您：\n• 如何使用这个预测工具\n• 理解 BIG/SMALL 预测\n• 查看历史数据\n• 模式检测说明\n\n今天有什么可以帮您的？",
      help: "我可以帮助您：\n1. Prediction Matrix - 显示 AI 预测\n2. Analytics - 查看蜡烛图\n3. History - 查看所有历史预测\n4. Settings - 自定义您的体验\n\n您想了解什么？",
      predict: "AI 使用以下内容分析最近的游戏结果：\n• 数学算法 (WMA, StdDev)\n• 模式数据库 (历史模式)\n• RNG 偏差检测 (卡方检验)\n• 均值回归逻辑\n• 热门数字追踪\n\n置信度范围在 45-94% 之间。",
      default: "我不确定那是什么。我可以帮助：\n• 使用预测工具\n• 理解 BIG/SMALL\n• 查看历史\n• 模式检测\n• 设置\n\n请尝试询问与这些主题相关的问题！"
    }
  };

  const langData = responses[language] || responses.en;
  
  // Check for specific keywords
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey') || lowerMsg.includes('မင်္ဂလာပါ') || lowerMsg.includes('ဟိုင်း')) {
    return langData.hello;
  }
  if (lowerMsg.includes('help') || lowerMsg.includes('ကူညီ') || lowerMsg.includes('ช่วย') || lowerMsg.includes('tolong') || lowerMsg.includes('帮助')) {
    return langData.help;
  }
  if (lowerMsg.includes('predict') || lowerMsg.includes('prediction') || lowerMsg.includes('ခန့်မှန်း') || lowerMsg.includes('ทำนาย') || lowerMsg.includes('prediksi') || lowerMsg.includes('预测')) {
    return langData.predict;
  }
  if (lowerMsg.includes('pattern') || lowerMsg.includes('ပုံစံ') || lowerMsg.includes('รูปแบบ') || lowerMsg.in
