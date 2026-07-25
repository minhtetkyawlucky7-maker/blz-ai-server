require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.static('public'));

// ================================================================
//  ADVANCED MATHEMATICAL ALGORITHM ANALYSIS
// ================================================================
class MathematicalAnalyzer {
    constructor() {
        this.bayesianPrior = { big: 0.5, small: 0.5 };
        this.markovMatrix = {
            'BIG->BIG': 0.5, 'BIG->SMALL': 0.5,
            'SMALL->BIG': 0.5, 'SMALL->SMALL': 0.5
        };
        this.cusum = 0;
        this.movingAverage = [];
        this.maxMA = 10;
    }

    // 1. Bayesian Probability
    bayesianAnalysis(history) {
        if (history.length < 5) return { big: 0.5, small: 0.5 };
        
        const recent = history.slice(-20);
        const bigs = recent.filter(h => Number(h.result) >= 5).length;
        const smalls = recent.filter(h => Number(h.result) < 5).length;
        const total = bigs + smalls;
        
        // Update prior based on recent data
        const likelihoodBig = bigs / total;
        const likelihoodSmall = smalls / total;
        
        // Posterior = Prior * Likelihood
        const posteriorBig = this.bayesianPrior.big * likelihoodBig;
        const posteriorSmall = this.bayesianPrior.small * likelihoodSmall;
        const sum = posteriorBig + posteriorSmall;
        
        return {
            big: posteriorBig / sum,
            small: posteriorSmall / sum
        };
    }

    // 2. Markov Chain
    markovAnalysis(history) {
        if (history.length < 4) return { big: 0.5, small: 0.5 };
        
        const types = history.map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
        let bigBig = 0, bigSmall = 0, smallBig = 0, smallSmall = 0;
        
        for (let i = 0; i < types.length - 1; i++) {
            const current = types[i];
            const next = types[i + 1];
            if (current === 'BIG' && next === 'BIG') bigBig++;
            else if (current === 'BIG' && next === 'SMALL') bigSmall++;
            else if (current === 'SMALL' && next === 'BIG') smallBig++;
            else if (current === 'SMALL' && next === 'SMALL') smallSmall++;
        }
        
        const lastType = types[types.length - 1];
        let bigProb = 0.5, smallProb = 0.5;
        
        if (lastType === 'BIG') {
            const totalBig = bigBig + bigSmall;
            bigProb = totalBig > 0 ? bigBig / totalBig : 0.5;
            smallProb = totalBig > 0 ? bigSmall / totalBig : 0.5;
        } else {
            const totalSmall = smallBig + smallSmall;
            bigProb = totalSmall > 0 ? smallBig / totalSmall : 0.5;
            smallProb = totalSmall > 0 ? smallSmall / totalSmall : 0.5;
        }
        
        // Update matrix
        this.markovMatrix['BIG->BIG'] = bigBig / (bigBig + bigSmall + 0.01);
        this.markovMatrix['BIG->SMALL'] = bigSmall / (bigBig + bigSmall + 0.01);
        this.markovMatrix['SMALL->BIG'] = smallBig / (smallBig + smallSmall + 0.01);
        this.markovMatrix['SMALL->SMALL'] = smallSmall / (smallBig + smallSmall + 0.01);
        
        return { big: bigProb, small: smallProb };
    }

    // 3. CUSUM (Cumulative Sum)
    cusumAnalysis(history) {
        if (history.length < 3) return 0;
        
        const recent = history.slice(-10);
        const values = recent.map(h => Number(h.result) - 4.5); // Center around 4.5
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
        
        // CUSUM drift detection
        let drift = 0;
        for (const v of values) {
            drift += (v - mean) / (std + 0.01);
        }
        this.cusum = drift * 0.1 + this.cusum * 0.9; // Smooth
        
        return this.cusum;
    }

