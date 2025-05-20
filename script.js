const BACKEND_URL = 'https://blackjack-backend-aew7.onrender.com';
let jwtToken = localStorage.getItem('jwtToken') || null;
let user = null;
let balance = 1000; // Default for unauthenticated users
let deck = [];
let playerHand = [];
let dealerHand = [];
let gameState = 'idle';
let currentBet = 0;

// Fetch with timeout and logging
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  console.log('Fetching:', url, 'Options:', options, 'Token:', jwtToken ? jwtToken.slice(0, 10) + '...' : 'none');
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {})
      }
    });
    clearTimeout(id);
    console.log('Fetch response:', url, 'Status:', response.status, 'Headers:', Object.fromEntries(response.headers));
    return response;
  } catch (error) {
    clearTimeout(id);
    console.error('Fetch error:', url, error);
    throw error;
  }
}

// Register user
async function registerUser(username, email, password) {
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
      credentials: 'include'
    });
    const data = await response.json();
    console.log('Register response:', data, 'Set-Cookie:', response.headers.get('set-cookie'));
    if (response.ok && data.token) {
      jwtToken = data.token;
      localStorage.setItem('jwtToken', jwtToken);
      console.log('Stored JWT token:', jwtToken.slice(0, 10) + '...', 'LocalStorage:', localStorage.getItem('jwtToken'));
      user = data.user;
      await fetchBalance();
      updateUIAfterAuth();
    } else {
      console.log('Register failed:', data.error);
    }
    return { status: response.status, data };
  } catch (err) {
    console.error('Register error:', err);
    throw err;
  }
}

// Login user
async function loginUser(email, password) {
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    const data = await response.json();
    console.log('Login response:', data, 'Set-Cookie:', response.headers.get('set-cookie'));
    if (response.ok && data.token) {
      jwtToken = data.token;
      localStorage.setItem('jwtToken', jwtToken);
      console.log('Stored JWT token:', jwtToken.slice(0, 10) + '...', 'LocalStorage:', localStorage.getItem('jwtToken'));
      user = data.user;
      await fetchBalance();
      updateUIAfterAuth();
    } else {
      console.log('Login failed:', data.error);
    }
    return { status: response.status, data };
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
}

// Fetch balance
async function fetchBalance() {
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/balance`, {
      credentials: 'include'
    });
    console.log('Balance Fetch Status:', response.status, 'Token Sent:', !!jwtToken, 'Cookies:', document.cookie);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch balance');
    balance = data.chips;
    updateBalanceDisplay();
    return balance;
  } catch (err) {
    console.error('Balance Error:', err);
    showError('Failed to fetch balance. Please log in again.');
    return null;
  }
}

// Check authentication
async function checkAuth() {
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/check-auth`, {
      credentials: 'include'
    });
    const data = await response.json();
    console.log('Check-auth response:', data);
    if (response.ok && data.authenticated) {
      user = data.user;
      await fetchBalance();
      updateUIAfterAuth();
    } else {
      console.log('Not authenticated:', data.error || 'No valid session');
      user = null;
      jwtToken = null;
      localStorage.removeItem('jwtToken');
      updateUIAfterAuth();
    }
  } catch (err) {
    console.error('Check-auth error:', err);
    user = null;
    jwtToken = null;
    localStorage.removeItem('jwtToken');
    updateUIAfterAuth();
  }
}

// Initialize deck
function initializeDeck() {
  const suits = ['♠', '♥', '♣', '♦'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  shuffleDeck();
}

// Shuffle deck
function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Deal card
function dealCard(hand) {
  if (deck.length === 0) initializeDeck();
  const card = deck.pop();
  hand.push(card);
  return card;
}

// Calculate hand value
function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;
  for (let card of hand) {
    if (card.value === 'A') {
      aces++;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  for (let i = 0; i < aces; i++) {
    if (value + 11 <= 21) {
      value += 11;
    } else {
      value += 1;
    }
  }
  return value;
}

// Place bet
async function placeBet(amount) {
  if (!user) {
    showError('Please log in to place a bet.');
    return false;
  }
  if (amount <= 0 || amount > balance) {
    showError('Invalid bet amount.');
    return false;
  }
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/game/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet: amount }),
      credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to place bet');
    balance = data.chips;
    currentBet = amount;
    updateBalanceDisplay();
    return true;
  } catch (err) {
    console.error('Bet error:', err);
    showError('Failed to place bet.');
    return false;
  }
}

