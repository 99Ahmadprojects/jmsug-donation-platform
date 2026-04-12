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

// 1. Submit Donation (Sends Message 1: Pending)
app.post('/api/donate', async (req, res) => {
    try {
        await connectDB();
        const { name, phone, category, paymentProofUrl } = req.body;

        if (!name || !paymentProofUrl || !category || !/^03\d{9}$/.test(phone)) {
            return res.status(400).json({ error: 'Name, Phone, Category, and Payment Proof are required.' });
        }

        const donation = new Donation({ name, phone, category, paymentProofUrl, status: 'PENDING_VERIFICATION' });
        await donation.save();

        // Send Message 1: Receipt
        try {
            const messageText = `As-salamu alaykum ${name}. We have received your donation proof for ${category}. Your status is currently PENDING VERIFICATION. Jazak'Allah khair!`;
            await notifyUser(phone, messageText); 
        } catch (msgError) {
            console.error('Failed to send message, but donation was saved:', msgError);
        }

        res.status(200).json({ 
            message: 'Donation proof submitted for review. Thank you.', 
            donationId: donation._id
        });

    } catch (error) {
        console.error(error);
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

// 3. NEW: Verify Donation (Sends Message 2: Approved)
app.post('/api/admin/donations/:id/verify', async (req, res) => {
    try {
        await connectDB();
        const donationId = req.params.id;

        // Use findByIdAndUpdate to safely bypass older strict validation rules
        const donation = await Donation.findByIdAndUpdate(
            donationId,
            { status: 'VERIFIED' },
            { new: true } // Returns the newly updated document
        );

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found.' });
        }

        // Send Message 2: Final Confirmation
        try {
            const messageText = `As-salamu alaykum ${donation.name}. Jazak'Allah khair! Your donation for ${donation.category} has been VERIFIED and approved by the admin.`;
            
            // Safety check to ensure notifyUser exists before calling it
            if (typeof notifyUser === 'function') {
                await notifyUser(donation.phone, messageText);
            } else {
                console.warn('notifyUser function is not defined.');
            }
        } catch (msgError) {
            console.error('Message failed, but donation was verified in DB:', msgError);
        }

        res.status(200).json({ message: 'Donation verified successfully!' });

    } catch (error) {
        console.error('CRITICAL ERROR verifying donation:', error);
        // We now send the EXACT error message back so you can see it in your browser!
        res.status(500).json({ error: error.message || 'Server error during verification.' });
    }
});

module.exports.handler = serverless(app);