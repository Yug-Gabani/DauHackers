// DOM Elements
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const loginBtn = document.querySelector('.login-btn');
const loginModal = document.getElementById('loginModal');
const closeModal = document.querySelector('.close');
const reportForm = document.getElementById('reportForm');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const smsForm = document.getElementById('smsForm');
const filterBtns = document.querySelectorAll('.filter-btn');
const alertCards = document.querySelectorAll('.alerts-grid .alert-card');
const languageSelect = document.getElementById('languageSelect');
const signupModal = document.getElementById('signupModal');
const showSignupLink = document.getElementById('showSignup');
const showLoginLink = document.getElementById('showLogin');

// Mobile Navigation Toggle
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Login Modal Functionality
loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
});

closeModal.addEventListener('click', () => {
    loginModal.style.display = 'none';
    signupModal.style.display = 'none';
    document.body.style.overflow = 'auto';
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    if (e.target === signupModal) {
        signupModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// Form Submissions
reportForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(reportForm);
    const reportData = {
        name: formData.get('name') || document.getElementById('name').value,
        email: formData.get('email') || document.getElementById('email').value,
        issue: formData.get('issue') || document.getElementById('issue').value,
        location: formData.get('location') || document.getElementById('location').value,
        description: formData.get('description') || document.getElementById('description').value
    };
    
    // Simulate form submission
    showNotification('Report submitted successfully! Our team will review it shortly.', 'success');
    reportForm.reset();
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Simulate login
    if (email && password) {
        showNotification('Login successful!', 'success');
        loginModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        loginForm.reset();
    } else {
        showNotification('Please fill in all fields.', 'error');
    }
});

// Sign Up Form
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const location = document.getElementById('signupLocation').value;
    const userType = document.getElementById('signupUserType').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const terms = document.getElementById('signupTerms').checked;
    const alerts = document.getElementById('signupAlerts').checked;
    
    // Validation
    if (!name || !email || !phone || !location || !userType || !password || !confirmPassword) {
        showNotification('Please fill in all required fields.', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match.', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long.', 'error');
        return;
    }
    
    if (!terms) {
        showNotification('Please agree to the Terms of Service and Privacy Policy.', 'error');
        return;
    }
    
    // Simulate sign up
    showNotification(`Account created successfully! Welcome ${name}. You will receive alerts for ${location}.`, 'success');
    signupModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    signupForm.reset();
    
    // Re-check default checkbox
    document.getElementById('signupAlerts').checked = true;
});

// Modal Navigation
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginModal.style.display = 'none';
    signupModal.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupModal.style.display = 'none';
    loginModal.style.display = 'block';
});

