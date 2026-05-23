/**
 * YATZY ROYALE - CORE GAME SCRIPT
 * Manages game state, automatic score previews, calculations, turn transitions,
 * manual/virtual inputs, Web Audio synthesizers, and winner celebration.
 */

// ==========================================================================
// GAME STATE DEFINITION
// ==========================================================================
const STATE = {
  activePlayer: 0, // 0 = Player 1, 1 = Player 2
  scores: [
    {
      aces: null,
      twos: null,
      threes: null,
      fours: null,
      fives: null,
      sixes: null,
      threeOfKind: null,
      fourOfKind: null,
      fullHouse: null,
      smallStraight: null,
      largeStraight: null,
      yahtzee: null,
      chance: null,
      yahtzeeBonuses: 0 // +100 points each (max 3 for visual dots)
    },
    {
      aces: null,
      twos: null,
      threes: null,
      fours: null,
      fives: null,
      sixes: null,
      threeOfKind: null,
      fourOfKind: null,
      fullHouse: null,
      smallStraight: null,
      largeStraight: null,
      yahtzee: null,
      chance: null,
      yahtzeeBonuses: 0
    }
  ],
  isManualMode: false,
  dice: [1, 2, 3, 4, 5],
  held: [false, false, false, false, false],
  rollsLeft: 3,
  isRolling: false,
  soundEnabled: true,
  
  // For manual score popup
  modalActive: {
    player: null,
    category: null
  },
  
  // For score selection confirmation popup
  scoreConfirmActive: {
    player: null,
    category: null,
    value: null
  }
};

// Category Metadata
const CATEGORIES = {
  aces: { name: "Aces", section: "upper" },
  twos: { name: "Twos", section: "upper" },
  threes: { name: "Threes", section: "upper" },
  fours: { name: "Fours", section: "upper" },
  fives: { name: "Fives", section: "upper" },
  sixes: { name: "Sixes", section: "upper" },
  threeOfKind: { name: "3 of a Kind", section: "lower" },
  fourOfKind: { name: "4 of a Kind", section: "lower" },
  fullHouse: { name: "Full House", section: "lower" },
  smallStraight: { name: "Small Straight", section: "lower" },
  largeStraight: { name: "Large Straight", section: "lower" },
  yahtzee: { name: "YATZY", section: "lower" },
  chance: { name: "Chance", section: "lower" }
};

// ==========================================================================
// SYNTHESIZED WEB AUDIO SOUNDS
// ==========================================================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

/**
 * Play a synthesizer note with custom frequency, duration, and type
 */
function playNote(freq, type, duration, delay = 0, volume = 0.1) {
  if (!STATE.soundEnabled) return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
  
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
}

// Roll Sound Effect: Crackly clicking dice
function playRollSound() {
  if (!STATE.soundEnabled) return;
  initAudio();
  for (let i = 0; i < 8; i++) {
    const delay = i * 0.06;
    const freq = 120 + Math.random() * 280;
    playNote(freq, 'triangle', 0.08, delay, 0.15);
    playNote(1000 + Math.random() * 2000, 'sine', 0.01, delay, 0.03); // clink
  }
}

// Hold Sound Effect
function playHoldSound(isHolding) {
  playNote(isHolding ? 440 : 330, 'sine', 0.1, 0, 0.1);
  if (isHolding) {
    playNote(554, 'sine', 0.08, 0.03, 0.08);
  }
}

// Score Confirm Sound
function playScoreSound() {
  playNote(392, 'sine', 0.1, 0, 0.1);
  playNote(523, 'sine', 0.12, 0.05, 0.1);
  playNote(659, 'sine', 0.2, 0.1, 0.12);
}

// Victory Fanfare
function playVictorySound() {
  const notes = [261, 329, 392, 523, 659, 783, 1046];
  notes.forEach((f, idx) => {
    playNote(f, 'sine', 0.4, idx * 0.08, 0.08);
  });
  playNote(1046, 'square', 0.6, notes.length * 0.08, 0.05);
}

