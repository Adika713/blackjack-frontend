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
  console.log('Fetching:', url, 'Options:', options);
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
    console.log('Fetch response:', url, 'Status:', response.status);
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
    console.log('Register response:', data);
    if (response.ok && data.token) {
      jwtToken = data.token;
      localStorage.setItem('jwtToken', jwtToken);
      console.log('Stored JWT token:', jwtToken.slice(0, 10) + '...');
      user = data.user;
      updateUIAfterAuth();
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
    console.log('Login response:', data);
    if (response.ok && data.token) {
      jwtToken = data.token;
      localStorage.setItem('jwtToken', jwtToken);
      console.log('Stored JWT token:', jwtToken.slice(0, 10) + '...');
      user = data.user;
      updateUIAfterAuth();
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
    console.log('Balance Fetch Status:', response.status);
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
  }
}

// Update UI after auth
function updateUIAfterAuth() {
  const loginButton = document.getElementById('loginButton');
  const profileButton = document.getElementById('profileButton');
  const balanceElement = document.getElementById('balance');
  if (user) {
    loginButton.style.display = 'none';
    profileButton.style.display = 'inline-block';
    balanceElement.style.display = 'inline-block';
    updateBalanceDisplay();
  } else {
    loginButton.style.display = 'inline-block';
    profileButton.style.display = 'none';
    balanceElement.style.display = 'none';
  }
}

// Show error message
function showError(message) {
  const errorElement = document.getElementById('errorMessage');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  } else {
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

// Update game display (simplified for canvas or DOM)
function updateGameDisplay(result = '') {
  const gameArea = document.getElementById('gameArea');
  if (!gameArea) return;

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
  hitButton.disabled = gameState !== 'playing';
  standButton.disabled = gameState !== 'playing';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
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
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
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
  }

  const betButton = document.getElementById('betButton');
  if (betButton) {
    betButton.addEventListener('click', () => {
      const betInput = document.getElementById('betAmount');
      const betAmount = parseInt(betInput.value);
      startGame(betAmount);
    });
  }

  const hitButton = document.getElementById('hitButton');
  if (hitButton) {
    hitButton.addEventListener('click', hit);
  }

  const standButton = document.getElementById('standButton');
  if (standButton) {
    standButton.addEventListener('click', stand);
  }

  const loginButton = document.getElementById('loginButton');
  if (loginButton) {
    loginButton.addEventListener('click', () => {
      document.getElementById('authPopup').style.display = 'block';
    });
  }

  const closePopup = document.getElementById('closePopup');
  if (closePopup) {
    closePopup.addEventListener('click', () => {
      document.getElementById('authPopup').style.display = 'none';
    });
  }
});