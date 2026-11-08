const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// --- ENVIRONMENT VARIABLES ---
const publicVapidKey = process.env.VAPID_PUBLIC_KEY; 
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const flwSecretHash = process.env.FLW_SECRET_HASH;
const supabaseUrl = 'https://rmlgvsvvbwoudrosbbpd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails('mailto:leuoradigital@gmail.com', publicVapidKey, privateVapidKey);
}

// 1. Notification Endpoint (Manual Trigger)
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

// 2. Flutterwave Webhook
app.post('/api/flutterwave-webhook', async (req, res) => {
    const signature = req.headers['verif-hash'];
    if (!signature || signature !== flwSecretHash) {
        return res.status(401).end(); // Unauthorized
    }

    const payload = req.body;
    console.log("Payment Webhook Received:", payload);

    if (payload.data.status === 'successful') {
        const txRef = payload.data.tx_ref; 
        
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ payment_status: 'paid', status: 'shipped' })
            .eq('id', txRef); 

        if (error) console.error("Supabase Update Error:", error);
        else console.log("Order marked as paid:", txRef);
    }

    res.status(200).end();
});

// 3. DYNAMIC SITEMAP GENERATOR
app.get('/sitemap.xml', async (req, res) => {
    try {
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('id, created_at')
            .eq('status', 'approved');

        if (error) throw error;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <url>
        <loc>https://leuora.xyz/</loc>
        <priority>1.0</priority>
        <image:image><image:loc>https://leuora.xyz/images/hero1.jpg</image:loc></image:image>
        <image:image><image:loc>https://leuora.xyz/images/hero2.jpg</image:loc></image:image>
        <image:image><image:loc>https://leuora.xyz/images/hero3.jpg</image:loc></image:image>
    </url>
    <url><loc>https://leuora.xyz/index.html</loc><priority>0.9</priority></url>
    <url><loc>https://leuora.xyz/signup.html</loc><priority>0.8</priority></url>
    <url><loc>https://leuora.xyz/app.html</loc><priority>0.8</priority></url>
`;

        if (products && products.length > 0) {
            products.forEach(product => {
                const date = new Date(product.created_at).toISOString().split('T')[0];
                xml += `    <url>
        <loc>https://leuora.xyz/product.html?id=${product.id}</loc>
        <lastmod>${date}</lastmod>
        <priority>0.7</priority>
    </url>\n`;
            });
        }

        xml += `</urlset>`;
        res.header('Content-Type', 'application/xml');
        res.send(xml);

    } catch (error) {
        console.error("Sitemap error:", error);
        res.status(500).send("Error generating sitemap");
    }
});

// ==========================================
// 4. NOTIFICATION AUTOMATION ROUTES
// ==========================================

// Called by Cron Job every 5 hours
app.get('/api/cron/reminder', async (req, res) => {
    try {
        const { data: products } = await supabaseAdmin.from('products').select('title, image_url').eq('status', 'approved');
        let productTitle = "Check out new items!";
        let productImage = "https://leuora.xyz/images/logo.png";

        if (products && products.length > 0) {
            const randomProduct = products[Math.floor(Math.random() * products.length)];
            productTitle = randomProduct.title;
            productImage = randomProduct.image_url;
        }

        const { data: subscribers } = await supabaseAdmin.from('push_subscriptions').select('*');
        
        if (subscribers && subscribers.length > 0) {
            const payload = JSON.stringify({
                title: "Don't forget to shop today! 🛒",
                body: `Check out this awesome product: ${productTitle}`,
                icon: productImage,
                url: 'https://leuora.xyz/app.html'
            });

            for (const sub of subscribers) {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: { auth: sub.auth, p256dh: sub.p256dh }
                };
                try {
                    await webpush.sendNotification(pushSubscription, payload);
                } catch (err) { console.error("Push failed for user"); }
            }
        }
        res.status(200).send("Reminders sent!");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Called by Supabase Trigger when a new user signs up
app.post('/api/webhook/new-user', async (req, res) => {
    try {
        const newUser = req.body.record; 
        if (!newUser) return res.status(400).send("No user data");

        const { data: subscribers } = await supabaseAdmin.from('push_subscriptions').select('*');
        
        if (subscribers && subscribers.length > 0) {
            const payload = JSON.stringify({
                title: "New User Alert! 🎉",
                body: `${newUser.full_name || 'Someone'} just joined Leuora Digital!`,
                icon: 'https://leuora.xyz/images/logo.png',
                url: 'https://leuora.xyz/admin.html'
            });

            for (const sub of subscribers) {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: { auth: sub.auth, p256dh: sub.p256dh }
                };
                try {
                    await webpush.sendNotification(pushSubscription, payload);
                } catch (err) { console.error("Push error"); }
            }
        }
        res.status(200).send("Admin notified!");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// ==========================================
// 5. APK DOWNLOAD ROUTE
// ==========================================
app.get('/download', (req, res) => {
    const apkPath = path.join(__dirname, '../LeuoraDigital.apk');
    
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="LeuoraDigital.apk"');
    
    res.download(apkPath, 'LeuoraDigital.apk', (err) => {
        if (err) {
            console.error("Error downloading APK:", err);
            res.status(404).send("APK not found. Please ensure LeuoraDigital.apk is in the root of your repository.");
        }
    });
});

// 6. Serve Frontend (Static files and catch-all)
app.use(express.static(path.join(__dirname, '../')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
