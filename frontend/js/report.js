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

// -------------------------------
// MAP & LOCATION LOGIC
// -------------------------------
console.log("REPORT.JS LOADED - START");
const placeInput = document.getElementById("place");
const gpsStatus = document.getElementById("gpsStatus");
let map, marker;

function initMap() {
  // Default location: Central Delhi (or generic)
  const defaultLat = 28.6139;
  const defaultLng = 77.2090;

  // Initialize Map
  map = L.map('map').setView([defaultLat, defaultLng], 13);

  // Add OpenStreetMap Tile Layer (Free & Accurate)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Add draggable marker
  marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);

  // Event: Marker Drag End
  marker.on('dragend', function (e) {
    const position = marker.getLatLng();
    updateLocation(position.lat, position.lng);
  });

  // Event: Map Click
  map.on('click', function (e) {
    marker.setLatLng(e.latlng);
    updateLocation(e.latlng.lat, e.latlng.lng);
  });

  // Try to get user's current location to center map
  if (navigator.geolocation) {
    gpsStatus.textContent = "📍 Getting your location...";
    gpsStatus.style.color = "#3b82f6";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setView([lat, lng], 16);
        marker.setLatLng([lat, lng]);
        updateLocation(lat, lng);
        console.log("Location found:", lat, lng);
      },
      (error) => {
        console.log("Location error:", error.code, error.message);
        let errorMsg = "";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "📍 GPS blocked. You can still report by typing the location address above. Or reset permissions via 🔒 icon in address bar.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "📍 Location unavailable. No problem! Type the location address above to continue.";
            break;
          case error.TIMEOUT:
            errorMsg = "📍 GPS timed out. Type the location address above or click GPS button to retry.";
            break;
          default:
            errorMsg = "📍 Default location shown. Enter exact location above or click GPS button.";
        }
        gpsStatus.textContent = errorMsg;
        gpsStatus.style.color = error.code === error.PERMISSION_DENIED ? "#dc2626" : "#f59e0b";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    gpsStatus.textContent = "❌ Geolocation not supported by your browser.";
    gpsStatus.style.color = "#dc2626";
  }
}

// Function to reverse geocode and update input
async function updateLocation(lat, lng) {
  gpsStatus.textContent = "📍 Fetching exact address...";
  gpsStatus.style.color = "#64748b";

  console.log('Reverse geocoding coordinates:', lat, lng);

  try {
    // Using Nominatim (OpenStreetMap) for reverse geocoding with more detailed parameters
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'PotholeReporter/1.0',
          'Accept': 'application/json'
        }
      }
    );

    console.log('Reverse geocoding response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Reverse geocoding response:', data);

    if (data && data.display_name) {
      // Improved address formatting for Indian locations
      const addr = data.address || {};
      let addressParts = [];

      // Priority order for Indian addresses
      if (addr.house_number) addressParts.push(addr.house_number);
      if (addr.road || addr.pedestrian || addr.path || addr.footway) {
        addressParts.push(addr.road || addr.pedestrian || addr.path || addr.footway);
      }
      if (addr.neighbourhood || addr.suburb || addr.residential) {
        addressParts.push(addr.neighbourhood || addr.suburb || addr.residential);
      }
      if (addr.city_district || addr.county) {
        addressParts.push(addr.city_district || addr.county);
      }
      if (addr.city || addr.town || addr.village || addr.hamlet) {
        addressParts.push(addr.city || addr.town || addr.village || addr.hamlet);
      }
      if (addr.state) addressParts.push(addr.state);
      if (addr.postcode) addressParts.push(addr.postcode);
      if (addr.country && addr.country !== "India") addressParts.push(addr.country);

      // If we don't have structured address, use display_name but clean it up
      let finalAddress;
      if (addressParts.length >= 2) {
        finalAddress = addressParts.join(", ");
      } else {
        // Clean up display_name for Indian addresses
        const displayParts = data.display_name.split(', ');
        // Remove country if it's India, and limit to first 3-4 parts
        const cleanParts = displayParts.filter(part =>
          !part.includes('India') &&
          !part.match(/^\d{6}$/) // Remove PIN codes from end
        ).slice(0, 4);
        finalAddress = cleanParts.join(", ");
      }

      console.log('Formatted address:', finalAddress);
      // Store both address and coordinates for submission
      placeInput.value = finalAddress;
      placeInput.dataset.lat = lat;
      placeInput.dataset.lng = lng;
      gpsStatus.textContent = `✅ Exact address found: ${finalAddress}`;
      gpsStatus.style.color = "#16a34a";

    } else {
      // Fallback to coordinates if no address found
      const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      console.log('No address found, using coordinates:', coordString);
      placeInput.value = coordString;
      gpsStatus.textContent = "📍 Coordinates selected (Address not available)";
      gpsStatus.style.color = "#f59e0b";
    }

  } catch (error) {
    console.error("Reverse geocoding error:", error);
    const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    placeInput.value = coordString;
    gpsStatus.textContent = `📍 Coordinates selected (${error.message})`;
    gpsStatus.style.color = "#f59e0b";
  }
}

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', initMap);

