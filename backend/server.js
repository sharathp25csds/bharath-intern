const express = require("express");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const otpService = require("./otp-service");
const db = require("./database"); // SQLite database

// Set up absolute paths
const uploadsDir = path.join(__dirname, '../uploads');
const dataDir = path.join(__dirname, '../data');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("📁 Created uploads directory at:", uploadsDir);
}

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("📁 Created data directory at:", dataDir);
}

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Serve static uploads directory - FIX FOR IMAGE DISPLAY
app.use('/uploads', express.static(uploadsDir));

// Receive report form data
app.post("/submit", upload.single("image"), async (req, res) => {
    try {
        const { name, phone, place } = req.body;

        // Validate required fields
        if (!name || !phone || !place) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required fields: name, phone, place" 
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image uploaded" });
        }

        const imagePath = "/uploads/" + req.file.filename;

        // Save to SQLite database
        try {
            await db.addReport(
                name.trim(),
                phone.trim(),
                place.trim(),
                imagePath
            );

            const newReport = {
                name: name.trim(),
                phone: phone.trim(),
                location: place.trim(),
                image: imagePath,
                date: new Date().toISOString(),
                status: "Pending"
            };

            console.log("✅ Report saved to database");
            res.json({ success: true, message: "Report stored successfully", data: newReport });
        } catch (dbError) {
            console.error("❌ Database error:", dbError.message);
            // Fallback to JSON if database fails
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            const newReport = {
                id: Date.now(),
                name: name.trim(),
                phone: phone.trim(),
                location: place.trim(),
                image: imagePath,
                date: new Date().toISOString(),
                status: "Pending"
            };

            const jsonFile = path.join(dataDir, "report.json");
            let reports = [];

            if (fs.existsSync(jsonFile)) {
                const fileContent = fs.readFileSync(jsonFile, 'utf-8');
                if (fileContent.trim()) {
                    reports = JSON.parse(fileContent);
                }
            }

            reports.push(newReport);
            fs.writeFileSync(jsonFile, JSON.stringify(reports, null, 2));

            console.log("⚠️ Fallback: Report saved to JSON");
            res.json({ success: true, message: "Report stored successfully", data: newReport });
        }
    } catch (error) {
        console.error("❌ Submit endpoint error:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Server error: " + error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Admin credentials and officers data
const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "potholeadmin123",
    role: "super_admin"
};

const OFFICERS = [
    { id: 1, name: "Rajesh Kumar", department: "Road Maintenance", status: "active" },
    { id: 2, name: "Priya Sharma", department: "Infrastructure", status: "active" },
    { id: 3, name: "Amit Patel", department: "Engineering", status: "active" },
    { id: 4, name: "Sunita Verma", department: "Quality Control", status: "active" }
];

// Generate simple token (in production, use JWT)
function generateToken(user) {
    return Buffer.from(JSON.stringify({
        username: user.username,
        role: user.role,
        timestamp: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    })).toString('base64');
}

// Verify token
function verifyToken(token) {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        if (decoded.expires < Date.now()) {
            return null;
        }
        return decoded;
    } catch (err) {
        return null;
    }
}

// Authentication middleware
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
}

// Admin Login Endpoint
app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    // Check credentials
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const token = generateToken(ADMIN_CREDENTIALS);
        res.json({
            success: true,
            token: token,
            user: {
                username: ADMIN_CREDENTIALS.username,
                role: ADMIN_CREDENTIALS.role
            }
        });
    } else {
        res.status(401).json({ success: false, message: "Invalid username or password" });
    }
});

