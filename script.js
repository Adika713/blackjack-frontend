// Base URL for API requests
const BASE_URL = 'https://blackjack-backend-aew7.onrender.com';

// Function to fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Check authentication status
async function checkAuth() {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/check-auth`, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
    });
    if (response.status === 200) {
      const data = await response.json();
      return data.authenticated;
    }
    return false;
  } catch (error) {
    console.error('Check Auth Error:', error);
    return false;
  }
}

// Fetch balance from the backend
async function fetchBalance() {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/balance`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.chips;
  } catch (error) {
    console.error('Balance Error:', error);
    throw error;
  }
}

// Function to update the UI with the balance
function updateBalanceUI(chips) {
  const balanceElement = document.getElementById('balance');
  if (balanceElement) {
    balanceElement.textContent = `Balance: ${chips} chips`;
  }
}

// Initialize the page
async function initializePage() {
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    try {
      const chips = await fetchBalance();
      updateBalanceUI(chips);
    } catch (error) {
      console.error('Failed to fetch balance on page load:', error);
    }
  } else {
    console.log('User not authenticated, skipping balance fetch.');
  }
}

// Show registration popup
function showRegisterPopup() {
  const popup = document.getElementById('registerPopup');
  if (popup) {
    popup.style.display = 'block';
  }
}

// Hide registration popup
function hideRegisterPopup() {
  const popup = document.getElementById('registerPopup');
  if (popup) {
    popup.style.display = 'none';
  }
}

// Register a new user
async function registerUser(username, email, password) {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!response.ok) {
      throw new Error(`Registration failed with status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Registration successful:', data);
    hideRegisterPopup();
    // Verify authentication after registration
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
      initializePage();
    } else {
      console.warn('JWT token not received after registration.');
    }
    return data;
  } catch (error) {
    console.error('Registration Error:', error);
    throw error;
  }
}

// Handle registration form submission
function handleRegisterFormSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  registerUser(username, email, password)
    .then(() => console.log('Registration completed, page initialized'))
    .catch((error) => alert(`Registration failed: ${error.message}`));
}

// Login a user
async function loginUser(email, password) {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(`Login failed with status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Login successful:', data);
    initializePage();
    return data;
  } catch (error) {
    console.error('Login Error:', error);
    throw error;
  }
}

// Handle login form submission (placeholder, adjust as needed)
function handleLoginFormSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  loginUser(email, password)
    .then(() => console.log('Login completed, page initialized'))
    .catch((error) => alert(`Login failed: ${error.message}`));
}

// Run initialization and setup event listeners when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initializePage();

  // Check if user is authenticated, show register popup if not
  checkAuth().then((isAuthenticated) => {
    if (!isAuthenticated) {
      showRegisterPopup();
    }
  });

  // Add event listener for registration form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterFormSubmit);
  }

  // Add event listener for login form (placeholder)
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginFormSubmit);
  }
});