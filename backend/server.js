const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js'); // Need this for backend updates

const app = express();
app.use(cors());
app.use(express.json());

// --- ENVIRONMENT VARIABLES ---
const publicVapidKey = process.env.VAPID_PUBLIC_KEY; 
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const flwSecretHash = process.env.FLW_SECRET_HASH;
// Note: The Service Role Key bypasses RLS. Keep it SECRET.
const supabaseUrl = 'https://rmlgvsvvbwoudrosbbpd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails('mailto:leuoradigital@gmail.com', publicVapidKey, privateVapidKey);
}

// 1. Notification Endpoint
app.post('/send-notification', async (req, res) => {
  const { subscription, title, body } = req.body;
  const payload = JSON.stringify({ title, body });
  try {
    await webpush.sendNotification(subscription, payload);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Flutterwave Webhook (The Secure Way)
app.post('/api/flutterwave-webhook', async (req, res) => {
    // Verify the request is actually from Flutterwave
    const signature = req.headers['verif-hash'];
    if (!signature || signature !== flwSecretHash) {
        return res.status(401).end(); // Unauthorized
    }

    const payload = req.body;
    console.log("Payment Webhook Received:", payload);

    // Check if payment was successful
    if (payload.data.status === 'successful') {
        const txRef = payload.data.tx_ref; // The order ID we sent to Flutterwave
        
        // Update order in Supabase (Bypassing RLS using Service Key)
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ payment_status: 'paid', status: 'shipped' }) // Mark as paid
            .eq('id', txRef); // Match the order ID

        if (error) console.error("Supabase Update Error:", error);
        else console.log("Order marked as paid:", txRef);
    }

    res.status(200).end();
});

// 3. Serve Frontend
app.use(express.static(path.join(__dirname, '../')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));