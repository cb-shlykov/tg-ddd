const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    console.log('📨 Telegram webhook received');
    
    try {
      // Проверяем наличие тела запроса
      if (!req.body) {
        console.log('❌ No request body');
        return res.status(200).json({ok: true});
      }
      
      console.log('✅ Update received:', JSON.stringify(req.body, null, 2));
      
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbxBxDDBml54Pn8Ti7d8MKkl7UNIvraqVC_Ds5yid_vtuGEd5HykorL5-VE8T9WM1z6G/exec';
      
      // Пересылаем в Apps Script с таймаутом
      console.log('🔄 Forwarding to Apps Script...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const result = await response.text();
      console.log('✅ Apps Script response:', response.status, result);
      
      // Всегда возвращаем успех Telegram
      res.status(200).json({ok: true});
      
    } catch (error) {
      console.error('❌ Error:', error.name, error.message);
      
      // Всегда возвращаем 200 для Telegram
      res.status(200).json({ok: true, note: 'forwarding failed but ack sent'});
    }
  } else {
    res.status(200).json({
      status: 'Telegram webhook endpoint',
      usage: 'Send POST requests here',
      test: 'Webhook is ready'
    });
  }
};
