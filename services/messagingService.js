require('dotenv').config();

// Converts Pakistani 03... numbers to 923... for WhatsApp
const formatPhone = (phone) => {
    if (!phone) return '';
    let stringPhone = String(phone).trim();
    if (stringPhone.startsWith('0')) return '92' + stringPhone.substring(1);
    if (stringPhone.startsWith('+')) return stringPhone.substring(1);
    return stringPhone;
};

// STEP 3: Send WhatsApp Message using the Verified Template
const sendWhatsAppMessage = async (donation) => {
    const phone = formatPhone(donation.phone);

    if (!phone) {
        console.error('[SYS] Cancelled: No valid phone number provided.');
        return false;
    }

    console.log(`[SYS] Attempting to send WhatsApp Template to: ${phone}`);

    try {
        const waUrl = process.env.WA_API_URL; 
        const waToken = process.env.WA_ACCESS_TOKEN;

        if (!waUrl || !waToken) {
            throw new Error('Missing WA_API_URL or WA_ACCESS_TOKEN in env variables.');
        }

        const response = await fetch(waUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${waToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                    name: "donation_app",
                    language: { code: "en" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: donation.name },
                                // Replaced amount with category since your DB uses 'category'
                                { type: "text", text: donation.category } 
                            ]
                        }
                    ]
                }
            })
        });

        if (response.ok) {
            console.log('[WHATSAPP] Template message sent successfully!');
            return true;
        } else {
            const errorData = await response.text();
            console.error(`[WHATSAPP ERROR] API rejected request: ${errorData}`);
            return false;
        }

    } catch (error) {
        console.error(`[WHATSAPP CRITICAL] Failed to send message: ${error.message}`);
        return false; 
    }
};

module.exports = { sendWhatsAppMessage, formatPhone };
