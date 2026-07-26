// ================================================================
//  AI CHAT ENDPOINT - Website-only questions
// ================================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        // Check if message is about the website
        const websiteKeywords = ['website', 'site', 'page', 'feature', 'how to', 'what is', 'prediction', 'big', 'small', 
            'number', 'game', 'pattern', 'analysis', 'dashboard', 'history', 'candlestick', 'theme', 'settings',
            'win', 'loss', 'streak', 'confidence', 'possible', 'hedge', 'brain', 'ai', 'random', 'rng'];
        
        const isWebsiteRelated = websiteKeywords.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!isWebsiteRelated) {
            return res.json({
                reply: "🤖 I'm a specialized assistant for this BLZ-AI prediction website. I can only answer questions about the website features, prediction system, game analysis, and how to use this tool. Please ask me about the website!"
            });
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
                    generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
                })
            }
        );

        const data = await response.json();
        let reply = "Sorry, I couldn't process your request. Please try again.";

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            reply = data.candidates[0].content.parts[0].text;
        }

        res.json({ reply });

    } catch (error) {
        console.error('[💬 Chat] Error:', error);
        res.status(500).json({ reply: '⚠️ Error processing your request. Please try again.' });
    }
});
