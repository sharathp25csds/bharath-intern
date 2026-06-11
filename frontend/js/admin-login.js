// API Configuration - Auto-detect backend server
// If on localhost (any port except 3000), use localhost:3000 for API calls
const API_BASE_URL = (() => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // If already on port 3000, use as-is
  if (port === '3000') {
    return `http://${hostname}:3000`;
  }
  
  // If on localhost/127.0.0.1 (live server, etc), redirect API to port 3000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  
  // Otherwise use current origin
  return window.location.origin;
})();

console.log(`🔌 API Base URL: ${API_BASE_URL}`);

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`📡 API Call: ${options.method || 'GET'} ${url}`);
  const response = await fetch(url, options);
  return response;
}

// Load saved credentials if remember me was checked
window.addEventListener('DOMContentLoaded', function () {
    const savedUsername = localStorage.getItem('adminUsername');
    const savedPassword = localStorage.getItem('adminPassword');
    const rememberMe = localStorage.getItem('adminRememberMe') === 'true';

    if (rememberMe && savedUsername) {
        document.getElementById('username').value = savedUsername;
        document.getElementById('password').value = savedPassword;
        document.getElementById('rememberMe').checked = true;
    }

    // Check if already logged in
    const token = localStorage.getItem('adminToken');
    if (token) {
        // Verify token validity
        verifyToken(token);
    }
});

async function verifyToken(token) {
    try {
        const response = await apiCall('/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        if (response.ok) {
            window.location.href = 'admin-dashboard.html';
        } else {
            localStorage.removeItem('adminToken');
        }
    } catch (err) {
        console.log('Token verification failed');
    }
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const loginBtn = document.getElementById('loginBtn');
    const message = document.getElementById('message');

    // Clear previous messages
    message.style.display = 'none';
    message.className = 'message';

    // Basic validation
    if (!username || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    // Show loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading-spinner"></span> Authenticating...';

    try {
        const response = await apiCall('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            // Save token
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));

            // Handle remember me
            if (rememberMe) {
                localStorage.setItem('adminUsername', username);
                localStorage.setItem('adminPassword', password);
                localStorage.setItem('adminRememberMe', 'true');
            } else {
                localStorage.removeItem('adminUsername');
                localStorage.removeItem('adminPassword');
                localStorage.removeItem('adminRememberMe');
            }

            showMessage('Login successful! Redirecting...', 'success');

            // Redirect after short delay
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 1000);

        } else {
            showMessage(data.message || 'Login failed', 'error');
        }

    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please check your connection and try again.', 'error');
    } finally {
        // Reset button state
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Dashboard';
    }
});

function showMessage(text, type) {
    const message = document.getElementById('message');
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';

    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            message.style.display = 'none';
        }, 3000);
    }
}

function showForgotPassword() {
    document.getElementById('forgotPasswordModal').style.display = 'flex';
}

function closeForgotPassword() {
    document.getElementById('forgotPasswordModal').style.display = 'none';
}

// Close modal when clicking outside
document.getElementById('forgotPasswordModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeForgotPassword();
    }
});

// Enter key support
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !document.getElementById('loginBtn').disabled) {
        document.getElementById('adminLoginForm').dispatchEvent(new Event('submit'));
    }
});