// ==========================================================================
// SCORING COMPUTATION LAWS & JOKER LAWS
// ==========================================================================

/**
 * Calculates possible score for a category based on the current dice
 */
function calculatePotentialScore(category, dice) {
  // Normalize dice to a clean array of standard numbers defensively
  const normalizedDice = (dice || []).map(Number);

  const counts = {};
  normalizedDice.forEach(d => counts[d] = (counts[d] || 0) + 1);
  
  const sumOfAll = normalizedDice.reduce((a, b) => a + b, 0);
  const isYahtzeeRolled = Object.values(counts).some(c => c === 5);
  
  // Rule details for Joker
  const hasScoredYahtzee = STATE.scores[STATE.activePlayer].yahtzee === 50;
  const isJokerActive = isYahtzeeRolled && hasScoredYahtzee;

  // 1. Upper Section Items
  if (category === 'aces') return getUpperSum(1, normalizedDice);
  if (category === 'twos') return getUpperSum(2, normalizedDice);
  if (category === 'threes') return getUpperSum(3, normalizedDice);
  if (category === 'fours') return getUpperSum(4, normalizedDice);
  if (category === 'fives') return getUpperSum(5, normalizedDice);
  if (category === 'sixes') return getUpperSum(6, normalizedDice);

  // 2. Lower Section Items with standard & Joker variants
  if (category === 'threeOfKind') {
    if (isJokerActive) return sumOfAll; // Joker yields sum of dice
    const hasThree = Object.values(counts).some(c => c >= 3);
    return hasThree ? sumOfAll : 0;
  }

  if (category === 'fourOfKind') {
    if (isJokerActive) return sumOfAll; // Joker yields sum
    const hasFour = Object.values(counts).some(c => c >= 4);
    return hasFour ? sumOfAll : 0;
  }

  if (category === 'fullHouse') {
    if (isJokerActive) return 25; // Joker automatic 25
    const hasThree = Object.values(counts).some(c => c === 3);
    const hasTwo = Object.values(counts).some(c => c === 2);
    return (hasThree && hasTwo) || isYahtzeeRolled ? 25 : 0;
  }

  if (category === 'smallStraight') {
    if (isJokerActive) return 30; // Joker automatic 30
    const unique = [...new Set(normalizedDice)].sort((a, b) => a - b);
    const str = unique.join('');
    const hasSmall = str.includes('1234') || str.includes('2345') || str.includes('3456');
    return hasSmall ? 30 : 0;
  }

  if (category === 'largeStraight') {
    if (isJokerActive) return 40; // Joker automatic 40
    const unique = [...new Set(normalizedDice)].sort((a, b) => a - b);
    const str = unique.join('');
    const hasLarge = str === '12345' || str === '23456';
    return hasLarge ? 40 : 0;
  }

  if (category === 'yahtzee') {
    return isYahtzeeRolled ? 50 : 0;
  }

  if (category === 'chance') {
    return sumOfAll;
  }

  return 0;
}

function getUpperSum(value, dice) {
  const v = Number(value);
  return (dice || []).map(Number).filter(d => d === v).reduce((sum, d) => sum + d, 0);
}

// ==========================================================================
// GAME STATE MANAGEMENT (AUTO RUNS / TRIGGERS)
// ==========================================================================

/**
 * Initializes/Resets the game
 */
function resetGame() {
  STATE.activePlayer = 0;
  STATE.rollsLeft = 3;
  STATE.isRolling = false;
  STATE.held = [false, false, false, false, false];
  STATE.dice = [1, 2, 3, 4, 5];
  
  STATE.scores = [
    { aces: null, twos: null, threes: null, fours: null, fives: null, sixes: null, threeOfKind: null, fourOfKind: null, fullHouse: null, smallStraight: null, largeStraight: null, yahtzee: null, chance: null, yahtzeeBonuses: 0 },
    { aces: null, twos: null, threes: null, fours: null, fives: null, sixes: null, threeOfKind: null, fourOfKind: null, fullHouse: null, smallStraight: null, largeStraight: null, yahtzee: null, chance: null, yahtzeeBonuses: 0 }
  ];

  // Save initial state
  saveGameToLocalStorage();

  // Redraw complete UI
  updateDOM();
  playScoreSound();
}