// -------------------------------
// GPS BUTTON LOGIC
// -------------------------------
const gpsBtn = document.getElementById("gpsBtn");
if (gpsBtn) {
  gpsBtn.addEventListener("click", () => {
    gpsStatus.textContent = "📍 Requesting your location...";
    gpsStatus.style.color = "#3b82f6";
    gpsBtn.disabled = true;
    gpsBtn.textContent = "🔄 Locating...";

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          if (map && marker) {
            map.setView([lat, lng], 18); // Zoom to street level
            marker.setLatLng([lat, lng]);
            updateLocation(lat, lng);
          }

          gpsBtn.disabled = false;
          gpsBtn.textContent = "🎯 GPS Location";
          gpsStatus.textContent = "✅ Area found! Drag marker to exact spot.";
          gpsStatus.style.color = "#16a34a";
        },
        (error) => {
          console.error("GPS Error:", error.code, error.message);
          gpsBtn.disabled = false;
          gpsBtn.textContent = "🎯 GPS Location";

          let errorMsg = "";
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              errorMsg = "🔒 GPS permission denied. Reset: Click 🔒 icon in address bar → Allow Location → Retry. Or type address manually above.";
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMsg = "📡 Location unavailable. Try again or type your location address in the field above.";
              break;
            case 3: // TIMEOUT
              errorMsg = "⏱️ GPS timed out. Type your address manually above or retry the GPS button.";
              break;
            default:
              errorMsg = "📍 Could not detect location automatically. No problem! Just type the address above.";
          }
          gpsStatus.textContent = errorMsg;
          gpsStatus.style.color = "#f59e0b";
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    } else {
      gpsStatus.textContent = "❌ Geolocation not supported by your browser.";
      gpsStatus.style.color = "#dc2626";
      gpsBtn.disabled = false;
      gpsBtn.textContent = "🎯 GPS Location";
    }
  });
}


// -------------------------------
// AI IMAGE ANALYSIS
// -------------------------------

// -------------------------------
// IMAGE PREVIEW
// -------------------------------
const imageInput = document.getElementById("imageUpload");
const preview = document.getElementById("previewImage");
let selectedImage = null;

if (imageInput) {
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      statusEl.textContent = "❌ Please upload a valid image file (JPEG, PNG, or WebP).";
      statusEl.style.color = "#dc2626";
      this.value = ""; // Clear the input
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      statusEl.textContent = "❌ File size must be less than 10MB.";
      statusEl.style.color = "#dc2626";
      this.value = ""; // Clear the input
      return;
    }

    selectedImage = file;
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  });
}

// -------------------------------
// OTP VERIFICATION SYSTEM
// -------------------------------
let isPhoneVerified = false;
let currentPhoneNumber = '';
let otpTimer = null;

