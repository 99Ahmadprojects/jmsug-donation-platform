require('dotenv').config();

const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    let stringPhone = String(phone).trim();
    
    // Convert 03xx to 923xx for WhatsApp API
    if (stringPhone.startsWith('0')) return '92' + stringPhone.substring(1);
    
    // Remove the + sign if they included it (+923xx becomes 923xx)
    if (stringPhone.startsWith('+')) return stringPhone.substring(1);
    
    return stringPhone;
};

const notifyUser = async (phone, messageText) => {
    // 1. Validate Phone
    const waPhone = formatPhoneForWhatsApp(phone);

    if (!waPhone) {
        console.error('[SYS] Cancelled: No valid phone number provided to notifyUser.');
        return false;
    }

    console.log(`[SYS] Attempting to send WhatsApp message to: ${waPhone}`);

    // 2. Send via WhatsApp
    try {
        const waUrl = process.env.WA_API_URL;
        const waToken = process.env.WA_ACCESS_TOKEN;

        // Safety check for Environment Variables
        if (!waUrl || !waUrl.startsWith('http')) {
            throw new Error('WA_API_URL is missing or invalid in Netlify Environment Variables.');
        }
        if (!waToken) {
            throw new Error('WA_ACCESS_TOKEN is missing in Netlify Environment Variables.');
        }

        // Send the request to Meta
        const waResponse = await fetch(waUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${waToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: waPhone,
                type: "text",
                text: { body: messageText }
            })
        });

        // Check the response from Meta
        if (waResponse.ok) {
            console.log('[WHATSAPP] Message sent successfully!');
            return true; 
        } else {
            const errorData = await waResponse.text();
            throw new Error(`WhatsApp API rejected the request: ${errorData}`);
        }

    } catch (waError) {
        console.error(`[WHATSAPP CRITICAL] Failed to send message to ${waPhone}: ${waError.message}`);
        return false; // Return false so the server doesn't crash, it just logs the error
    }
};

// Export the functions so your api.js can use them
module.exports = { notifyUser, formatPhoneForWhatsApp };