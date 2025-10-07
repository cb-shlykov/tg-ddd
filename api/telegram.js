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
    console.log('📨 Received Telegram update');
    
    try {
      // Получаем тело запроса
      const body = req.body;
      console.log('Request body:', JSON.stringify(body, null, 2));
      
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbxBxDDBml54Pn8Ti7d8MKkl7UNIvraqVC_Ds5yid_vtuGEd5HykorL5-VE8T9WM1z6G/exec';
      
      console.log('🔄 Forwarding to Apps Script...');
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        timeout: 30000
      });
      
      const result = await response.text();
      console.log('✅ Apps Script response status:', response.status);
      console.log('✅ Apps Script response:', result);
      
      // Всегда возвращаем успех Telegram
      res.status(200).json({ok: true});
      
    } catch (error) {
      console.error('❌ Error forwarding to Apps Script:', error);
      // Всегда возвращаем 200 Telegram, иначе он отключит вебхук
      res.status(200).json({ok: true, error: error.message});
    }
  } else {
    res.status(200).json({status: 'Ready for Telegram webhook'});
  }
};