// Initialize OTP system when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  console.log("OTP system initializing...");

  // Phone number input validation and OTP button enable/disable
  const phoneInput = document.getElementById("phone");
  const sendOtpBtn = document.getElementById("sendOtpBtn");

  console.log("Phone input:", phoneInput);
  console.log("Send OTP button:", sendOtpBtn);

  if (!phoneInput || !sendOtpBtn) {
    console.error("OTP elements not found!");
    return;
  }

  console.log("OTP system initialized successfully");

  phoneInput.addEventListener("input", function () {
    const phoneNumber = this.value.trim();
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    // More lenient validation for testing - just check if it's 10 digits
    const isValidPhone = /^\d{10}$/.test(cleanPhone) || /^(\+91|91)?[6-9]\d{9}$/.test(cleanPhone);

    sendOtpBtn.disabled = !isValidPhone;

    // Reset verification status when phone number changes
    if (phoneNumber !== currentPhoneNumber) {
      isPhoneVerified = false;
      hideOtpSection();
      resetOtpStatus();
    }
  });

  // Send OTP functionality
  sendOtpBtn.addEventListener("click", async function (event) {
    console.log("Send OTP button clicked");
    event.preventDefault(); // Prevent form submission
    const phoneNumber = phoneInput.value.trim();

    if (!phoneNumber) return;

    // Disable button and show loading
    sendOtpBtn.disabled = true;
    sendOtpBtn.classList.add('sending');
    sendOtpBtn.textContent = "Sending...";

    try {
      console.log("Making fetch request to /send-otp");
      const response = await apiCall('/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber })
      });

      console.log("Response received:", response.status);
      const result = await response.json();
      console.log("Response data:", result);

      if (result.success) {
        sendOtpBtn.classList.remove('sending');
        currentPhoneNumber = phoneNumber;
        showOtpSection();

        if (result.demoOTP) {
          // Demo mode - show OTP prominently for testing
          console.log(`📱 TEST OTP: ${result.demoOTP}`);
          showOtpStatus(`✓ Demo OTP: ${result.demoOTP} (Valid for 5 minutes)`, 'info');
          // Also show in alert for clarity
          alert(`Test OTP Generated: ${result.demoOTP}\n\nEnter this code to verify your phone number.`);
        } else {
          showOtpStatus('✓ OTP sent successfully!', 'success');
        }

        startResendTimer();
      } else {
        sendOtpBtn.classList.remove('sending');
        showOtpStatus(result.message, 'error');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      showOtpStatus('Failed to send OTP. Please try again.', 'error');
    } finally {
      sendOtpBtn.disabled = false;
      sendOtpBtn.classList.remove('sending');
      sendOtpBtn.textContent = "Send OTP";
    }
  });

  // OTP input validation
  const otpInput = document.getElementById("otpInput");
  const verifyOtpBtn = document.getElementById("verifyOtpBtn");

  otpInput.addEventListener("input", function () {
    const otp = this.value.trim();
    verifyOtpBtn.disabled = otp.length !== 6;
  });

  // Verify OTP functionality
  verifyOtpBtn.addEventListener("click", async function () {
    const otp = otpInput.value.trim();

    if (!otp || otp.length !== 6) return;

    // Disable button and show loading
    verifyOtpBtn.disabled = true;
    verifyOtpBtn.textContent = "Verifying...";

    try {
      const response = await apiCall('/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: currentPhoneNumber,
          otp: otp
        })
      });

      const result = await response.json();

      if (result.success) {
        isPhoneVerified = true;
        showOtpStatus('Phone number verified successfully!', 'success');
        hideOtpSection();
        phoneInput.disabled = true;
        sendOtpBtn.disabled = true;
        sendOtpBtn.classList.add('verified');
        sendOtpBtn.textContent = "Verified ✓";
      } else {
        showOtpStatus(result.message, 'error');
        otpInput.value = '';
        verifyOtpBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      showOtpStatus('Verification failed. Please try again.', 'error');
    } finally {
      verifyOtpBtn.disabled = false;
      verifyOtpBtn.textContent = "Verify";
    }
  });

  // Resend OTP functionality
  const resendOtpBtn = document.getElementById("resendOtpBtn");
  resendOtpBtn.addEventListener("click", function () {
    sendOtpBtn.click();
  });

  // OTP Modal functionality (if modal exists)
  const otpModal = document.getElementById("otpModal");
  const modalClose = document.querySelector(".modal-close");
  const modalOtpInput = document.getElementById("modalOtpInput");
  const modalVerifyBtn = document.getElementById("modalVerifyBtn");
  const modalResendBtn = document.getElementById("modalResendBtn");

  // Modal OTP input validation
  if (modalOtpInput) {
    modalOtpInput.addEventListener("input", function () {
      const otp = this.value.trim();
      modalVerifyBtn.disabled = otp.length !== 6;
    });
  }

  // Modal verify OTP
  if (modalVerifyBtn) {
    modalVerifyBtn.addEventListener("click", async function () {
      const otp = modalOtpInput.value.trim();

      if (!otp || otp.length !== 6) return;

      modalVerifyBtn.disabled = true;
      modalVerifyBtn.textContent = "Verifying...";

      try {
        const response = await apiCall('/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber: currentPhoneNumber,
            otp: otp
          })
        });

        const result = await response.json();

        if (result.success) {
          isPhoneVerified = true;
          showModalStatus('Phone number verified successfully!', 'success');
          setTimeout(() => {
            closeOtpModal();
          }, 1500);
        } else {
          showModalStatus(result.message, 'error');
          modalOtpInput.value = '';
          modalVerifyBtn.disabled = true;
        }
      } catch (error) {
        console.error('Error verifying OTP:', error);
        showModalStatus('Verification failed. Please try again.', 'error');
      } finally {
        modalVerifyBtn.disabled = false;
        modalVerifyBtn.textContent = "Verify";
      }
    });
  }

  // Modal resend OTP
  if (modalResendBtn) {
    modalResendBtn.addEventListener("click", async function () {
      modalResendBtn.disabled = true;

      try {
        const response = await apiCall('/send-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phoneNumber: currentPhoneNumber })
        });

        const result = await response.json();

        if (result.success) {
          if (result.demoOTP) {
            showModalStatus(`✓ Demo OTP: ${result.demoOTP}`, 'success');
            alert(`New OTP Generated: ${result.demoOTP}`);
          } else {
            showModalStatus('✓ OTP sent successfully!', 'success');
          }
          startModalResendTimer();
        } else {
          showModalStatus(result.message, 'error');
        }
      } catch (error) {
        console.error('Error resending OTP:', error);
        showModalStatus('Failed to resend OTP.', 'error');
      }
    });
  }

  // Modal close
  if (modalClose) {
    modalClose.addEventListener("click", closeOtpModal);
  }

  // Helper functions inside DOMContentLoaded
  function startModalResendTimer() {
    let timeLeft = 60;
    const timerEl = document.getElementById("modalResendTimer");

    modalResendBtn.disabled = true;
    timerEl.textContent = `Resend in ${timeLeft}s`;
    timerEl.style.display = "block";

    if (otpTimer) clearInterval(otpTimer);

    otpTimer = setInterval(() => {
      timeLeft--;
      timerEl.textContent = `Resend in ${timeLeft}s`;

      if (timeLeft <= 0) {
        clearInterval(otpTimer);
        modalResendBtn.disabled = false;
        timerEl.style.display = "none";
      }
    }, 1000);
  }

  function resetModalState() {
    const modalOtpInput = document.getElementById("modalOtpInput");
    const modalVerifyBtn = document.getElementById("modalVerifyBtn");
    const modalResendBtn = document.getElementById("modalResendBtn");

    if (modalOtpInput) modalOtpInput.value = "";
    if (modalVerifyBtn) modalVerifyBtn.disabled = true;
    showModalStatus("", "");
    if (modalResendBtn) modalResendBtn.disabled = true;
    const modalResendTimer = document.getElementById("modalResendTimer");
    if (modalResendTimer) modalResendTimer.style.display = "none";
  }

  function showModalStatus(message, type) {
    const statusEl = document.getElementById("modalOtpStatus");
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `modal-status ${type}`;
    }
  }

  function startResendTimer() {
    let timeLeft = 60;
    const timerEl = document.getElementById("timerCount");
    const resendBtn = document.getElementById("resendOtpBtn");
    const resendTimer = document.getElementById("resendTimer");

    if (resendBtn) resendBtn.style.display = "none";
    if (resendTimer) resendTimer.style.display = "block";

    if (otpTimer) clearInterval(otpTimer);

    otpTimer = setInterval(() => {
      if (timerEl) timerEl.textContent = timeLeft;
      timeLeft--;

      if (timeLeft < 0) {
        clearInterval(otpTimer);
        if (resendTimer) resendTimer.style.display = "none";
        if (resendBtn) resendBtn.style.display = "inline-block";
      }
    }, 1000);
  }

  function showOtpModal() {
    const modal = document.getElementById("otpModal");
    const modalPhoneNumber = document.getElementById("modalPhoneNumber");
    const modalOtpInput = document.getElementById("modalOtpInput");

    if (modal) modal.style.display = "flex";
    if (modalPhoneNumber) modalPhoneNumber.textContent = currentPhoneNumber;
    if (modalOtpInput) {
      modalOtpInput.focus();
      modalOtpInput.value = "";
    }
    showModalStatus("", "");
  }

  function closeOtpModal() {
    const modal = document.getElementById("otpModal");
    if (modal) modal.style.display = "none";
    resetModalState();
  }

}); // End of DOMContentLoaded for OTP system