// Verify Token Endpoint
app.post("/verify-token", (req, res) => {
    const { token } = req.body;
    const decoded = verifyToken(token);

    if (decoded) {
        res.json({ success: true, user: decoded });
    } else {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
});

// Get Officers Endpoint
app.get("/admin/officers", (req, res) => {
    res.json(OFFICERS.filter(officer => officer.status === "active"));
});

// Legacy login endpoint for backward compatibility
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "potholeadmin123") {
        const token = generateToken(ADMIN_CREDENTIALS);
        res.json({ success: true, token: token });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// Update Report Status and Assignment Endpoint
app.post("/admin/update-report", async (req, res) => {
    const { id, status, officerId, notes, repairStep } = req.body;
    
    // First, try to update the SQLite database
    try {
        console.log(`Attempting to update report ${id} in database`);
        
        // Get the current report from database
        const currentReport = await db.getReportById(id);
        
        if (currentReport) {
            // Update the database with basic information
            const officerName = officerId ? OFFICERS.find(o => o.id == officerId)?.name : currentReport.officer_assigned;
            await db.updateReportStatus(id, status || currentReport.status, officerName, repairStep);
            
            // Return the updated report from database
            const updatedReport = await db.getReportById(id);
            
            console.log(`✅ Report ${id} updated in database`);
            res.json({
                success: true,
                message: "Report updated successfully",
                report: updatedReport
            });
            return;
        }
    } catch (dbError) {
        console.log(`⚠️ Database update failed, attempting JSON fallback: ${dbError.message}`);
    }

    // Fallback to JSON file update for backward compatibility
    try {
        const jsonFile = path.join(dataDir, "report.json");

        if (!fs.existsSync(jsonFile)) {
            return res.status(404).json({ success: false, message: "No reports found" });
        }

        let reports = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
        const reportIndex = reports.findIndex(r => r.id == id);

        if (reportIndex !== -1) {
            const report = reports[reportIndex];

            // Update status
            if (status) report.status = status;

            // Initialize repair tracking if not exists
            if (!report.repairTracking) {
                report.repairTracking = {
                    currentStep: 1,
                    steps: [
                        { id: 1, name: "Reported", status: "completed", timestamp: report.date },
                        { id: 2, name: "Officer Assigned", status: "pending" },
                        { id: 3, name: "Worker Reached", status: "pending" },
                        { id: 4, name: "Material Arriving", status: "pending" },
                        { id: 5, name: "Work Started", status: "pending" },
                        { id: 6, name: "Completed", status: "pending" }
                    ]
                };
            }

            // Update repair tracking step
            if (repairStep) {
                const stepIndex = repairStep - 1;
                if (stepIndex >= 0 && stepIndex < report.repairTracking.steps.length) {
                    // Mark current step as completed
                    report.repairTracking.steps[stepIndex].status = "completed";
                    report.repairTracking.steps[stepIndex].timestamp = new Date().toISOString();

                    // Mark next step as current if available
                    if (stepIndex + 1 < report.repairTracking.steps.length) {
                        report.repairTracking.steps[stepIndex + 1].status = "current";
                    }

                    report.repairTracking.currentStep = Math.max(repairStep, report.repairTracking.currentStep);
                }
            }

            // Update officer assignment
            if (officerId) {
                const officer = OFFICERS.find(o => o.id == officerId);
                if (officer) {
                    report.assignedOfficer = {
                        id: officer.id,
                        name: officer.name,
                        department: officer.department
                    };
                    report.assignedDate = new Date().toISOString();

                    // Auto-update repair tracking to step 2 when officer assigned
                    if (report.repairTracking) {
                        report.repairTracking.steps[1].status = "completed";
                        report.repairTracking.steps[1].timestamp = new Date().toISOString();
                        report.repairTracking.steps[2].status = "current";
                        report.repairTracking.currentStep = Math.max(2, report.repairTracking.currentStep);
                    }
                }
            }

            // Add notes if provided
            if (notes) {
                report.notes = report.notes || [];
                report.notes.push({
                    text: notes,
                    timestamp: new Date().toISOString(),
                    type: 'admin_update'
                });
            }

            // Update last modified
            report.lastModified = new Date().toISOString();

            fs.writeFileSync(jsonFile, JSON.stringify(reports, null, 2));
            console.log(`✅ Report ${id} updated in JSON file`);
            res.json({
                success: true,
                message: "Report updated successfully",
                report: report
            });
            return;
        } else {
            res.status(404).json({ success: false, message: "Report not found" });
        }
    } catch (error) {
        console.error('❌ Update report error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error updating report: " + error.message 
        });
    }
});