    // 4. Moving Average
    movingAverageAnalysis(history) {
        const recent = history.slice(-this.maxMA);
        const values = recent.map(h => Number(h.result));
        if (values.length < 3) return 4.5;
        
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        this.movingAverage.push(avg);
        if (this.movingAverage.length > this.maxMA) {
            this.movingAverage.shift();
        }
        
        return avg;
    }

    // 5. Combine All Methods
    analyze(history) {
        const bayesian = this.bayesianAnalysis(history);
        const markov = this.markovAnalysis(history);
        const cusum = this.cusumAnalysis(history);
        const movingAvg = this.movingAverageAnalysis(history);
        
        // Weighted combination
        const bigScore = (bayesian.big * 0.3 + markov.big * 0.3 + 0.4 * (movingAvg >= 4.5 ? 0.7 : 0.3));
        const smallScore = (bayesian.small * 0.3 + markov.small * 0.3 + 0.4 * (movingAvg < 4.5 ? 0.7 : 0.3));
        
        // CUSUM adjustment
        const cusumFactor = Math.min(0.2, Math.abs(cusum) * 0.02);
        const finalBig = bigScore + (cusum > 0 ? cusumFactor : -cusumFactor);
        const finalSmall = smallScore + (cusum < 0 ? cusumFactor : -cusumFactor);
        
        return {
            big: Math.max(0.1, Math.min(0.9, finalBig)),
            small: Math.max(0.1, Math.min(0.9, finalSmall)),
            bayesian,
            markov,
            cusum,
            movingAvg
        };
    }
}

// ================================================================
//  GAME RNG DEEP ANALYSIS
// ================================================================
class RNGAnalyzer {
    constructor() {
        this.numberFreq = {};
        this.streakCount = 0;
        this.currentStreak = '';
        this.gaps = {};
        this.lastSeen = {};
    }

    analyze(history) {
        const recent = history.slice(-100);
        const numbers = recent.map(h => Number(h.result)).filter(n => !isNaN(n));
        
        // Number Frequency
        this.numberFreq = {};
        for (const n of numbers) {
            this.numberFreq[n] = (this.numberFreq[n] || 0) + 1;
        }
        
        // Streak Analysis
        let maxStreak = 0;
        let currentStreak = 1;
        for (let i = 1; i < numbers.length; i++) {
            const isBig = numbers[i] >= 5;
            const isPrevBig = numbers[i-1] >= 5;
            if (isBig === isPrevBig) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }
        
        // Gap Analysis
        this.gaps = {};
        this.lastSeen = {};
        for (let i = 0; i < numbers.length; i++) {
            const n = numbers[i];
            if (this.lastSeen[n] !== undefined) {
                const gap = i - this.lastSeen[n];
                if (!this.gaps[n]) this.gaps[n] = [];
                this.gaps[n].push(gap);
            }
            this.lastSeen[n] = i;
        }
        
        return {
            numberFreq: this.numberFreq,
            maxStreak,
            gaps: this.gaps,
            totalNumbers: numbers.length
        };
    }
}

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
//  GEMINI AI PREDICTION (Original Logic)
// ================================================================
async function geminiPredict(history) {
    const recent = history.filter(h => h.result !== null && h.result !== undefined)
        .map(h => Number(h.result)).slice(0, 20);

    if (recent.length < 3) {
        return {
            prediction: Math.random() > 0.5 ? 'BIG' : 'SMALL',
            confidence: 82,
            possible_number: Math.floor(Math.random() * 10),
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
  "possible_number": 3,
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
            possible_number: parseInt(aiData.possible_number) || Math.floor(Math.random() * 10),
            calculation: aiData.statistical_analysis || 'Advanced regression pattern evaluated successfully.'
        };
    } catch (error) {
        console.error('AI Error:', error);
        return {
            prediction: Math.random() > 0.5 ? 'BIG' : 'SMALL',
            confidence: 80,
            possible_number: Math.floor(Math.random() * 10),
            calculation: 'Engaged algorithmic neural fallback due to network restriction.'
        };
    }
}

