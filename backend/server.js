const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Webhook } = require('svix');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // For production, restrict to your frontend URL
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_ZMQ9Fkdy_FKaEB9tEBgnhBLZ8NMm2zwX8';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_your_webhook_secret_here';
const DOMAIN = process.env.DOMAIN || 'takemyvitamins.lol';

// In-memory storage (use a real database in production)
let emails = {
  received: [
    { 
      id: 1, 
      from: 'welcome@resend.dev', 
      to: `anyone@${DOMAIN}`, 
      subject: 'Welcome to Resend', 
      preview: 'Thanks for using Resend with your custom domain.', 
      body: 'Welcome to Resend!\n\nThanks for using Resend with your custom domain. We are excited to have you on board.\n\n- The Resend Team',
      date: new Date(Date.now() - 7200000).toISOString()
    },
    { 
      id: 2, 
      from: 'team@takemyvitamins.lol', 
      to: `support@${DOMAIN}`, 
      subject: 'Domain verified', 
      preview: 'Your domain takemyvitamins.lol is ready.', 
      body: 'Domain Verified\n\nYour domain takemyvitamins.lol has been successfully verified and is ready to send and receive emails.\n\nYou can now start using your custom domain with Resend.',
      date: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  sent: [
    { 
      id: 101, 
      from: 'sender <me@takemyvitamins.lol>', 
      to: 'client@example.com', 
      subject: 'Proposal update', 
      preview: 'Here is the latest proposal for your review.', 
      body: 'Dear Client,\n\nHere is the latest proposal for your review. Please let me know if you have any questions.\n\nBest regards,\nYour Name',
      date: new Date(Date.now() - 3600000).toISOString()
    }
  ]
};

let nextId = 1000;

// ---------- API ENDPOINTS ----------

// Get emails (received or sent)
app.get('/api/emails/:type', (req, res) => {
  const { type } = req.params;
  if (type === 'received' || type === 'sent') {
    res.json(emails[type] || []);
  } else {
    res.status(400).json({ error: 'Invalid type. Use "received" or "sent"' });
  }
});

// Save sent email
app.post('/api/sent', (req, res) => {
  const { from, to, subject, preview, body } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const newEmail = {
    id: nextId++,
    from: from || 'sender <me@takemyvitamins.lol>',
    to: to,
    subject: subject || '(no subject)',
    preview: preview || (body || '').substring(0, 60) + ((body || '').length > 60 ? '...' : ''),
    body: body || ' ',
    date: new Date().toISOString()
  };
  
  emails.sent.unshift(newEmail);
  if (emails.sent.length > 50) emails.sent.pop();
  
  res.json({ success: true, id: newEmail.id });
});

// Webhook endpoint for Resend
app.post('/api/webhook', async (req, res) => {
  try {
    // Verify webhook signature (optional but recommended)
    const headers = req.headers;
    const payload = JSON.stringify(req.body);
    
    // Uncomment for production - verify webhook signature
    /*
    if (WEBHOOK_SECRET && WEBHOOK_SECRET !== 'whsec_your_webhook_secret_here') {
      const webhook = new Webhook(WEBHOOK_SECRET);
      webhook.verify(payload, {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
      });
    }
    */

    const event = req.body;
    
    // Handle email received events
    if (event.type === 'email.received') {
      const data = event.data || event;
      
      const newEmail = {
        id: nextId++,
        from: data.from || 'unknown',
        to: data.to || 'unknown',
        subject: data.subject || '(no subject)',
        preview: (data.text || data.html || '').substring(0, 60) + ((data.text || data.html || '').length > 60 ? '...' : ''),
        body: data.text || data.html || '',
        date: new Date().toISOString()
      };
      
      emails.received.unshift(newEmail);
      if (emails.received.length > 50) emails.received.pop();
      
      console.log(`📬 Received email from ${data.from} to ${data.to}`);
    } else {
      console.log(`📨 Webhook event: ${event.type}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send('Invalid webhook');
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    domain: DOMAIN,
    emails: {
      received: emails.received.length,
      sent: emails.sent.length
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Vitamin's Mail backend running on port ${PORT}`);
  console.log(`📧 Domain: ${DOMAIN}`);
  console.log(`📥 Received emails: ${emails.received.length}`);
  console.log(`📤 Sent emails: ${emails.sent.length}`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/api/webhook`);
});