// Legacy update-status endpoint for backward compatibility
app.post("/update-status", (req, res) => {
    const { id, status } = req.body;
    const jsonFile = path.join(dataDir, "report.json");

    if (!fs.existsSync(jsonFile)) {
        return res.status(404).json({ success: false, message: "No reports found" });
    }

    let reports = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    const reportIndex = reports.findIndex(r => r.id == id);

    if (reportIndex !== -1) {
        reports[reportIndex].status = status || "Pending";
        reports[reportIndex].lastModified = new Date().toISOString();
        fs.writeFileSync(jsonFile, JSON.stringify(reports, null, 2));
        res.json({ success: true, message: "Status updated successfully" });
    } else {
        res.status(404).json({ success: false, message: "Report not found" });
    }
});

// Initialize reports with status if missing
function initializeReportsWithStatus() {
    const jsonFile = "./data/report.json";

    if (!fs.existsSync(jsonFile)) {
        return;
    }

    const fileContent = fs.readFileSync(jsonFile, 'utf-8');
    if (!fileContent.trim()) {
        return;
    }

    let reports = JSON.parse(fileContent);
    let hasChanges = false;

    reports.forEach(report => {
        if (!report.status) {
            report.status = "Pending";
            hasChanges = true;
        }
        if (!report.lastModified) {
            report.lastModified = report.date;
            hasChanges = true;
        }
    });

    if (hasChanges) {
        fs.writeFileSync(jsonFile, JSON.stringify(reports, null, 2));
    }
}

// Initialize reports on server start
initializeReportsWithStatus();

// GET endpoint to fetch all reports (public)
app.get("/reports", async (req, res) => {
    try {
        // Try to get from SQLite first
        const reports = await db.getAllReports();
        
        // For public view, format the data with all required fields
        const publicReports = reports.map(report => ({
            id: report.id,
            name: report.name,
            location: report.location,
            date: report.date || report.created_at,
            status: report.status,
            image: report.image,
            officer_assigned: report.officer_assigned,
            repair_step: report.repair_step,
            // Add missing fields that dashboard expects
            assignedOfficer: report.officer_assigned ? { name: report.officer_assigned, department: "Infrastructure" } : null,
            notes: [],
            repairTracking: {
                currentStep: 1,
                steps: [
                    { id: 1, name: "Reported", status: "completed", timestamp: report.date || report.created_at },
                    { id: 2, name: "Officer Assigned", status: report.officer_assigned ? "completed" : "pending" },
                    { id: 3, name: "Worker Reached", status: "pending" },
                    { id: 4, name: "Material Arriving", status: "pending" },
                    { id: 5, name: "Work Started", status: "pending" },
                    { id: 6, name: "Completed", status: report.status === "Resolved" ? "completed" : "pending" }
                ]
            }
        }));

        res.json(publicReports);
    } catch (error) {
        console.error("❌ Error fetching reports:", error.message);
        // Fallback to JSON
        const jsonFile = path.join(dataDir, "report.json");

        if (!fs.existsSync(jsonFile)) {
            return res.json([]);
        }

        const fileContent = fs.readFileSync(jsonFile, 'utf-8');
        if (!fileContent.trim()) {
            return res.json([]);
        }

        const reports = JSON.parse(fileContent);
        reports.sort((a, b) => new Date(b.date) - new Date(a.date));

        const publicReports = reports.map(report => ({
            id: report.id,
            name: report.name,
            location: report.location,
            date: report.date,
            status: report.status,
            image: report.image,
            lastModified: report.lastModified,
            assignedOfficer: report.assignedOfficer,
            notes: report.notes ? report.notes.filter(note => note.type === 'admin_update') : [],
            repairTracking: report.repairTracking
        }));

        res.json(publicReports);
    }
});