// Global helper functions
function showOtpSection() {
  const otpSection = document.getElementById("otpSection");
  const otpInput = document.getElementById("otpInput");
  if (otpSection) otpSection.style.display = "block";
  if (otpInput) otpInput.focus();
}

function hideOtpSection() {
  const otpSection = document.getElementById("otpSection");
  if (otpSection) otpSection.style.display = "none";
}

function showOtpStatus(message, type) {
  const statusEl = document.getElementById("otpStatus");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `otp-status ${type}`;
  }
}

function resetOtpStatus() {
  const statusEl = document.getElementById("otpStatus");
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "otp-status";
  }
}


// -------------------------------
// FORM SUBMIT
// -------------------------------
const form = document.getElementById("reportForm");
const statusEl = document.getElementById("status");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const place = document.getElementById("place").value.trim();

    // Check OTP verification first
    if (!isPhoneVerified) {
      statusEl.textContent = "❌ Please verify your phone number with OTP first.";
      statusEl.style.color = "#dc2626";
      showOtpModal(); // Show modal for verification
      return;
    }

    if (!name || !phone || !place || !selectedImage) {
      statusEl.textContent = "❌ Please fill all fields properly.";
      statusEl.style.color = "#dc2626";
      return;
    }

    statusEl.textContent = "Uploading...";
    statusEl.style.color = "#64748b";

    const fd = new FormData();
    fd.append("name", name);
    fd.append("phone", phone);
    fd.append("place", place);
    fd.append("image", selectedImage);

    try {
      const res = await apiCall("/submit", {
        method: "POST",
        body: fd
      });

      const data = await res.json();

      if (data.success) {
        statusEl.textContent = "✅ Report submitted successfully!";
        statusEl.style.color = "#16a34a";
        form.reset();
        preview.style.display = "none";
        selectedImage = null;
        gpsStatus.textContent = "";
        // Reset map marker to default if needed, or leave it
      } else {
        statusEl.textContent = "❌ Error: " + data.message;
        statusEl.style.color = "#dc2626";
      }

    } catch (error) {
      statusEl.textContent = "❌ Network error. Make sure server is running.";
      statusEl.style.color = "#dc2626";
      console.error("Error:", error);
    }
  });
}

