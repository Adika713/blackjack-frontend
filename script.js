const BACKEND_URL = 'https://blackjack-backend-aew7.onrender.com'; // Update with Render URL

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page).classList.add('active');
    if (page === 'leaderboard') fetchLeaderboard(1);
    if (page === 'profil') fetchProfile();
  });
});

// Blackjack Game
const suits = ['♠', '♣', '♥', '♦'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
let deck = [];
let playerHand = [];
let dealerHand = [];
let currentBet = 0;
let gameState = 'idle';

function createDeck() {
  deck = [];
  for (let i = 0; i < 6; i++) { // 6 decks
    for (let suit of suits) {
      for (let value of values) {
        deck.push({ suit, value });
      }
    }
  }
  deck = deck.sort(() => Math.random() - 0.5);
}

function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11; // Adjusted dynamically in hand value
  return parseInt(card.value);
}

function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;
  for (let card of hand) {
    if (card.value === 'A') {
      aces++;
    } else {
      value += getCardValue(card);
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

function renderHand(hand, elementId, hideFirst = false) {
  const element = document.getElementById(elementId);
  element.innerHTML = '';
  hand.forEach((card, index) => {
    if (hideFirst && index === 0) {
      element.innerHTML += '<div class="card">?</div>';
    } else {
      const color = ['♥', '♦'].includes(card.suit) ? 'red' : 'black';
      element.innerHTML += `<div class="card ${color}">${card.value}${card.suit}</div>`;
    }
  });
}

document.getElementById('deal-btn').addEventListener('click', async () => {
  if (gameState !== 'idle') return;
  const bet = parseInt(document.getElementById('bet-amount').value);
  if (!bet || bet <= 0) {
    document.getElementById('game-status').innerText = 'Invalid bet amount';
    return;
  }
  try {
    const response = await fetch(`${BACKEND_URL}/game/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet })
    });
    if (!response.ok) throw new Error('Failed to place bet');
    const data = await response.json();
    currentBet = bet;
    gameState = 'playing';
    createDeck();
    playerHand = [deck.pop(), deck.pop()];
    dealerHand = [deck.pop(), deck.pop()];
    renderHand(playerHand, 'player-hand');
    renderHand(dealerHand, 'dealer-hand', true);
    document.getElementById('game-actions').classList.remove('hidden');
    document.getElementById('game-status').innerText = '';
    fetchBalance();
    // Check for insurance
    if (dealerHand[1].value === 'A') {
      document.getElementById('insurance-btn').classList.remove('hidden');
    }
    // Check for split
    if (playerHand[0].value === playerHand[1].value) {
      document.getElementById('split-btn').classList.remove('hidden');
    }
  } catch (err) {
    document.getElementById('game-status').innerText = 'Error placing bet';
  }
});

// Game actions (Hit, Stay, etc.) to be implemented
document.getElementById('hit-btn').addEventListener('click', () => {
  // Implement hit logic
});

document.getElementById('stay-btn').addEventListener('click', () => {
  // Implement stay logic
});

// Leaderboard
async function fetchLeaderboard(page) {
  try {
    const response = await fetch(`${BACKEND_URL}/leaderboard?page=${page}`);
    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    const data = await response.json();
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    data.users.forEach((user, index) => {
      const rank = (data.page - 1) * 20 + index + 1;
      tbody.innerHTML += `
        <tr>
          <td class="p-2">${rank}</td>
          <td class="p-2">${user.username}</td>
          <td class="p-2">${user.chips}</td>
          <td class="p-2">${user.gamesPlayed}</td>
        </tr>
      `;
    });
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    for (let i = 1; i <= data.pages; i++) {
      pagination.innerHTML += `<button class="mx-1 p-2 ${i === data.page ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-blue-700 rounded" onclick="fetchLeaderboard(${i})">${i}</button>`;
    }
  } catch (err) {
    document.getElementById('leaderboard-body').innerHTML = '<tr><td colspan="4">Error loading leaderboard</td></tr>';
  }
}

// Profile
async function fetchProfile() {
  const content = document.getElementById('profile-content');
  try {
    const response = await fetch(`${BACKEND_URL}/profile`);
    if (response.ok) {
      const user = await response.json();
      content.innerHTML = `
        <img src="${user.avatar || 'https://via.placeholder.com/100'}" class="rounded-full w-24 h-24 mb-4">
        <p>Username: ${user.username}</p>
        <p>Chips: ${user.chips}</p>
        <p>Games Played: ${user.gamesPlayed}</p>
      `;
    } else {
      content.innerHTML = `
        <a href="${BACKEND_URL}/auth/discord" class="bg-[#5865F2] text-white p-2 rounded flex items-center max-w-xs">
          <i class="fab fa-discord mr-2"></i>Discord
        </a>
      `;
    }
  } catch (err) {
    content.innerHTML = '<p>Error loading profile</p>';
  }
}

// Balance
async function fetchBalance() {
  try {
    const response = await fetch(`${BACKEND_URL}/balance`);
    if (response.ok) {
      const data = await response.json();
      document.getElementById('chip-count').innerText = data.chips;
    }
  } catch (err) {
    document.getElementById('chip-count').innerText = 'Error';
  }
}

// Initialize
document.getElementById('verseny').classList.add('active');
fetchBalance();
setInterval(fetchBalance, 5000); // Poll every 5 seconds