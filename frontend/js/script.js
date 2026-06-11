const form = document.getElementById("uploadForm");
const statusEl = document.getElementById("status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const place = document.getElementById("place").value.trim();
  const image = document.getElementById("image").files[0];

  if (!image) {
    statusEl.textContent = "⚠️ Please select an image before submitting.";
    statusEl.style.color = "#dc2626";
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("phone", phone);
  
  formData.append("image", image);

  let map;
let marker;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 20.5937, lng: 78.9629 }, // India
        zoom: 5,
    });

    map.addListener("click", (e) => {
        const position = e.latLng;

        if (marker) marker.setMap(null);

        marker = new google.maps.Marker({
            position,
            map,
        });

        document.getElementById("lat").value = position.lat();
        document.getElementById("lng").value = position.lng();
    });
}


  try {
    const res = await fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData
    });

    if (res.ok) {
      statusEl.textContent = "✅ Report uploaded successfully. Officers will review it soon.";
      form.reset();
    } else {
      statusEl.textContent = "❌ Upload failed. Try again later.";
      statusEl.style.color = "#dc2626";
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "⚠️ Cannot connect to server. Make sure Node.js is running on port 3000.";
    statusEl.style.color = "#dc2626";
  }
});


// Smooth hero fade-in
window.addEventListener("load", () => {
  const hero = document.querySelector(".hero-text");
  hero.style.opacity = 0;
  hero.style.transform = "translateY(25px)";

  setTimeout(() => {
    hero.style.transition = "0.8s ease";
    hero.style.opacity = 1;
    hero.style.transform = "translateY(0)";
  }, 200);
});

// Navbar shadow on scroll
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".navbar");
  if (window.scrollY > 20) nav.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
  else nav.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
});