// -------------------------------
// MANUAL ADDRESS GEOCODING
// -------------------------------

// Manual address input functionality
const manualAddressInput = document.getElementById("manualAddress");
const clearLocationBtn = document.getElementById("clearLocationBtn");

// Handle manual address input
manualAddressInput.addEventListener('keypress', async function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const address = manualAddressInput.value.trim();
    if (address) {
      await geocodeAddress(address);
    }
  }
});

// Clear location functionality
clearLocationBtn.addEventListener('click', function () {
  placeInput.value = '';
  manualAddressInput.value = '';
  gpsStatus.textContent = 'Location cleared - type address, use GPS, or click on map';
  gpsStatus.style.color = '#64748b';

  // Reset map to default location
  const defaultLat = 28.6139;
  const defaultLng = 77.2090;
  map.setView([defaultLat, defaultLng], 13);
  marker.setLatLng([defaultLat, defaultLng]);
});

// Use default location (for testing/when GPS not available)
document.getElementById('defaultLocationBtn').addEventListener('click', async function (e) {
  e.preventDefault();
  gpsStatus.textContent = "📌 Loading default location...";
  gpsStatus.style.color = "#0984e3";
  
  // Use a known location in India (New Delhi - India Gate)
  const defaultAddress = "India Gate, New Delhi";
  await geocodeAddress(defaultAddress);
});

// Geocode address to coordinates and update map
async function geocodeAddress(address) {
  gpsStatus.textContent = "🔍 Searching for address...";
  gpsStatus.style.color = "#0984e3";

  try {
    // Using Nominatim for geocoding (forward geocoding)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=IN`,
      { headers: { 'User-Agent': 'PotholeReporter/1.0' } }
    );

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      // Update map and marker
      map.setView([lat, lng], 16);
      marker.setLatLng([lat, lng]);

      // Update location field
      updateLocation(lat, lng);

      gpsStatus.textContent = "✅ Address found and pinned on map!";
      gpsStatus.style.color = "#00b894";
    } else {
      gpsStatus.textContent = "❌ Address not found. Try a more specific location.";
      gpsStatus.style.color = "#d63031";
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    gpsStatus.textContent = "❌ Error searching address. Please try again.";
    gpsStatus.style.color = "#d63031";
  }
}