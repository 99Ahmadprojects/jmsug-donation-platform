const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { 
        type: String, 
        required: true,
        match: [/^03\d{9}$/, 'Please fill a valid Pakistani phone number (03XXXXXXXXX)']
    },
    category: { type: String, required: true }, // Added category field
    status: { type: String, enum: ['PENDING_VERIFICATION', 'SUCCESS', 'FAILED'], default: 'PENDING_VERIFICATION' },
    paymentProofUrl: { type: String, required: true },
    whatsapp_sent: { type: Boolean, default: false },
    sms_sent: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Donation', donationSchema);