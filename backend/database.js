const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = './data/pothole_reports.db';

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

// Create tables if they don't exist
function initializeDatabase() {
    db.serialize(() => {
        // Reports table
        db.run(`
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                location TEXT NOT NULL,
                image TEXT,
                date TEXT NOT NULL,
                status TEXT DEFAULT 'Pending',
                officer_assigned TEXT,
                repair_step TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating reports table:', err.message);
            else console.log('✅ Reports table ready');
        });

        // Admin logs table
        db.run(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_username TEXT NOT NULL,
                action TEXT NOT NULL,
                report_id INTEGER,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating admin_logs table:', err.message);
            else console.log('✅ Admin logs table ready');
        });

        // OTP table
        db.run(`
            CREATE TABLE IF NOT EXISTS otp_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                otp TEXT NOT NULL,
                verified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )
        `, (err) => {
            if (err) console.error('Error creating otp_records table:', err.message);
            else console.log('✅ OTP records table ready');
        });
    });
}

// Export database functions
module.exports = {
    // Add a new report
    addReport: (name, phone, location, image) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO reports (name, phone, location, image, date, status) VALUES (?, ?, ?, ?, ?, ?)',
                [name, phone, location, image, new Date().toISOString(), 'Pending'],
                function (err) {
                    if (err) {
                        console.error('❌ Error adding report:', err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Report saved with ID: ${this.lastID}`);
                        resolve({ id: this.lastID, success: true });
                    }
                }
            );
        });
    },

    // Get all reports
    getAllReports: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM reports ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching reports:', err.message);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    },

    // Get report by ID
    getReportById: (id) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM reports WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('❌ Error fetching report:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Update report status
    updateReportStatus: (id, status, officer, repair_step) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE reports SET status = ?, officer_assigned = ?, repair_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, officer, repair_step, id],
                function (err) {
                    if (err) {
                        console.error('❌ Error updating report:', err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Report ${id} updated`);
                        resolve({ success: true, changes: this.changes });
                    }
                }
            );
        });
    },

    // Get statistics
    getStatistics: () => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'Working' THEN 1 ELSE 0 END) as working,
                    SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
                FROM reports
            `, (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching statistics:', err.message);
                    reject(err);
                } else {
                    resolve(rows[0] || { total: 0, pending: 0, working: 0, resolved: 0 });
                }
            });
        });
    },

    // Store OTP
    storeOTP: (phone, otp) => {
        return new Promise((resolve, reject) => {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            db.run(
                'INSERT INTO otp_records (phone, otp, expires_at) VALUES (?, ?, ?)',
                [phone, otp, expiresAt.toISOString()],
                function (err) {
                    if (err) {
                        console.error('❌ Error storing OTP:', err.message);
                        reject(err);
                    } else {
                        resolve({ success: true });
                    }
                }
            );
        });
    },

    // Log admin action
    logAdminAction: (username, action, report_id, details) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO admin_logs (admin_username, action, report_id, details) VALUES (?, ?, ?, ?)',
                [username, action, report_id, details],
                function (err) {
                    if (err) {
                        console.error('❌ Error logging action:', err.message);
                        reject(err);
                    } else {
                        resolve({ success: true });
                    }
                }
            );
        });
    },

    // Close database connection
    close: () => {
        db.close((err) => {
            if (err) console.error('Error closing database:', err.message);
            else console.log('Database connection closed');
        });
    }
};
