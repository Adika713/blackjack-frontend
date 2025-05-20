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
  console.log('Attempting register:', { username, email });
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
      return { status: response.status, data };
    } else {
      console.log('Register failed:', data.error);
      showError(data.error || 'Registration failed.');
      return { status: response.status, data };
    }
  } catch (err) {
    console.error('Register error:', err);
    showError('Registration failed. Please try again.');
    throw err;
  }
}

// Login user
async function loginUser(email, password) {
  console.log('Attempting login:', { email });
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
      return { status: response.status, data };
    } else {
      console.log('Login failed:', data.error);
      showError(data.error || 'Login failed.');
      return { status: response.status, data };
    }
  } catch (err) {
    console.error('Login error:', err);
    showError('Login failed. Please try again.');
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
  const chipCount = document.getElementById('chip-count');
  if (chipCount) {
    chipCount.textContent = balance;
  } else {
    console.warn('Chip count element not found (#chip-count)');
  }
}

// Update UI after auth
function updateUIAfterAuth() {
  console.log('Updating UI, Page:', window.location.href, 'DOM Elements:', {
    authPopup: !!document.getElementById('auth-popup'),
    balance: !!document.getElementById('balance'),
    chipCount: !!document.getElementById('chip-count')
  });

  const authPopup = document.getElementById('auth-popup');
  const balanceElement = document.getElementById('balance');
  const profilLink = document.querySelector('a[data-page="profil"]');
  const loginMessage = document.getElementById('login-message');
  const gameContent = document.getElementById('game-content');
  const profileContent = document.getElementById('profile-content');

  if (!authPopup && !balanceElement && !profilLink) {
    console.warn('No auth-related elements found, skipping UI update');
    return;
  }

  try {
    if (user) {
      if (authPopup) authPopup.classList.add('hidden');
      if (balanceElement) balanceElement.classList.remove('hidden');
      if (profilLink) profilLink.classList.add('text-yellow-400');
      if (loginMessage) loginMessage.classList.add('hidden');
      if (gameContent) gameContent.classList.remove('hidden');
      if (profileContent) {
        profileContent.innerHTML = `
          <div class="bg-gray-800 p-6 rounded-lg">
            <h2 class="text-2xl mb-4">Profile</h2>
            <p>Username: ${user.username}</p>
            <p>Email: ${user.email}</p>
            <p>Chips: ${balance}</p>
            <button id="logout-btn" class="bg-red-600 hover:bg-red-700 text-white p-2 rounded mt-4">Logout</button>
          </div>
        `;
        document.getElementById('logout-btn')?.addEventListener('click', () => {
          user = null;
          jwtToken = null;
          localStorage.removeItem('jwtToken');
          updateUIAfterAuth();
          window.location.href = '/';
        });
      }
      updateBalanceDisplay();
    } else {
      if (authPopup) authPopup.classList.remove('hidden'); // Show popup if not logged in on profile page
      if (balanceElement) balanceElement.classList.add('hidden');
      if (profilLink) profilLink.classList.remove('text-yellow-400');
      if (loginMessage) loginMessage.classList.remove('hidden');
      if (gameContent) gameContent.classList.add('hidden');
      if (profileContent) profileContent.innerHTML = '';
    }
  } catch (err) {
    console.error('Error in updateUIAfterAuth:', err);
  }
}

