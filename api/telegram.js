const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    console.log('Received Telegram update');
    
    try {
      const scriptUrl = 'https://script.google.com/macros/s/AKfycbxBxDDBml54Pn8Ti7d8MKkl7UNIvraqVC_Ds5yid_vtuGEd5HykorL5-VE8T9WM1z6G/exec';
      
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body)
      });
      
      await response.text();
      res.status(200).json({status: 'ok'});
      
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({error: error.message});
    }
  } else {
    res.status(200).json({status: 'Ready for Telegram webhook'});
  }
};
