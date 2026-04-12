const axios = require('axios');
const Donation = require('../models/Donation');


const formatPhoneForWhatsApp = (phone) => {
    // 1. Safety check: If phone is completely missing, return an empty string
    if (!phone) {
        console.warn('Warning: No phone number provided to formatter.');
        return '';
    }

    // 2. Force the phone data to become a String (in case it arrived as a Number)
    let stringPhone = String(phone).trim();

    // 3. Now it is 100% safe to use .startsWith
    if (stringPhone.startsWith('0')) {
        return '92' + stringPhone.substring(1);
    }
    if (stringPhone.startsWith('+')) {
        return stringPhone.substring(1);
    }
    
    return stringPhone;
};

// Function 1: Send Zong SMS
async function sendZongSMS(phone, message) {
    console.log(`[SYS] Falling back: Attempting Zong SMS to ${phone}...`);
    try {
        const response = await axios.post(process.env.ZONG_API_URL, {
            apikey: process.env.ZONG_API_KEY,
            sender: process.env.ZONG_SENDER_ID,
            to: phone, // Zong usually expects 03XXXXXXXXX format
            message: message
        });

        if (response.data && response.status === 200) {
            console.log(`[ZONG] SMS sent successfully to ${phone}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`[ZONG] Error calling Zong API:`, error.message);
        return false;
    }
}

// Function 2: Send WhatsApp (Placeholder integration for Meta API)
async function sendWhatsApp(formattedPhone, message) {
    console.log(`[SYS] Attempting WhatsApp to ${formattedPhone}...`);
    try {
        const response = await axios.post(process.env.WA_API_URL, {
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: "text",
            text: { body: message }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log(`[WHATSAPP] Message sent successfully to ${formattedPhone}`);
            return true;
        }
        return false;
    } catch (error) {
        console.warn(`[WHATSAPP] Failed to send message to ${formattedPhone}:`, error.response?.data || error.message);
        return false; // Trigger fallback
    }
}

// Main Orchestrator Function: Implementation of the WhatsApp -> Fallback SMS flow
async function notifyUser(donationId, name, phone) {
    // Concise and Islamic thank you message
    const thankYouMessage = `Dear ${name}, jazak'Allah-o-khair for donating to JMSUG. We have received your payment proof for review. May Allah reward your generosity.`;
    const waPhone = formatPhoneForWhatsApp(phone);

    try {
        // Step 1: Attempt WhatsApp
        const waSuccess = await sendWhatsApp(waPhone, thankYouMessage);
        
        if (waSuccess) {
            // Update DB and Exit
            await Donation.findByIdAndUpdate(donationId, { whatsapp_sent: true });
            return;
        }

        // Step 2: Fallback to Zong SMS if WhatsApp fails
        const smsSuccess = await sendZongSMS(phone, thankYouMessage);
        
        if (smsSuccess) {
            await Donation.findByIdAndUpdate(donationId, { sms_sent: true });
        } else {
            console.error(`[CRITICAL] Both WhatsApp and SMS failed for donation proof ${donationId}`);
        }
    } catch (error) {
        console.error(`[SYS] Messaging service orchestrator error:`, error);
    }
}

module.exports = { notifyUser };