/**
 * Saves current game state to local storage
 */
function saveGameToLocalStorage() {
  localStorage.setItem('yatzy_royale_state_v1', JSON.stringify(STATE));
}

/**
 * Loads game state from local storage if existing
 */
function loadGameFromLocalStorage() {
  const raw = localStorage.getItem('yatzy_royale_state_v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      STATE.activePlayer = parsed.activePlayer ?? 0;
      STATE.scores = parsed.scores ?? STATE.scores;
      STATE.isManualMode = parsed.isManualMode ?? false;
      STATE.dice = (parsed.dice ?? [1, 2, 3, 4, 5]).map(Number);
      STATE.held = (parsed.held ?? [false, false, false, false, false]).map(Boolean);
      STATE.rollsLeft = parsed.rollsLeft ?? 3;
      STATE.soundEnabled = parsed.soundEnabled ?? true;
    } catch (e) {
      console.warn("Failed parsing state from localStorage", e);
    }
  }
}

/**
 * Core loop step: Roll virtual dice
 */
function rollDice() {
  if (STATE.isRolling || STATE.rollsLeft <= 0 || STATE.isManualMode) return;

  STATE.isRolling = true;
  STATE.rollsLeft--;
  playRollSound();

  // Add shaking CSS class to dice
  const wrappers = document.querySelectorAll('.die-wrapper');
  wrappers.forEach((wrap, idx) => {
    if (!STATE.held[idx]) {
      wrap.classList.add('rolling-animation');
    }
  });

  // Roll physics animation length
  setTimeout(() => {
    // Generate new values
    STATE.dice = STATE.dice.map((d, idx) => {
      return STATE.held[idx] ? d : Math.floor(Math.random() * 6) + 1;
    });

    // Remove rolling animation class
    wrappers.forEach(wrap => wrap.classList.remove('rolling-animation'));
    
    // Check if rolled a subsequent Yahtzee for BONUS points!
    checkSubsequentYahtzeeBonus();

    STATE.isRolling = false;
    saveGameToLocalStorage();
    updateDOM();
  }, 1000);
}

/**
 * Star logic: Handles +100 bonus star calculations for extra Yahtzees
 */
function checkSubsequentYahtzeeBonus() {
  const diceValues = STATE.dice;
  const isYahtzee = diceValues.every(v => v === diceValues[0]);
  const playerState = STATE.scores[STATE.activePlayer];
  
  // If player rolled 5-of-a-kind, and has ALREADY scored 50 in their Yahtzee box
  if (isYahtzee && playerState.yahtzee === 50) {
    playerState.yahtzeeBonuses++;
    playVictorySound();
  }
}

/**
 * Toggles holding a single die
 */
function toggleHold(index) {
  // Can only hold if we have already rolled at least once in virtual mode
  if (STATE.rollsLeft === 3 || STATE.rollsLeft === 0 || STATE.isRolling || STATE.isManualMode) return;

  STATE.held[index] = !STATE.held[index];
  playHoldSound(STATE.held[index]);
  saveGameToLocalStorage();
  updateDOM();
}

/**
 * Locks in a score for a specific category
 */
function scoreCategory(player, category, val) {
  // Score validation
  if (STATE.scores[player][category] !== null) return; // already locked

  STATE.scores[player][category] = val;
  playScoreSound();

  // Switch Turn
  STATE.activePlayer = STATE.activePlayer === 0 ? 1 : 0;
  
  // Reset Roll State
  STATE.rollsLeft = 3;
  STATE.held = [false, false, false, false, false];

  saveGameToLocalStorage();
  updateDOM();

  // Check Game Completion
  checkGameEnd();
}

