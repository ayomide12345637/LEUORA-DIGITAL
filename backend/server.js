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

// 3. DYNAMIC SITEMAP GENERATOR (Must be before catch-all)
app.get('/sitemap.xml', async (req, res) => {
    try {
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('id, created_at')
            .eq('status', 'approved');

        if (error) throw error;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <!-- Main Pages -->
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

        // Add all products dynamically
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

// 4. APK DOWNLOAD ROUTE (NEW)
// This forces the browser to download the APK file properly
app.get('/download', (req, res) => {
    // Points to the APK in the root folder (one level up from the backend folder)
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

// 5. Serve Frontend (Static files and catch-all)
app.use(express.static(path.join(__dirname, '../')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
