// ================================================================
//  AI CHAT ENDPOINT (Website-only questions)
// ================================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, lang } = req.body;
        
        // Check if message is about the website
        const websiteKeywords = ['website', 'site', 'page', 'feature', 'how to', 'what is', 'prediction', 'big', 'small', 
            'number', 'game', 'pattern', 'analysis', 'dashboard', 'history', 'candlestick', 'theme', 'settings',
            'win', 'loss', 'streak', 'confidence', 'possible', 'hedge', 'brain', 'ai', 'random', 'rng', 'use', 'help',
            'explain', 'tell me', 'show me', 'guide', 'tutorial', 'what does', 'how does'];
        
        const isWebsiteRelated = websiteKeywords.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // Get language-specific reply for non-website questions
        const langReplies = {
            en: "🤖 I'm a specialized assistant for this BLZ-AI prediction website. I can only answer questions about the website features, prediction system, game analysis, and how to use this tool. Please ask me about the website!",
            th: "🤖 ฉันเป็นผู้ช่วยเฉพาะสำหรับเว็บไซต์ทำนาย BLZ-AI นี้ ฉันสามารถตอบคำถามเกี่ยวกับฟีเจอร์ของเว็บไซต์ ระบบการทำนาย การวิเคราะห์เกม และวิธีการใช้เครื่องมือนี้เท่านั้น กรุณาถามฉันเกี่ยวกับเว็บไซต์!",
            id: "🤖 Saya adalah asisten khusus untuk situs web prediksi BLZ-AI ini. Saya hanya dapat menjawab pertanyaan tentang fitur situs web, sistem prediksi, analisis permainan, dan cara menggunakan alat ini. Tolong tanyakan tentang situs web!",
            my: "🤖 ကျွန်တော်က ဒီ BLZ-AI ခန့်မှန်းချက်ဝဘ်ဆိုက်အတွက် အထူးပြုအကူပါ။ ဝဘ်ဆိုက်အင်္ဂါရပ်များ၊ ခန့်မှန်းချက်စနစ်၊ ဂိမ်းခွဲခြမ်းစိတ်ဖြာမှုနှင့် ဤကိရိယာကို မည်သို့အသုံးပြုရမည်အကြောင်းကိုသာ ဖြေနိုင်ပါတယ်။ ဝဘ်ဆိုက်အကြောင်း မေးပါ။",
            zh: "🤖 我是这个BLZ-AI预测网站的专用助手。我只能回答关于网站功能、预测系统、游戏分析和如何使用这个工具的问题。请问我关于网站的问题！"
        };
        
        if (!isWebsiteRelated) {
            const reply = langReplies[lang] || langReplies.en;
            return res.json({ reply });
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
Be concise but informative. If they ask about something not related to the website, politely redirect them.
Keep responses in the same language as the question if possible.`;

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        let reply = "Sorry, I couldn't process your request. Please try again.";

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            reply = data.candidates[0].content.parts[0].text;
        }

        res.json({ reply });

    } catch (error) {
        console.error('[💬 Chat] Error:', error);
        // Return a fallback in the same language if possible
        const fallbackReplies = {
            en: "⚠️ I'm having trouble connecting right now. Please try again in a moment.",
            th: "⚠️ ฉันมีปัญหาในการเชื่อมต่อในขณะนี้ กรุณาลองอีกครั้งในอีกสักครู่",
            id: "⚠️ Saya mengalami masalah koneksi saat ini. Silakan coba lagi nanti.",
            my: "⚠️ ချိတ်ဆက်ရာတွင် ပြဿနာရှိနေပါသည်။ ခဏကြာပြီး ပြန်ကြိုးစားပါ။",
            zh: "⚠️ 我现在连接有问题，请稍后再试。"
        };
        const fallback = fallbackReplies[req.body?.lang] || fallbackReplies.en;
        res.status(500).json({ reply: fallback });
    }
});
