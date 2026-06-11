const twilio = require('twilio');
const config = require('./otp-config');

// In-memory storage for demo purposes (use Redis/database in production)
const otpStorage = new Map();

class OTPService {
    constructor() {
        this.demoMode = config.otp.demoMode;
        // Only initialize Twilio client if not in demo mode
        if (!this.demoMode) {
            this.client = new twilio(config.twilio.accountSid, config.twilio.authToken);
        }
    }

    // Generate a random OTP
    generateOTP() {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < config.otp.length; i++) {
            otp += digits[Math.floor(Math.random() * digits.length)];
        }
        return otp;
    }

    // Send OTP via SMS
    async sendOTP(phoneNumber) {
        try {
            const otp = this.generateOTP();
            const expiryTime = Date.now() + (config.otp.expiryMinutes * 60 * 1000);

            // Clean phone number format
            const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);

            if (this.demoMode) {
                // Demo mode - simulate sending SMS
                console.log(`[DEMO MODE] OTP ${otp} would be sent to ${cleanPhoneNumber}`);
                console.log(`[DEMO MODE] OTP valid for ${config.otp.expiryMinutes} minutes`);

                // Store OTP in memory
                otpStorage.set(cleanPhoneNumber, {
                    otp: otp,
                    expiry: expiryTime,
                    attempts: 0
                });

                return {
                    success: true,
                    message: 'OTP sent successfully (Demo Mode)',
                    demoOTP: otp // Only in demo mode for testing
                };
            } else {
                // Production mode - send real SMS
                const message = await this.client.messages.create({
                    body: `Your RoadWatch verification code is: ${otp}. Valid for ${config.otp.expiryMinutes} minutes.`,
                    from: config.twilio.phoneNumber,
                    to: cleanPhoneNumber
                });

                // Store OTP in memory (use database in production)
                otpStorage.set(cleanPhoneNumber, {
                    otp: otp,
                    expiry: expiryTime,
                    attempts: 0,
                    messageSid: message.sid
                });

                return {
                    success: true,
                    message: 'OTP sent successfully'
                };
            }
        } catch (error) {
            console.error('Error sending OTP:', error);
            return {
                success: false,
                message: 'Failed to send OTP. Please try again.'
            };
        }
    }

    // Verify OTP
    async verifyOTP(phoneNumber, enteredOTP) {
        try {
            const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
            const storedData = otpStorage.get(cleanPhoneNumber);

            if (!storedData) {
                return {
                    success: false,
                    message: 'No OTP found. Please request a new one.'
                };
            }

            // Check if OTP has expired
            if (Date.now() > storedData.expiry) {
                otpStorage.delete(cleanPhoneNumber);
                return {
                    success: false,
                    message: 'OTP has expired. Please request a new one.'
                };
            }

            // Check attempts limit
            if (storedData.attempts >= 3) {
                otpStorage.delete(cleanPhoneNumber);
                return {
                    success: false,
                    message: 'Too many failed attempts. Please request a new OTP.'
                };
            }

            // Verify OTP
            if (storedData.otp === enteredOTP) {
                // Success - remove from storage
                otpStorage.delete(cleanPhoneNumber);
                return {
                    success: true,
                    message: 'Phone number verified successfully!'
                };
            } else {
                // Failed attempt
                storedData.attempts += 1;
                otpStorage.set(cleanPhoneNumber, storedData);

                const remainingAttempts = 3 - storedData.attempts;
                return {
                    success: false,
                    message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
                };
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            return {
                success: false,
                message: 'Verification failed. Please try again.'
            };
        }
    }

    // Clean and format phone number
    cleanPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');

        // Add country code if not present (assuming India +91)
        if (cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }

        // Format with + prefix
        return '+' + cleaned;
    }

    // Get remaining time for OTP
    getRemainingTime(phoneNumber) {
        const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
        const storedData = otpStorage.get(cleanPhoneNumber);

        if (!storedData) return 0;

        const remaining = Math.max(0, Math.ceil((storedData.expiry - Date.now()) / 1000 / 60));
        return remaining;
    }
}

module.exports = new OTPService();