// GET endpoint to fetch all reports for admin (detailed)
app.get("/admin/reports", async (req, res) => {
    try {
        // Try to get from SQLite first
        const reports = await db.getAllReports();
        // Enrich SQLite reports with empty repair tracking for UI compatibility
        const enrichedReports = reports.map(report => ({
            ...report,
            repairTracking: report.repairTracking || {
                currentStep: 1,
                steps: [
                    { id: 1, name: "Reported", status: "completed", timestamp: report.date },
                    { id: 2, name: "Officer Assigned", status: report.officer_assigned ? "completed" : "pending" },
                    { id: 3, name: "Worker Reached", status: "pending" },
                    { id: 4, name: "Material Arriving", status: "pending" },
                    { id: 5, name: "Work Started", status: "pending" },
                    { id: 6, name: "Completed", status: report.status === "Resolved" ? "completed" : "pending" }
                ]
            },
            notes: report.notes || [],
            assignedOfficer: report.officer_assigned ? { name: report.officer_assigned } : null
        }));
        res.json(enrichedReports);
    } catch (error) {
        console.error("❌ Error fetching admin reports:", error.message);
        // Fallback to JSON
        try {
            const jsonFile = path.join(dataDir, "report.json");

            if (!fs.existsSync(jsonFile)) {
                return res.json([]);
            }

            const fileContent = fs.readFileSync(jsonFile, 'utf-8');
            if (!fileContent.trim()) {
                return res.json([]);
            }

            const reports = JSON.parse(fileContent);
            reports.sort((a, b) => new Date(b.date) - new Date(a.date));
            res.json(reports);
        } catch (fallbackError) {
            console.error("❌ Fallback error:", fallbackError.message);
            res.json([]);
        }
    }
});

// -------------------------------
// OTP VERIFICATION ROUTES
// -------------------------------

// Send OTP to phone number
app.post("/send-otp", async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: "Phone number is required"
        });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid Indian mobile number"
        });
    }

    try {
        const result = await otpService.sendOTP(phoneNumber);
        res.json(result);
    } catch (error) {
        console.error("OTP send error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send OTP. Please try again."
        });
    }
});

// Verify OTP
app.post("/verify-otp", async (req, res) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
        return res.status(400).json({
            success: false,
            message: "Phone number and OTP are required"
        });
    }

    try {
        const result = await otpService.verifyOTP(phoneNumber, otp);
        res.json(result);
    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({
            success: false,
            message: "Verification failed. Please try again."
        });
    }
});

// Get OTP status/remaining time
app.get("/otp-status/:phoneNumber", (req, res) => {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: "Phone number is required"
        });
    }

    const remainingTime = otpService.getRemainingTime(phoneNumber);

    res.json({
        success: true,
        remainingMinutes: remainingTime,
        canRequestNew: remainingTime === 0
    });
});

// Serve uploaded images
app.use("/uploads", express.static(uploadsDir));

// Serve static files (HTML, CSS, JS) from frontend directory - AFTER all API routes
app.use(express.static(path.join(__dirname, '../frontend')));

// Redirect root URL to home page
app.get("/", (req, res) => {
    res.redirect("/pages/index.html");
});

// Serve specific pages with .html extension for easier access
app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/dashboard.html'));
});

app.get("/report", (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/report.html'));
});

app.get("/chatbot", (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/chatbot.html'));
});

// Multer error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        console.error("❌ Multer error:", error.message);
        return res.status(400).json({ 
            success: false, 
            message: "File upload error: " + error.message 
        });
    } else if (error) {
        console.error("❌ Request error:", error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Server error: " + error.message 
        });
    }
    next();
});

// Start server (Local / Render)
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

module.exports = app;

