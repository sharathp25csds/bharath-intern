// OTP Configuration
// Replace these with your actual Twilio credentials for production
const config = {
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || 'demo_account_sid',
        authToken: process.env.TWILIO_AUTH_TOKEN || 'demo_auth_token',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+1234567890'
    },
    otp: {
        length: 6,
        expiryMinutes: 5,
        demoMode: process.env.DEMO_MODE !== 'false' // Default to demo mode
    }
};

module.exports = config;