/**
 * Checks if all columns/categories are filled, triggers end state
 */
function checkGameEnd() {
  let finished = true;
  for (let p = 0; p < 2; p++) {
    for (const cat in CATEGORIES) {
      if (STATE.scores[p][cat] === null) {
        finished = false;
        break;
      }
    }
  }

  if (finished) {
    showWinnerOverlay();
  }
}

// ==========================================================================
// CALCULATE AGGREGATES (AUTO CALCS ENGINE)
// ==========================================================================
function calculateTotals(playerIdx) {
  const p = STATE.scores[playerIdx];
  
  // 1. Upper subtotal
  let upperSub = 0;
  const upperCats = ['aces', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  upperCats.forEach(c => {
    upperSub += (p[c] || 0);
  });

  // 2. Bonus calculation
  const hasBonus = upperSub >= 63;
  const bonus = hasBonus ? 35 : 0;
  const upperTotal = upperSub + bonus;

  // 3. Lower subtotal
  let lowerSub = 0;
  const lowerCats = ['threeOfKind', 'fourOfKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'];
  lowerCats.forEach(c => {
    lowerSub += (p[c] || 0);
  });

  // Add Yahtzee Bonus points (+100 per bonus star)
  const yahtzeeBonusScore = p.yahtzeeBonuses * 100;
  const lowerTotal = lowerSub + yahtzeeBonusScore;

  // 4. Grand Total
  const grandTotal = upperTotal + lowerTotal;

  return {
    upperSub,
    bonus,
    upperTotal,
    lowerTotal,
    grandTotal
  };
}

// ==========================================================================
// UI / DOM INTERACTIVE RENDERING
// ==========================================================================

function updateDOM() {
  // 1. Handle modes
  const modeCheckbox = document.getElementById('mode-checkbox');
  const rollerContainer = document.getElementById('virtual-roller-container');
  const manualBanner = document.getElementById('manual-mode-banner');
  const toggles = document.querySelectorAll('.toggle-label');

  if (STATE.isManualMode) {
    modeCheckbox.checked = true;
    rollerContainer.classList.add('hidden');
    manualBanner.classList.remove('hidden');
    toggles[0].classList.add('active');
    toggles[1].classList.remove('active');
  } else {
    modeCheckbox.checked = false;
    rollerContainer.classList.remove('hidden');
    manualBanner.classList.add('hidden');
    toggles[0].classList.remove('active');
    toggles[1].classList.add('active');
  }

  // 2. Turn banner and container class updates
  const banner = document.getElementById('turn-banner');
  const turnText = document.getElementById('turn-text');
  
  document.body.classList.remove('p1-turn-active', 'p2-turn-active');
  document.getElementById('rolls-dots').classList.remove('p1-turn-active', 'p2-turn-active');

  if (STATE.activePlayer === 0) {
    banner.className = "turn-banner p1-turn";
    turnText.innerText = "Player 1's Turn";
    document.body.classList.add('p1-turn-active');
    document.getElementById('rolls-dots').classList.add('p1-turn-active');
    
    document.getElementById('p1-card').classList.add('active');
    document.getElementById('p2-card').classList.remove('active');
    document.getElementById('p1-col-header').classList.add('active');
    document.getElementById('p2-col-header').classList.remove('active');
  } else {
    banner.className = "turn-banner p2-turn";
    turnText.innerText = "Player 2's Turn";
    document.body.classList.add('p2-turn-active');
    document.getElementById('rolls-dots').classList.add('p2-turn-active');
    
    document.getElementById('p1-card').classList.remove('active');
    document.getElementById('p2-card').classList.add('active');
    document.getElementById('p1-col-header').classList.remove('active');
    document.getElementById('p2-col-header').classList.add('active');
  }

  // 3. Render sound icon state
  const path = document.getElementById('sound-icon-path');
  if (STATE.soundEnabled) {
    path.setAttribute('d', 'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07');
  } else {
    path.setAttribute('d', 'M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6'); // Muted representation
  }

  // 4. Render Virtual Dice Values & Positions
  STATE.dice.forEach((val, idx) => {
    const wrapper = document.querySelector(`.die-wrapper[data-index="${idx}"]`);
    const cube = document.getElementById(`die-${idx}`);

    // Adjust Lock States visually
    if (STATE.held[idx]) {
      wrapper.classList.add('held');
    } else {
      wrapper.classList.remove('held');
    }

    // CSS 3D Transforms representing face lands
    // If not rolling, make it rest perfectly on the face value
    if (!wrapper.classList.contains('rolling-animation')) {
      let rotX = 0, rotY = 0;
      switch (val) {
        case 1: rotX = 0; rotY = 0; break;
        case 2: rotX = 0; rotY = 180; break;
        case 3: rotX = 0; rotY = 90; break;
        case 4: rotX = 0; rotY = -90; break;
        case 5: rotX = -90; rotY = 0; break;
        case 6: rotX = 90; rotY = 0; break;
      }
      // Add extra rot/spin counts based on index to randomize rest appearance
      cube.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    }
  });

  // 5. Render Virtual Rolls Left Dots
  const dotsContainer = document.getElementById('rolls-dots');
  dotsContainer.innerHTML = '';
  for (let d = 1; d <= 3; d++) {
    const dot = document.createElement('span');
    dot.className = `roll-dot ${d <= STATE.rollsLeft ? 'active' : ''}`;
    dotsContainer.appendChild(dot);
  }
  
  // Enable/disable Roll Button
  const rollBtn = document.getElementById('roll-btn');
  if (STATE.rollsLeft <= 0 || STATE.isRolling) {
    rollBtn.disabled = true;
    rollBtn.classList.remove('btn-primary');
    rollBtn.classList.add('btn-secondary');
  } else {
    rollBtn.disabled = false;
    rollBtn.classList.remove('btn-secondary');
    rollBtn.classList.add('btn-primary');
  }

  // 6. Draw Table Cell Scores & Previews
  const p1Totals = calculateTotals(0);
  const p2Totals = calculateTotals(1);

  // Redraw subtotals/totals inside sheet
  document.getElementById('subtotal-0').innerText = p1Totals.upperSub;
  document.getElementById('subtotal-1').innerText = p2Totals.upperSub;
  document.getElementById('bonus-0').innerText = p1Totals.bonus;
  document.getElementById('bonus-1').innerText = p2Totals.bonus;
  document.getElementById('uppertotal-0').innerText = p1Totals.upperTotal;
  document.getElementById('uppertotal-1').innerText = p2Totals.upperTotal;
  document.getElementById('lowertotal-0').innerText = p1Totals.lowerTotal;
  document.getElementById('lowertotal-1').innerText = p2Totals.lowerTotal;
  document.getElementById('grandtotal-0').innerText = p1Totals.grandTotal;
  document.getElementById('grandtotal-1').innerText = p2Totals.grandTotal;

  // Sync quick preview panels in column headers
  document.getElementById('p1-preview-total').innerText = `Grand Total: ${p1Totals.grandTotal}`;
  document.getElementById('p2-preview-total').innerText = `Grand Total: ${p2Totals.grandTotal}`;

  // Sync bonus helpers
  const p1Help = document.getElementById('p1-bonus-helper');
  const p2Help = document.getElementById('p2-bonus-helper');
  
  if (p1Totals.upperSub >= 63) {
    p1Help.innerText = "✓ Bonus Active";
    p1Help.className = "p1-progress-helper complete";
  } else {
    p1Help.innerText = `Need ${63 - p1Totals.upperSub}`;
    p1Help.className = "p1-progress-helper";
  }

  if (p2Totals.upperSub >= 63) {
    p2Help.innerText = "✓ Bonus Active";
    p2Help.className = "p2-progress-helper complete";
  } else {
    p2Help.innerText = `Need ${63 - p2Totals.upperSub}`;
    p2Help.className = "p2-progress-helper";
  }

  // Draw Yahtzee multiplier stars
  for (let p = 0; p < 2; p++) {
    const starCount = STATE.scores[p].yahtzeeBonuses;
    const starRow = document.getElementById(`bonus-stars-${p}`);
    const stars = starRow.querySelectorAll('.star');
    stars.forEach((s, idx) => {
      if (idx < starCount) {
        s.classList.add('earned');
      } else {
        s.classList.remove('earned');
      }
    });
  }

  // Draw category points & automated previews
  for (const cat in CATEGORIES) {
    for (let p = 0; p < 2; p++) {
      const cell = document.getElementById(`cell-${p}-${cat}`);
      const val = STATE.scores[p][cat];

      cell.className = `score-cell p${p+1}-cell`;

      if (val !== null) {
        // Logged locked values
        cell.innerText = val;
        cell.classList.add('locked');
      } else {
        // Open cell
        cell.innerText = '-';
        
        // Show virtual suggestions if not manual mode, player is active, and have rolled
        if (!STATE.isManualMode && STATE.activePlayer === p && STATE.rollsLeft < 3) {
          const suggestedVal = calculatePotentialScore(cat, STATE.dice);
          cell.innerText = suggestedVal;
          cell.classList.add('suggested');
        }
      }
    }
  }
}

// ==========================================================================
// MANUAL MODAL WINDOW CONTROLLER
// ==========================================================================
function openManualModal(player, category) {
  STATE.modalActive.player = player;
  STATE.modalActive.category = category;

  const modal = document.getElementById('manual-modal');
  const title = document.getElementById('modal-title');
  const info = document.getElementById('modal-info-text');
  const catSpan = document.getElementById('preset-cat-name');
  const numInput = document.getElementById('manual-score-input');
  
  title.innerText = `Log Score - Player ${player + 1}`;
  info.innerText = `Enter score for the "${CATEGORIES[category].name}" category:`;
  catSpan.innerText = CATEGORIES[category].name;
  numInput.value = '';

  // Setup preset clicks quickly
  const presetsGrid = document.getElementById('presets-grid');
  presetsGrid.innerHTML = '';

  const presets = getPresetsForCategory(category);
  presets.forEach(pVal => {
    const btn = document.createElement('button');
    btn.className = "btn-preset";
    btn.innerText = pVal;
    btn.onclick = () => {
      numInput.value = pVal;
    };
    presetsGrid.appendChild(btn);
  });

  modal.classList.remove('hidden');
}

function getPresetsForCategory(category) {
  switch (category) {
    case 'aces': return [0, 1, 2, 3, 4, 5];
    case 'twos': return [0, 2, 4, 6, 8, 10];
    case 'threes': return [0, 3, 6, 9, 12, 15];
    case 'fours': return [0, 4, 8, 12, 16, 20];
    case 'fives': return [0, 5, 10, 15, 20, 25];
    case 'sixes': return [0, 6, 12, 18, 24, 30];
    case 'threeOfKind': return [0, 15, 18, 21, 24, 27, 30];
    case 'fourOfKind': return [0, 15, 20, 24, 28, 30];
    case 'fullHouse': return [0, 25];
    case 'smallStraight': return [0, 30];
    case 'largeStraight': return [0, 40];
    case 'yahtzee': return [0, 50];
    case 'chance': return [5, 10, 15, 20, 25, 30];
    default: return [0];
  }
}

function closeManualModal() {
  document.getElementById('manual-modal').classList.add('hidden');
}

function confirmManualScore() {
  const p = STATE.modalActive.player;
  const c = STATE.modalActive.category;
  const numInput = document.getElementById('manual-score-input');
  
  if (p === null || c === null) return;
  
  let val = parseInt(numInput.value);
  if (isNaN(val) || val < 0) {
    val = 0;
  }

  scoreCategory(p, c, val);
  closeManualModal();
}

function openConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
}