// SMS Registration Form
smsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const phone = document.getElementById('smsPhone').value;
    const language = document.getElementById('smsLanguage').value;
    const location = document.getElementById('smsLocation').value;
    const alertTypes = Array.from(document.querySelectorAll('#smsAlerts input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
    
    if (phone && language && location && alertTypes.length > 0) {
        showNotification('SMS registration successful! You will receive alerts in ' + language, 'success');
        smsForm.reset();
        // Re-check default checkboxes
        document.querySelectorAll('#smsAlerts input[type="checkbox"]').forEach(checkbox => {
            if (['storm', 'tide', 'emergency'].includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });
    } else {
        showNotification('Please fill in all required fields and select at least one alert type.', 'error');
    }
});

// Language Selection
languageSelect.addEventListener('change', (e) => {
    const selectedLanguage = e.target.value;
    showNotification(`Language changed to ${selectedLanguage}`, 'info');
    // In a real application, this would trigger language translation
});

// Alert Filtering
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        filterBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');
        
        const filter = btn.getAttribute('data-filter');
        
        alertCards.forEach(card => {
            if (filter === 'all' || card.classList.contains(filter)) {
                card.style.display = 'block';
                card.style.animation = 'fadeIn 0.5s ease-in';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        z-index: 3000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#10b981';
        case 'error': return '#ef4444';
        case 'warning': return '#f59e0b';
        default: return '#3b82f6';
    }
}

// Real-time Data Simulation
function updateStatusCards() {
    const statusCards = document.querySelectorAll('.status-card');
    
    statusCards.forEach(card => {
        const indicator = card.querySelector('.status-indicator');
        if (indicator) {
            // Simulate real-time updates
            setInterval(() => {
                indicator.style.animation = 'none';
                setTimeout(() => {
                    indicator.style.animation = 'pulse 2s infinite';
                }, 10);
            }, 5000);
        }
    });
}

// Weather Data Simulation
function updateWeatherData() {
    const weatherItems = document.querySelectorAll('.weather-item span');
    
    setInterval(() => {
        weatherItems.forEach(item => {
            const currentText = item.textContent;
            if (currentText.includes('Rain:')) {
                const newRain = Math.floor(Math.random() * 100);
                item.textContent = `Rain: ${newRain}%`;
            } else if (currentText.includes('Temp:')) {
                const newTemp = Math.floor(Math.random() * 10) + 25;
                item.textContent = `Temp: ${newTemp}°C`;
            } else if (currentText.includes('Pressure:')) {
                const newPressure = Math.floor(Math.random() * 20) + 1000;
                item.textContent = `Pressure: ${newPressure} hPa`;
            }
        });
    }, 10000);
}

// Enhanced Tide Information System
let tideData = {
    currentLevel: 2.4,
    highTide: { time: '14:30', level: 3.8 },
    lowTide: { time: '08:15', level: 0.6 },
    predictions: []
};

// Generate 24-hour tide predictions
function generateTidePredictions() {
    const predictions = [];
    const now = new Date();
    const baseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (let i = 0; i < 24; i++) {
        const time = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
        const hour = time.getHours();
        
        // Simulate realistic tide patterns (2 high tides and 2 low tides per day)
        let level;
        if (hour === 2 || hour === 14) {
            level = 3.8 + (Math.random() - 0.5) * 0.4; // High tide
        } else if (hour === 8 || hour === 20) {
            level = 0.6 + (Math.random() - 0.5) * 0.3; // Low tide
        } else {
            // Interpolate between high and low tides
            const progress = (hour % 6) / 6;
            if (hour < 6 || (hour >= 12 && hour < 18)) {
                level = 0.6 + progress * 3.2; // Rising
            } else {
                level = 3.8 - progress * 3.2; // Falling
            }
            level += (Math.random() - 0.5) * 0.2;
        }
        
        predictions.push({
            time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            level: Math.round(level * 10) / 10,
            type: hour === 2 || hour === 14 ? 'HIGH' : hour === 8 || hour === 20 ? 'LOW' : 'NORMAL'
        });
    }
    
    return predictions;
}

// Enhanced Tide Chart with detailed visualization
function createTideChart() {
    const canvas = document.getElementById('tideChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (height - 2 * padding) * i / 4;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw tide curve
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const predictions = tideData.predictions;
    const stepX = (width - 2 * padding) / (predictions.length - 1);
    
    predictions.forEach((prediction, index) => {
        const x = padding + index * stepX;
        const normalizedLevel = (prediction.level - 0.5) / 3.5; // Normalize to 0-1
        const y = height - padding - normalizedLevel * (height - 2 * padding);
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Draw current time indicator
    const currentHour = new Date().getHours();
    const currentIndex = predictions.findIndex(p => parseInt(p.time.split(':')[0]) === currentHour);
    if (currentIndex !== -1) {
        const x = padding + currentIndex * stepX;
        const normalizedLevel = (tideData.currentLevel - 0.5) / 3.5;
        const y = height - padding - normalizedLevel * (height - 2 * padding);
        
        // Draw current position indicator
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw current level text
        ctx.fillStyle = '#1f2937';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${tideData.currentLevel}m`, x, y - 10);
    }
    
    // Draw time labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < predictions.length; i += 4) {
        const x = padding + i * stepX;
        ctx.fillText(predictions[i].time, x, height - 5);
    }
}

// Update tide statistics
function updateTideStats() {
    const currentLevelEl = document.getElementById('currentTideLevel');
    const highTideTimeEl = document.getElementById('highTideTime');
    const lowTideTimeEl = document.getElementById('lowTideTime');
    const nextTideChangeEl = document.getElementById('nextTideChange');
    
    if (currentLevelEl) currentLevelEl.textContent = `${tideData.currentLevel}m`;
    if (highTideTimeEl) highTideTimeEl.textContent = tideData.highTide.time;
    if (lowTideTimeEl) lowTideTimeEl.textContent = tideData.lowTide.time;
    
    // Calculate next tide change
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    let nextChange = '';
    if (currentHour < 8) {
        const minutesToLow = (8 - currentHour) * 60 - currentMinute;
        nextChange = `${Math.floor(minutesToLow / 60)}h ${minutesToLow % 60}m to Low`;
    } else if (currentHour < 14) {
        const minutesToHigh = (14 - currentHour) * 60 - currentMinute;
        nextChange = `${Math.floor(minutesToHigh / 60)}h ${minutesToHigh % 60}m to High`;
    } else if (currentHour < 20) {
        const minutesToLow = (20 - currentHour) * 60 - currentMinute;
        nextChange = `${Math.floor(minutesToLow / 60)}h ${minutesToLow % 60}m to Low`;
    } else {
        const minutesToHigh = (26 - currentHour) * 60 - currentMinute;
        nextChange = `${Math.floor(minutesToHigh / 60)}h ${minutesToHigh % 60}m to High`;
    }
    
    if (nextTideChangeEl) nextTideChangeEl.textContent = nextChange;
}



// Simulate real-time tide level changes
function simulateTideChanges() {
    setInterval(() => {
        // Simulate small variations in current tide level
        tideData.currentLevel += (Math.random() - 0.5) * 0.1;
        tideData.currentLevel = Math.max(0.5, Math.min(4.0, tideData.currentLevel));
        tideData.currentLevel = Math.round(tideData.currentLevel * 10) / 10;
        
        updateTideStats();
        createTideChart();
    }, 30000); // Update every 30 seconds
}

// Initialize tide information system
function initializeTideSystem() {
    tideData.predictions = generateTidePredictions();
    updateTideStats();
    createTideChart();
    simulateTideChanges();
}

// Alert System Simulation
function simulateNewAlert() {
    const alerts = [
        {
            type: 'warning',
            title: 'High Tide Warning',
            message: 'Unusually high tide expected in the next 3 hours.',
            time: '1 hour ago'
        },
        {
            type: 'info',
            title: 'Water Quality Update',
            message: 'Water quality tests completed. Safe for swimming.',
            time: '2 hours ago'
        },
        {
            type: 'critical',
            title: 'Storm Alert',
            message: 'Severe weather conditions approaching coastal areas.',
            time: '30 minutes ago'
        }
    ];
    
    setInterval(() => {
        const randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
        showNotification(`New Alert: ${randomAlert.title}`, randomAlert.type);
    }, 30000);
}

// Community Reports Simulation
function updateCommunityReports() {
    const reports = [
        {
            title: 'Illegal Dumping',
            description: 'Reported near Marina Beach',
            status: 'Verified by authorities'
        },
        {
            title: 'Oil Spill',
            description: 'Spotted near fishing harbor',
            status: 'Under investigation'
        },
        {
            title: 'Beach Erosion',
            description: 'Significant erosion observed',
            status: 'Being monitored'
        }
    ];
    
    const reportsContainer = document.querySelector('.reports-container');
    if (reportsContainer) {
        setInterval(() => {
            const randomReport = reports[Math.floor(Math.random() * reports.length)];
            const newReport = document.createElement('div');
            newReport.className = 'report-item';
            newReport.innerHTML = `
                <i class="fas fa-user"></i>
                <div>
                    <h4>${randomReport.title}</h4>
                    <p>${randomReport.description}</p>
                    <small>${randomReport.status}</small>
                </div>
            `;
            
            // Add to the left column first, then right column
            const leftColumn = reportsContainer.querySelector('.reports-column:first-child');
            const rightColumn = reportsContainer.querySelector('.reports-column:last-child');
            
            if (leftColumn && rightColumn) {
                // Determine which column has fewer items
                const leftCount = leftColumn.children.length;
                const rightCount = rightColumn.children.length;
                
                if (leftCount <= rightCount) {
                    leftColumn.insertBefore(newReport, leftColumn.firstChild);
                    
                    // Remove old reports if too many in left column
                    if (leftColumn.children.length > 4) {
                        leftColumn.removeChild(leftColumn.lastChild);
                    }
                } else {
                    rightColumn.insertBefore(newReport, rightColumn.firstChild);
                    
                    // Remove old reports if too many in right column
                    if (rightColumn.children.length > 4) {
                        rightColumn.removeChild(rightColumn.lastChild);
                    }
                }
            }
        }, 45000);
    }
}

// Navbar Scroll Effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 30px rgba(0, 0, 0, 0.15)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    }
});

// Intersection Observer for Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.feature-card, .status-card, .dashboard-card, .impact-card');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Emergency Alert System
function createEmergencyAlert() {
    const emergencyBtn = document.createElement('button');
    emergencyBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> EMERGENCY';
    emergencyBtn.className = 'emergency-btn';
    emergencyBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: #ef4444;
        color: white;
        border: none;
        padding: 15px 25px;
        border-radius: 50px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3);
        z-index: 1000;
        transition: all 0.3s ease;
        animation: pulse 2s infinite;
    `;
    
    emergencyBtn.addEventListener('click', () => {
        showNotification('Emergency services have been notified. Please follow evacuation procedures.', 'error');
        // Simulate emergency call
        setTimeout(() => {
            showNotification('Emergency response team is on the way.', 'info');
        }, 2000);
    });
    
    document.body.appendChild(emergencyBtn);
}

// Initialize all functions
document.addEventListener('DOMContentLoaded', () => {
    updateStatusCards();
    updateWeatherData();
    initializeTideSystem();
    updateCommunityReports();
    createEmergencyAlert();
    initializeCoastalMap();
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: white;
            font-size: 1.2rem;
            cursor: pointer;
            margin-left: auto;
        }
        
        .emergency-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 15px 40px rgba(239, 68, 68, 0.4);
        }
    `;
    document.head.appendChild(style);
});

// Initialize Coastal Map
function initializeCoastalMap() {
    const mapContainer = document.getElementById('coastalMap');
    if (!mapContainer) return;

    // Wait for Leaflet to be loaded
    if (typeof L === 'undefined') {
        setTimeout(initializeCoastalMap, 100);
        return;
    }

    // Initialize the map centered on Indian coastline with better zoom
    const map = L.map('coastalMap').setView([20.5937, 78.9629], 6);
    mapInstance = map; // Store globally for fullscreen functionality

    // Add enhanced OpenStreetMap tiles with better styling
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        minZoom: 4
    }).addTo(map);

               // Add coastal monitoring stations with more detailed information
           coastalStations = [
               { lat: 19.0760, lng: 72.8777, name: 'Mumbai', status: 'safe', alerts: 2, population: '20.4M', lastUpdate: '2 min ago' },
               { lat: 15.2993, lng: 74.1240, name: 'Goa', status: 'warning', alerts: 1, population: '1.5M', lastUpdate: '5 min ago' },
               { lat: 10.8505, lng: 76.2711, name: 'Kerala', status: 'critical', alerts: 3, population: '35.7M', lastUpdate: '1 min ago' },
               { lat: 13.0827, lng: 80.2707, name: 'Chennai', status: 'safe', alerts: 0, population: '11.2M', lastUpdate: '3 min ago' },
               { lat: 17.3850, lng: 78.4867, name: 'Hyderabad', status: 'safe', alerts: 1, population: '9.7M', lastUpdate: '4 min ago' },
               { lat: 20.2961, lng: 85.8245, name: 'Bhubaneswar', status: 'warning', alerts: 2, population: '4.6M', lastUpdate: '6 min ago' },
               { lat: 22.5726, lng: 88.3639, name: 'Kolkata', status: 'safe', alerts: 0, population: '14.8M', lastUpdate: '2 min ago' },
               { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad', status: 'safe', alerts: 1, population: '7.2M', lastUpdate: '5 min ago' },
               { lat: 12.9716, lng: 77.5946, name: 'Bangalore', status: 'safe', alerts: 0, population: '12.3M', lastUpdate: '3 min ago' },
               { lat: 28.6139, lng: 77.2090, name: 'Delhi', status: 'safe', alerts: 1, population: '31.2M', lastUpdate: '1 min ago' },
               { lat: 25.2048, lng: 55.2708, name: 'Dubai', status: 'warning', alerts: 2, population: '3.3M', lastUpdate: '4 min ago' },
               { lat: 6.9271, lng: 79.8612, name: 'Colombo', status: 'safe', alerts: 0, population: '2.1M', lastUpdate: '7 min ago' }
           ];

               // Enhanced custom icons for different status levels
           const createCustomIcon = (status) => {
               const colors = {
                   safe: '#10b981',
                   warning: '#f59e0b',
                   critical: '#ef4444'
               };
               
               const pulseAnimation = status === 'critical' ? 'pulse-animation' : '';
               
               return L.divIcon({
                   className: 'custom-marker',
                   html: `<div style="
                       width: 24px; 
                       height: 24px; 
                       background-color: ${colors[status]}; 
                       border: 4px solid white; 
                       border-radius: 50%; 
                       box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                       position: relative;
                       animation: ${pulseAnimation} 2s infinite;
                   "></div>`,
                   iconSize: [24, 24],
                   iconAnchor: [12, 12]
               });
           };

    // Add markers for each coastal station
    coastalStations.forEach(station => {
        const marker = L.marker([station.lat, station.lng], {
            icon: createCustomIcon(station.status)
        }).addTo(map);

                       const popupContent = `
                   <div style="min-width: 280px; font-family: 'Inter', sans-serif;">
                       <div style="display: flex; align-items: center; margin-bottom: 15px;">
                           <div style="
                               width: 16px; 
                               height: 16px; 
                               background-color: ${station.status === 'safe' ? '#10b981' : station.status === 'warning' ? '#f59e0b' : '#ef4444'}; 
                               border-radius: 50%; 
                               margin-right: 10px;
                           "></div>
                           <h4 style="margin: 0; color: #1f2937; font-size: 1.2rem;">${station.name}</h4>
                       </div>
                       <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                           <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                               <span style="color: #6b7280; font-weight: 500;">Status:</span>
                               <span style="color: ${station.status === 'safe' ? '#10b981' : station.status === 'warning' ? '#f59e0b' : '#ef4444'}; font-weight: 600;">
                                   ${station.status.charAt(0).toUpperCase() + station.status.slice(1)}
                               </span>
                           </div>
                           <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                               <span style="color: #6b7280; font-weight: 500;">Active Alerts:</span>
                               <span style="color: #1f2937; font-weight: 600;">${station.alerts}</span>
                           </div>
                           <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                               <span style="color: #6b7280; font-weight: 500;">Population:</span>
                               <span style="color: #1f2937; font-weight: 600;">${station.population}</span>
                           </div>
                           <div style="display: flex; justify-content: space-between;">
                               <span style="color: #6b7280; font-weight: 500;">Last Update:</span>
                               <span style="color: #1f2937; font-weight: 600;">${station.lastUpdate}</span>
                           </div>
                       </div>
                       <div style="display: flex; gap: 8px;">
                           <button onclick="showNotification('Viewing detailed analytics for ${station.name}', 'info')" 
                                   style="background: #1e40af; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; flex: 1;">
                               View Analytics
                           </button>
                           <button onclick="showNotification('Sending alert to ${station.name} authorities', 'success')" 
                                   style="background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; flex: 1;">
                               Send Alert
                           </button>
                       </div>
                   </div>
               `;

        marker.bindPopup(popupContent);
    });

    // Enhanced legend with better styling
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        div.style.padding = '15px';
        div.style.borderRadius = '10px';
        div.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)';
        div.style.border = '1px solid rgba(0,0,0,0.1)';
        div.style.fontFamily = "'Inter', sans-serif";
        div.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #1f2937; font-size: 1.1rem; font-weight: 600;">Coastal Monitoring Status</h4>
            <div style="display: flex; align-items: center; margin: 8px 0;">
                <div style="width: 14px; height: 14px; background-color: #10b981; border-radius: 50%; margin-right: 10px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);"></div>
                <span style="color: #374151; font-weight: 500;">Safe - Normal Operations</span>
            </div>
            <div style="display: flex; align-items: center; margin: 8px 0;">
                <div style="width: 14px; height: 14px; background-color: #f59e0b; border-radius: 50%; margin-right: 10px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);"></div>
                <span style="color: #374151; font-weight: 500;">Warning - Monitor Closely</span>
            </div>
            <div style="display: flex; align-items: center; margin: 8px 0;">
                <div style="width: 14px; height: 14px; background-color: #ef4444; border-radius: 50%; margin-right: 10px; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3); animation: pulse-animation 2s infinite;"></div>
                <span style="color: #374151; font-weight: 500;">Critical - Immediate Action Required</span>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 0.85rem; color: #6b7280;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Total Stations:</span>
                    <span style="font-weight: 600;">${coastalStations.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Last Updated:</span>
                    <span style="font-weight: 600;">${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        `;
        return div;
    };
    legend.addTo(map);

    // Add scale control
    L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false,
        maxWidth: 200
    }).addTo(map);

    // Add fullscreen control
    const fullscreenControl = L.control({ position: 'topright' });
    fullscreenControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'fullscreen-control');
        div.innerHTML = `
            <button onclick="toggleMapFullscreen()" style="
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(0,0,0,0.1);
                border-radius: 8px;
                padding: 8px 12px;
                cursor: pointer;
                font-size: 14px;
                color: #374151;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: all 0.2s ease;
            " onmouseover="this.style.background='rgba(255,255,255,1)'" onmouseout="this.style.background='rgba(255,255,255,0.9)'">
                <i class="fas fa-expand"></i> Fullscreen
            </button>
        `;
        return div;
    };
    fullscreenControl.addTo(map);

    // Add search functionality
    const searchControl = L.control({ position: 'topleft' });
    searchControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'search-control');
        div.innerHTML = `
            <div style="
                background: rgba(255, 255, 255, 0.95);
                padding: 10px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                border: 1px solid rgba(0,0,0,0.1);
                min-width: 200px;
            ">
                <input type="text" id="stationSearch" placeholder="Search stations..." style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    outline: none;
                " onkeyup="searchStations(this.value)">
                <div id="searchResults" style="
                    margin-top: 8px;
                    max-height: 150px;
                    overflow-y: auto;
                    display: none;
                "></div>
            </div>
        `;
        return div;
    };
    searchControl.addTo(map);
}

// Global variables for map functionality
let mapInstance = null;
let coastalStations = [];

// Fullscreen toggle function
function toggleMapFullscreen() {
    const mapContainer = document.getElementById('coastalMap');
    if (!mapContainer) return;

    if (!document.fullscreenElement) {
        mapContainer.requestFullscreen().then(() => {
            if (mapInstance) {
                mapInstance.invalidateSize();
            }
            showNotification('Map entered fullscreen mode', 'info');
        }).catch(err => {
            showNotification('Fullscreen not supported', 'error');
        });
    } else {
        document.exitFullscreen().then(() => {
            if (mapInstance) {
                mapInstance.invalidateSize();
            }
            showNotification('Map exited fullscreen mode', 'info');
        });
    }
}

// Search stations function
function searchStations(query) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;

    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }

    const filteredStations = coastalStations.filter(station => 
        station.name.toLowerCase().includes(query.toLowerCase())
    );

    if (filteredStations.length > 0) {
        searchResults.innerHTML = filteredStations.map(station => `
            <div onclick="flyToStation(${station.lat}, ${station.lng})" style="
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #e5e7eb;
                font-size: 14px;
                color: #374151;
                transition: background-color 0.2s ease;
            " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                <div style="display: flex; align-items: center;">
                    <div style="
                        width: 10px; 
                        height: 10px; 
                        background-color: ${station.status === 'safe' ? '#10b981' : station.status === 'warning' ? '#f59e0b' : '#ef4444'}; 
                        border-radius: 50%; 
                        margin-right: 8px;
                    "></div>
                    <span style="font-weight: 500;">${station.name}</span>
                    <span style="margin-left: auto; color: #6b7280; font-size: 12px;">${station.status}</span>
                </div>
            </div>
        `).join('');
        searchResults.style.display = 'block';
    } else {
        searchResults.innerHTML = '<div style="padding: 8px 12px; color: #6b7280; font-size: 14px;">No stations found</div>';
        searchResults.style.display = 'block';
    }
}

// Fly to station function
function flyToStation(lat, lng) {
    if (mapInstance) {
        mapInstance.flyTo([lat, lng], 10, {
            duration: 1.5
        });
        showNotification('Flying to selected station', 'info');
    }
}

// Real-time Clock
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    // Update any clock elements on the page
    const clockElements = document.querySelectorAll('.clock');
    clockElements.forEach(element => {
        element.textContent = timeString;
    });
}

setInterval(updateClock, 1000);

// Geolocation for Local Alerts
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`User location: ${latitude}, ${longitude}`);
            // In a real application, this would be used to show location-specific alerts
        },
        (error) => {
            console.log('Geolocation not available');
        }
    );
}

// Service Worker Registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Offline Detection
window.addEventListener('online', () => {
    showNotification('Connection restored. All features are now available.', 'success');
});

window.addEventListener('offline', () => {
    showNotification('You are currently offline. Some features may be limited.', 'warning');
});

// Performance Monitoring
window.addEventListener('load', () => {
    const loadTime = performance.now();
    console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);
    
    if (loadTime > 3000) {
        console.warn('Page load time is slow. Consider optimizing assets.');
    }
});