// Submit game result
async function submitGameResult(won, chipsWon) {
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/game/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ won, chipsWon }),
      credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to submit result');
    balance = data.chips;
    updateBalanceDisplay();
  } catch (err) {
    console.error('Game result error:', err);
    showError('Failed to submit game result.');
  }
}

// Update balance display
function updateBalanceDisplay() {
  const balanceElement = document.getElementById('balance');
  if (balanceElement) {
    balanceElement.textContent = `Chips: ${balance}`;
  } else {
    console.warn('Balance element not found (#balance)');
  }
}

// Update UI after auth
function updateUIAfterAuth() {
  console.log('Updating UI, Page:', window.location.href, 'DOM Elements:', {
    loginButton: !!document.getElementById('loginButton'),
    profileButton: !!document.getElementById('profileButton'),
    balance: !!document.getElementById('balance')
  });

  const loginButton = document.getElementById('loginButton');
  const profileButton = document.getElementById('profileButton');
  const balanceElement = document.getElementById('balance');

  // Log missing elements
  if (!loginButton) console.warn('Login button not found (#loginButton)');
  if (!profileButton) console.warn('Profile button not found (#profileButton)');
  if (!balanceElement) console.warn('Balance element not found (#balance)');

  // Skip if no relevant elements exist
  if (!loginButton && !profileButton && !balanceElement) {
    console.warn('No auth-related elements found, skipping UI update');
    return;
  }

  try {
    if (user) {
      if (loginButton) loginButton.style.display = 'none';
      if (profileButton) profileButton.style.display = 'inline-block';
      if (balanceElement) {
        balanceElement.style.display = 'inline-block';
        updateBalanceDisplay();
      }
    } else {
      if (loginButton) loginButton.style.display = 'inline-block';
      if (profileButton) profileButton.style.display = 'none';
      if (balanceElement) balanceElement.style.display = 'none';
    }
  } catch (err) {
    console.error('Error in updateUIAfterAuth:', err);
  }
}

// Show error message
function showError(message) {
  const errorElement = document.getElementById('errorMessage');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
      if (errorElement) errorElement.style.display = 'none';
    }, 5000);
  } else {
    console.warn('Error message element not found (#errorMessage)');
    alert(message);
  }
}

// Game logic
async function startGame(betAmount) {
  if (gameState !== 'idle') return;
  const betSuccess = await placeBet(betAmount);
  if (!betSuccess) return;

  gameState = 'playing';
  initializeDeck();
  playerHand = [];
  dealerHand = [];
  dealCard(playerHand);
  dealCard(dealerHand);
  dealCard(playerHand);
  dealCard(dealerHand);
  updateGameDisplay();

  if (calculateHandValue(playerHand) === 21) {
    endGame('player');
  }
}

function hit() {
  if (gameState !== 'playing') return;
  dealCard(playerHand);
  updateGameDisplay();
  if (calculateHandValue(playerHand) > 21) {
    endGame('dealer');
  }
}

function stand() {
  if (gameState !== 'playing') return;
  while (calculateHandValue(dealerHand) < 17) {
    dealCard(dealerHand);
  }
  updateGameDisplay();
  endGame();
}