function openScoreConfirmModal(player, category, value) {
  STATE.scoreConfirmActive = { player, category, value };
  const catName = CATEGORIES[category]?.name || category;
  const textElement = document.getElementById('score-confirm-text');
  textElement.innerHTML = `Are you sure you want to log a score of <strong style="color: #60a5fa;">${value}</strong> points for <strong style="color: #c084fc;">${catName}</strong> in <strong style="color: #38bdf8;">Player ${player + 1}'s</strong> column? This choice cannot be changed.`;
  document.getElementById('score-confirm-modal').classList.remove('hidden');
}

function closeScoreConfirmModal() {
  document.getElementById('score-confirm-modal').classList.add('hidden');
  STATE.scoreConfirmActive = { player: null, category: null, value: null };
}

function acceptScoreConfirmation() {
  const { player, category, value } = STATE.scoreConfirmActive;
  if (player !== null && category !== null && value !== null) {
    scoreCategory(player, category, value);
  }
  closeScoreConfirmModal();
}

// ==========================================================================
// WINNING CELEBRATION (CONFETTI ANIMATION ENGINE)
// ==========================================================================
let confettiInterval = null;
let confettiParticles = [];

function showWinnerOverlay() {
  const overlay = document.getElementById('winner-overlay');
  const title = document.getElementById('winner-title');
  const p1Score = document.getElementById('winner-p1-score');
  const p2Score = document.getElementById('winner-p2-score');
  const desc = document.getElementById('winner-congrats-text');

  const p1T = calculateTotals(0).grandTotal;
  const p2T = calculateTotals(1).grandTotal;

  p1Score.innerText = p1T;
  p2Score.innerText = p2T;

  if (p1T > p2T) {
    title.innerText = "PLAYER 1 WINS! 🏆";
    desc.innerText = `An absolute masterclass in rolling, beating Player 2 by ${p1T - p2T} points!`;
  } else if (p2T > p1T) {
    title.innerText = "PLAYER 2 WINS! 🏆";
    desc.innerText = `An absolute masterclass in rolling, beating Player 1 by ${p2T - p1T} points!`;
  } else {
    title.innerText = "IT'S A DRAW! 🤝";
    desc.innerText = `Incredible match! Both players finished with an identical score of ${p1T}!`;
  }

  overlay.classList.remove('hidden');
  playVictorySound();
  startConfetti();
}