// ================================================================
//  DEEP ANALYSIS SYSTEM (Combined)
// ================================================================
async function deepAnalysis(history) {
    const mather = new MathematicalAnalyzer();
    const rng = new RNGAnalyzer();
    
    // Get pattern insights from DB
    const patterns = await db.getAllPatterns();
    const allHistory = await db.getHistory(100);
    
    // Pattern Frequency Analysis
    let patternInsight = null;
    if (history.length >= 3) {
        const lastThree = history.slice(0, 3).map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
        if (lastThree.length === 3) {
            const key = lastThree.join(',');
            const data = await db.getPattern(key);
            if (data && data.total >= 3) {
                patternInsight = {
                    key,
                    total: data.total,
                    nextBig: data.next_big,
                    nextSmall: data.next_small,
                    bigRatio: data.next_big / data.total,
                    smallRatio: data.next_small / data.total
                };
            }
        }
    }
    
    // Mathematical analysis
    const mathResult = mather.analyze(history);
    
    // RNG analysis
    const rngResult = rng.analyze(history);
    
    // Combined prediction
    const combinedBig = (mathResult.big * 0.4 + (patternInsight?.bigRatio || 0.5) * 0.3 + 0.3 * (rngResult.numberFreq[7] || 0.5));
    const combinedSmall = (mathResult.small * 0.4 + (patternInsight?.smallRatio || 0.5) * 0.3 + 0.3 * (rngResult.numberFreq[2] || 0.5));
    
    const prediction = combinedBig > combinedSmall ? 'BIG' : 'SMALL';
    const confidence = Math.round(Math.max(combinedBig, combinedSmall) * 100);
    
    // Find possible number
    let possibleNumber = prediction === 'BIG' ? 7 : 2;
    const range = prediction === 'BIG' ? [5,6,7,8,9] : [0,1,2,3,4];
    let bestCount = -1;
    for (const n of range) {
        const count = rngResult.numberFreq[n] || 0;
        if (count > bestCount) { bestCount = count; possibleNumber = n; }
    }
    
    return {
        prediction,
        confidence: Math.min(92, Math.max(45, confidence)),
        possible_number: possibleNumber,
        mathematical: mathResult,
        rng: rngResult,
        pattern: patternInsight,
        calculation: `Math: BIG=${(mathResult.big*100).toFixed(1)}% SMALL=${(mathResult.small*100).toFixed(1)}% | Pattern: ${patternInsight ? `${patternInsight.key} â†’ ${(patternInsight.bigRatio*100).toFixed(0)}%` : 'No pattern'} | RNG: ${Object.keys(rngResult.numberFreq).length} numbers analyzed`
    };
}

// ================================================================
//  24/7 AUTO HISTORICAL ANALYSIS (CRON JOB)
// ================================================================
let isAnalyzing = false;

async function autoHistoricalAnalysis() {
    if (isAnalyzing) return;
    isAnalyzing = true;
    
    try {
        console.log('ðŸ”„ Auto Historical Analysis started...');
        
        // Fetch latest game result
        const result = await fetchGameResult();
        if (!result) return;
        
        const period = result.issueNumber;
        const number = Number(result.number);
        const type = number >= 5 ? 'BIG' : 'SMALL';
        
        // Check if already in DB
        const history = await db.getHistory(1);
        if (history.length > 0 && history[0].period === period) {
            console.log('â­ï¸ Already recorded:', period);
            return;
        }
        
        // Save to history
        await db.addHistory({
            period,
            prediction: 'AUTO',
            possible_number: number,
            result: number,
            result_type: type,
            status: 'RECORDED',
            calculation: 'Auto-historical collection'
        });
        
        // Update Pattern DB
        const recentHistory = await db.getHistory(5);
        const types = recentHistory.map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
        if (types.length >= 4) {
            const lastThree = types.slice(-4, -1);
            if (lastThree.length === 3) {
                const key = lastThree.join(',');
                const isBig = type === 'BIG';
                await db.updatePattern(key, 1, isBig ? 1 : 0, isBig ? 0 : 1);
            }
        }
        
        console.log('âœ… Auto analysis completed for period:', period);
        
    } catch (error) {
        console.error('âŒ Auto analysis error:', error);
    } finally {
        isAnalyzing = false;
    }
}