async function endGame(winner) {
  gameState = 'idle';
  let playerValue = calculateHandValue(playerHand);
  let dealerValue = calculateHandValue(dealerHand);
  let result = '';

  if (winner === 'player' || (!winner && playerValue <= 21 && (playerValue > dealerValue || dealerValue > 21))) {
    result = 'Player wins!';
    await submitGameResult(true, currentBet * 2);
  } else {
    result = 'Dealer wins!';
    await submitGameResult(false, 0);
  }

  updateGameDisplay(result);
  currentBet = 0;
}

// Update game display
function updateGameDisplay(result = '') {
  const gameArea = document.getElementById('gameArea');
  if (!gameArea) {
    console.warn('Game area not found (#gameArea)');
    return;
  }

  let html = `
    <p>Player Hand: ${playerHand.map(card => `${card.value}${card.suit}`).join(', ')} (${calculateHandValue(playerHand)})</p>
    <p>Dealer Hand: ${dealerHand.map(card => `${card.value}${card.suit}`).join(', ')} (${calculateHandValue(dealerHand)})</p>
  `;
  if (result) {
    html += `<p>${result}</p>`;
  }
  gameArea.innerHTML = html;

  const hitButton = document.getElementById('hitButton');
  const standButton = document.getElementById('standButton');
  if (hitButton) hitButton.disabled = gameState !== 'playing';
  if (standButton) standButton.disabled = gameState !== 'playing';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking auth...', 'Page:', window.location.href);
  // Delay checkAuth to ensure DOM is fully loaded
  setTimeout(() => {
    checkAuth();
  }, 100);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername')?.value;
      const email = document.getElementById('registerEmail')?.value;
      const password = document.getElementById('registerPassword')?.value;
      if (!username || !email || !password) {
        showError('Please fill in all fields.');
        return;
      }
      try {
        const result = await registerUser(username, email, password);
        if (result.status === 200) {
          window.location.href = '/?page=profil';
        } else {
          showError(result.data.error || 'Registration failed.');
        }
      } catch (err) {
        showError('Registration failed. Please try again.');
      }
    });
  } else {
    console.warn('Register form not found (#registerForm)');
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value;
      const password = document.getElementById('loginPassword')?.value;
      if (!email || !password) {
        showError('Please fill in all fields.');
        return;
      }
      try {
        const result = await loginUser(email, password);
        if (result.status === 200) {
          window.location.href = '/?page=profil';
        } else {
          showError(result.data.error || 'Login failed.');
        }
      } catch (err) {
        showError('Login failed. Please try again.');
      }
    });
  } else {
    console.warn('Login form not found (#loginForm)');
  }

  const betButton = document.getElementById('betButton');
  if (betButton) {
    betButton.addEventListener('click', () => {
      const betInput = document.getElementById('betAmount');
      const betAmount = betInput ? parseInt(betInput.value) : 0;
      if (betAmount <= 0) {
        showError('Please enter a valid bet amount.');
        return;
      }
      startGame(betAmount);
    });
  } else {
    console.warn('Bet button not found (#betButton)');
  }

  const hitButton = document.getElementById('hitButton');
  if (hitButton) {
    hitButton.addEventListener('click', hit);
  } else {
    console.warn('Hit button not found (#hitButton)');
  }

  const standButton = document.getElementById('standButton');
  if (standButton) {
    standButton.addEventListener('click', stand);
  } else {
    console.warn('Stand button not found (#standButton)');
  }

  const loginButton = document.getElementById('loginButton');
  if (loginButton) {
    loginButton.addEventListener('click', () => {
      const authPopup = document.getElementById('authPopup');
      if (authPopup) {
        authPopup.style.display = 'block';
      } else {
        console.warn('Auth popup not found (#authPopup)');
      }
    });
  } else {
    console.warn('Login button not found (#loginButton)');
  }

  const closePopup = document.getElementById('closePopup');
  if (closePopup) {
    closePopup.addEventListener('click', () => {
      const authPopup = document.getElementById('authPopup');
      if (authPopup) {
        authPopup.style.display = 'none';
      }
    });
  } else {
    console.warn('Close popup button not found (#closePopup)');
  }
});