function closeWinnerOverlay() {
  document.getElementById('winner-overlay').classList.add('hidden');
  stopConfetti();
}

function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  confettiParticles = [];
  const colors = [STATE.isManualMode ? '#3b82f6' : '#ec4899', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'];

  for (let i = 0; i < 150; i++) {
    confettiParticles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * canvas.height,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    confettiParticles.forEach((p, idx) => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.tiltAngle);
      p.tilt = Math.sin(p.tiltAngle - idx/3) * 15;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();

      if (p.y > canvas.height) {
        confettiParticles[idx] = {
          x: Math.random() * canvas.width,
          y: -20,
          r: p.r,
          d: p.d,
          color: p.color,
          tilt: p.tilt,
          tiltAngleIncremental: p.tiltAngleIncremental,
          tiltAngle: p.tiltAngle
        };
      }
    });

    confettiInterval = requestAnimationFrame(draw);
  }

  draw();
}

function stopConfetti() {
  if (confettiInterval) {
    cancelAnimationFrame(confettiInterval);
    confettiInterval = null;
  }
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ==========================================================================
// BINDINGS & EVENT LISTENERS
// ==========================================================================
function initApp() {
  // Safe check: if scoresheet DOM elements are not present, skip UI binding for testing environment
  if (!document.getElementById('mode-checkbox')) {
    console.log("Running in test environment. Skipping DOM initialization.");
    return;
  }

  // Load state
  loadGameFromLocalStorage();

  // Draw initial page
  updateDOM();

  // Mode click toggles
  document.getElementById('mode-checkbox').onchange = (e) => {
    STATE.isManualMode = e.target.checked;
    saveGameToLocalStorage();
    updateDOM();
  };

  // Sound click toggle
  document.getElementById('sound-toggle').onclick = () => {
    STATE.soundEnabled = !STATE.soundEnabled;
    saveGameToLocalStorage();
    updateDOM();
    if (STATE.soundEnabled) {
      initAudio();
      playHoldSound(true);
    }
  };

  // New Game Trigger
  document.getElementById('new-game-btn').onclick = () => {
    openConfirmModal();
  };

  // Roll Button Trigger
  document.getElementById('roll-btn').onclick = () => {
    rollDice();
  };

  // Hold virtual dice triggers
  const wrappers = document.querySelectorAll('.die-wrapper');
  wrappers.forEach(wrap => {
    wrap.onclick = () => {
      const idx = parseInt(wrap.getAttribute('data-index'));
      toggleHold(idx);
    };
  });

  // Table cell scoring binds
  const table = document.querySelector('.scoresheet-table');
  table.onclick = (e) => {
    const cell = e.target.closest('.score-cell');
    if (!cell) return;

    const p = parseInt(cell.getAttribute('data-player'));
    const row = cell.closest('.score-row');
    if (!row) return;
    
    const cat = row.getAttribute('data-category');

    // Only allow interacting with active player's column
    if (p !== STATE.activePlayer) return;
    // Check locked state
    if (STATE.scores[p][cat] !== null) return;

    if (STATE.isManualMode) {
      // Manual entry opens overlay
      openManualModal(p, cat);
    } else {
      // Virtual entry logs suggested score
      // Require at least one roll before scoring in virtual mode
      if (STATE.rollsLeft === 3) {
        alert("Please roll the dice at least once before scoring!");
        return;
      }
      const val = calculatePotentialScore(cat, STATE.dice);
      openScoreConfirmModal(p, cat, val);
    }
  };

  // Modal actions
  document.getElementById('modal-close-btn').onclick = closeManualModal;
  document.getElementById('modal-cancel-btn').onclick = closeManualModal;
  document.getElementById('modal-confirm-btn').onclick = confirmManualScore;
  
  // Close modal when tapping overlay backdrop
  document.getElementById('manual-modal').onclick = (e) => {
    if (e.target.id === 'manual-modal') {
      closeManualModal();
    }
  };

  // Custom Confirm Modal actions
  document.getElementById('confirm-close-btn').onclick = closeConfirmModal;
  document.getElementById('confirm-cancel-btn').onclick = closeConfirmModal;
  document.getElementById('confirm-accept-btn').onclick = () => {
    resetGame();
    closeConfirmModal();
  };
  
  // Close confirm modal when tapping overlay backdrop
  document.getElementById('confirm-modal').onclick = (e) => {
    if (e.target.id === 'confirm-modal') {
      closeConfirmModal();
    }
  };

  // Score Selection Confirm Modal actions
  document.getElementById('score-confirm-close-btn').onclick = closeScoreConfirmModal;
  document.getElementById('score-confirm-cancel-btn').onclick = closeScoreConfirmModal;
  document.getElementById('score-confirm-accept-btn').onclick = acceptScoreConfirmation;
  
  // Close score confirm modal when tapping overlay backdrop
  document.getElementById('score-confirm-modal').onclick = (e) => {
    if (e.target.id === 'score-confirm-modal') {
      closeScoreConfirmModal();
    }
  };

  // Winner restart game binds
  document.getElementById('restart-game-btn').onclick = () => {
    closeWinnerOverlay();
    resetGame();
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
