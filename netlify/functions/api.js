require('dotenv').config();
const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');
const Donation = require('../../models/Donation');
const { notifyUser } = require('../../services/messagingService');

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

// 1. Existing Route: Submit Donation
app.post('/api/donate', async (req, res) => {
    try {
        await connectDB();
        const { name, phone, category, paymentProofUrl } = req.body;

        if (!name || !paymentProofUrl || !category || !/^03\d{9}$/.test(phone)) {
            return res.status(400).json({ error: 'Name, Phone, Category, and Payment Proof are required.' });
        }

        const donation = new Donation({ name, phone, category, paymentProofUrl, status: 'PENDING_VERIFICATION' });
        await donation.save();

        res.status(200).json({ 
            message: 'Donation proof submitted for review. Thank you.', 
            donationId: donation._id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during donation submission.' });
    }
});

// 2. NEW ADMIN ROUTE: Fetch all donations for download
// Note: In a large production app, you would add password protection here.
app.get('/api/admin/donations', async (req, res) => {
    try {
        await connectDB();
        // Fetch all donations, sorted by newest first
        const donations = await Donation.find().sort({ created_at: -1 });
        res.status(200).json(donations);
    } catch (error) {
        console.error('Error fetching donations for admin:', error);
        res.status(500).json({ error: 'Failed to fetch donations data.' });
    }
});

module.exports.handler = serverless(app);