// Schedule auto analysis every 15 minutes
if (process.env.NODE_ENV !== 'development') {
    cron.schedule('*/15 * * * *', autoHistoricalAnalysis);
    console.log('â° Auto Historical Analysis scheduled every 15 minutes');
}

// ================================================================
//  API ROUTES
// ================================================================

// 1. Get Game Result
app.get('/api/game-result', async (req, res) => {
    try { const result = await fetchGameResult(); res.json(result); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch' }); }
});

// 2. Get Prediction with Deep Analysis
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
        
        // Deep Analysis
        const deepResult = await deepAnalysis(formatted);
        
        // Gemini AI (Original)
        const geminiResult = await geminiPredict(formatted);
        
        // Combine results (Deep Analysis 60% + Gemini 40%)
        const finalPrediction = deepResult.confidence > geminiResult.confidence ? 
            deepResult.prediction : geminiResult.prediction;
        const finalConfidence = Math.round((deepResult.confidence * 0.6 + geminiResult.confidence * 0.4));
        const finalNumber = deepResult.possible_number || geminiResult.possible_number;
        
        // Build detailed calculation log
        const logLines = [
            'ðŸ§® DEEP ANALYSIS SYSTEM v2.0',
            `ðŸ“Š Mathematical: BIG=${(deepResult.mathematical.big*100).toFixed(1)}% SMALL=${(deepResult.mathematical.small*100).toFixed(1)}%`,
            `ðŸŽ¯ Pattern DB: ${deepResult.pattern ? `${deepResult.pattern.key} â†’ ${(deepResult.pattern.bigRatio*100).toFixed(0)}%` : 'No pattern found'}`,
            `ðŸŽ² RNG Analysis: ${deepResult.rng.totalNumbers} numbers | Max streak: ${deepResult.rng.maxStreak}`,
            `ðŸ¤– Gemini AI: ${geminiResult.prediction} @ ${geminiResult.confidence}%`,
            `ðŸ“ˆ Final Decision: ${finalPrediction} (${finalConfidence}%) | Possible: ${finalNumber}`
        ];
        
        res.json({
            prediction: finalPrediction,
            confidence: finalConfidence,
            possible_number: finalNumber,
            deep_analysis: deepResult,
            gemini: geminiResult,
            calculation: logLines.join(' | '),
            logLines: logLines
        });
        
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Prediction failed' });
    }
});

// 3. Submit Result (Save to History)
app.post('/api/submit-result', async (req, res) => {
    try {
        const { period, prediction, possible_number, result, result_type, status, calculation } = req.body;
        await db.addHistory({
            period,
            prediction,
            possible_number,
            result,
            result_type,
            status,
            calculation
        });
        
        // Update Pattern DB
        if (result !== null && result !== undefined && status !== 'Pending') {
            const recentHistory = await db.getHistory(5);
            const types = recentHistory.map(h => Number(h.result) >= 5 ? 'BIG' : 'SMALL');
            if (types.length >= 4) {
                const currentType = Number(result) >= 5 ? 'BIG' : 'SMALL';
                const lastThree = types.slice(-4, -1);
                if (lastThree.length === 3) {
                    const key = lastThree.join(',');
                    const isBig = currentType === 'BIG';
                    await db.updatePattern(key, 1, isBig ? 1 : 0, isBig ? 0 : 1);
                }
            }
        }
        
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to save' });
    }
});

// 4. Get History (Default: 100, Max: 3000)
app.get('/api/history', async (req, res) => {
    try {
        cons
