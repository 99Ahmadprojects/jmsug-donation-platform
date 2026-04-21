require('dotenv').config();
const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');
const Donation = require('../../models/Donation');
const { sendWhatsAppMessage } = require('../../services/messagingService'); // <-- Updated Import

const app = express();

app.use(cors());
app.use(express.json());

let conn = null;
const connectDB = async () => {
    if (conn == null) {
        mongoose.set('strictQuery', false);
        conn = await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        return conn;
    }
};

// 1. Submit Donation (Data saved, NO MESSAGE SENT HERE)
app.post('/api/donate', async (req, res) => {
    try {
        await connectDB();
        const { name, phone, category, paymentProofUrl } = req.body;

        const safePhone = String(phone || '').trim();

        if (!name || !paymentProofUrl || !category || !/^03\d{9}$/.test(safePhone)) {
            return res.status(400).json({ error: 'Name, valid Phone, Category, and Payment Proof are required.' });
        }

        const donation = new Donation({ 
            name, 
            phone: safePhone, 
            category, 
            paymentProofUrl, 
            status: 'PENDING_VERIFICATION' 
        });
        await donation.save();

        res.status(200).json({ 
            message: 'Donation proof submitted for review. Thank you.', 
            donationId: donation._id
        });

    } catch (error) {
        console.error('Submit error:', error);
        res.status(500).json({ error: 'Server error during donation submission.' });
    }
});

// 2. Fetch all donations for admin dashboard
app.get('/api/admin/donations', async (req, res) => {
    try {
        await connectDB();
        const donations = await Donation.find().sort({ created_at: -1 });
        res.status(200).json(donations);
    } catch (error) {
        console.error('Error fetching donations for admin:', error);
        res.status(500).json({ error: 'Failed to fetch donations data.' });
    }
});

// 3. Verify Donation (Updates DB, THEN sends WhatsApp Template)
app.post('/api/admin/donations/:id/verify', async (req, res) => {
    try {
        await connectDB();
        const donationId = req.params.id;
        
        // A. Update status to 'VERIFIED'
        const donation = await Donation.findByIdAndUpdate(
            donationId,
            { status: 'VERIFIED' },
            { new: true }
        );

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found.' });
        }

        // B. Send the WhatsApp Template ONLY after verification
        try {
            if (donation.phone && typeof sendWhatsAppMessage === 'function') {
                await sendWhatsAppMessage(donation);
            }
        } catch (msgError) {
            console.error('Message failed, but donation was verified in DB:', msgError);
        }

        res.status(200).json({ message: 'Donation verified successfully!' });

    } catch (error) {
        console.error('CRITICAL ERROR verifying donation:', error);
        res.status(500).json({ error: error.message || 'Server error during verification.' });
    }
});

module.exports.handler = serverless(app);