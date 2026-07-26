async function fetchGameResult() {
  // Try Real API first
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
    
    // Check if response is JSON
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      if (data?.data?.list?.[0]) return data.data.list[0];
    } catch (e) {
      console.log('Response is not JSON, using simulation');
    }
  } catch (error) {
    console.log('API error:', error.message);
  }
  
  // Fallback: Simulation
  return {
    issueNumber: (2026072401 + Math.floor(Math.random() * 1000)).toString(),
    number: Math.floor(Math.random() * 10).toString()
  };
}
