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

// Fetch balance from the backend
async function fetchBalance() {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/balance`, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
    });
    console.log('Balance Fetch Status:', response.status);
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

// Check authentication status
async function checkAuth() {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/check-auth`, {
      method: 'GET',
      credentials: 'include',
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

// Function to update the UI with the balance (placeholder)
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

// Run initialization when the page loads
document.addEventListener('DOMContentLoaded', initializePage);