// Show error message
function showError(message) {
  const errorElement = document.getElementById('auth-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => {
      if (errorElement) errorElement.classList.add('hidden');
    }, 5000);
  } else {
    console.warn('Auth error element not found (#auth-error)');
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
  const gameStatus = document.getElementById('game-status');
  const dealerHandElement = document.getElementById('dealer-hand');
  const playerHandElement = document.getElementById('player-hand');

  if (!gameStatus || !dealerHandElement || !playerHandElement) {
    console.warn('Game display elements not found (#game-status, #dealer-hand, #player-hand)');
    return;
  }

  dealerHandElement.innerHTML = dealerHand.map(card => `<div class="card">${card.value}${card.suit}</div>`).join('');
  playerHandElement.innerHTML = playerHand.map(card => `<div class="card">${card.value}${card.suit}</div>`).join('');
  gameStatus.textContent = result || `Player: ${calculateHandValue(playerHand)} | Dealer: ${gameState === 'playing' ? '?' : calculateHandValue(dealerHand)}`;

  const hitButton = document.getElementById('hit-btn');
  const standButton = document.getElementById('stay-btn');
  if (hitButton) hitButton.disabled = gameState !== 'playing';
  if (standButton) standButton.disabled = gameState !== 'playing';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking auth...', 'Page:', window.location.href);
  setTimeout(() => {
    checkAuth();
  }, 100);

  // Auth form handling
  const authPopup = document.getElementById('auth-popup');
  const authTitle = document.getElementById('auth-title');
  const authSubmit = document.getElementById('auth-submit');
  const switchLink = document.getElementById('switch-to-login');
  const authSwitch = document.getElementById('auth-switch');
  const usernameInput = document.getElementById('username');
  let isRegisterMode = true;

  if (!authPopup || !authTitle || !authSubmit || !switchLink || !authSwitch) {
    console.warn('Auth elements not found (#auth-popup, #auth-title, #auth-submit, #switch-to-login, #auth-switch)');
  }

  if (switchLink) {
    switchLink.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Switching auth mode, current:', isRegisterMode);
      isRegisterMode = !isRegisterMode;
      authTitle.textContent = isRegisterMode ? 'Register' : 'Login';
      authSubmit.textContent = isRegisterMode ? 'Register' : 'Login';
      authSwitch.innerHTML = isRegisterMode
        ? 'Already have an account? <a href="#" id="switch-to-login" class="text-blue-400">Login</a>'
        : 'Need an account? <a href="#" id="switch-to-login" class="text-blue-400">Register</a>';
      if (usernameInput) {
        usernameInput.style.display = isRegisterMode ? 'block' : 'none';
        usernameInput.parentElement.style.display = isRegisterMode ? 'block' : 'none';
      }
      // Rebind switch link
      const newSwitchLink = document.getElementById('switch-to-login');
      if (newSwitchLink) {
        newSwitchLink.addEventListener('click', arguments.callee);
      }
    });
  }

  if (authSubmit) {
    authSubmit.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Auth submit clicked, mode:', isRegisterMode);
      const username = usernameInput?.value;
      const email = document.getElementById('email')?.value;
      const password = document.getElementById('password')?.value;

      if (isRegisterMode) {
        if (!username || !email || !password) {
          showError('Please fill in all fields.');
          return;
        }
        try {
          const result = await registerUser(username, email, password);
          if (result.status === 200) {
            if (authPopup) authPopup.classList.add('hidden');
            window.location.href = '/?page=profil';
          }
        } catch (err) {
          // Error shown in registerUser
        }
      } else {
        if (!email || !password) {
          showError('Please fill in all fields.');
          return;
        }
        try {
          const result = await loginUser(email, password);
          if (result.status === 200) {
            if (authPopup) authPopup.classList.add('hidden');
            window.location.href = '/?page=profil';
          }
        } catch (err) {
          // Error shown in loginUser
        }
      }
    });
  }

  // Close auth popup
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.className = 'absolute top-2 right-2 text-white text-xl';
  const authPopupInner = authPopup?.querySelector('div');
  if (authPopupInner) {
    authPopupInner.appendChild(closeButton);
    closeButton.addEventListener('click', () => {
      if (authPopup) authPopup.classList.add('hidden');
    });
  }

  // Navigation handling
  const navItems = document.querySelectorAll('.nav-item');
  if (navItems.length === 0) {
    console.warn('No navigation items found (.nav-item)');
  }
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      console.log('Nav item clicked:', page);
      document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
      const targetPage = document.getElementById(page);
      if (targetPage) {
        targetPage.classList.remove('hidden');
      } else {
        console.warn(`Page not found (#${page})`);
      }
      if (page === 'profil' && !user) {
        if (authPopup) {
          authPopup.classList.remove('hidden');
          console.log('Opening auth popup for profile page');
        }
      }
    });
  });

  // Game buttons
  const dealButton = document.getElementById('deal-btn');
  if (dealButton) {
    dealButton.addEventListener('click', () => {
      console.log('Deal button clicked');
      const betInput = document.getElementById('bet-amount');
      const betAmount = betInput ? parseInt(betInput.value) : 0;
      if (betAmount <= 0) {
        showError('Please enter a valid bet amount.');
        return;
      }
      startGame(betAmount);
    });
  } else {
    console.warn('Deal button not found (#deal-btn)');
  }

  const hitButton = document.getElementById('hit-btn');
  if (hitButton) {
    hitButton.addEventListener('click', hit);
  } else {
    console.warn('Hit button not found (#hit-btn)');
  }

  const standButton = document.getElementById('stay-btn');
  if (standButton) {
    standButton.addEventListener('click', stand);
  } else {
    console.warn('Stay button not found (#stay-btn)');
  }

  // Temporary auth trigger
  const tempAuthTrigger = document.createElement('button');
  tempAuthTrigger.textContent = 'Open Auth Popup';
  tempAuthTrigger.className = 'fixed top-4 left-4 bg-blue-600 text-white p-2 rounded z-50';
  document.body.appendChild(tempAuthTrigger);
  tempAuthTrigger.addEventListener('click', () => {
    console.log('Temporary auth trigger clicked');
    if (authPopup) {
      authPopup.classList.remove('hidden');
    }
  });
});