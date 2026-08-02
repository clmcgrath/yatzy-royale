/**
 * YATZY ROYALE - TEST SUITE ENGINE
 * Self-contained visual unit-testing framework for the Yatzy dice detection calculations.
 */

// Define the complete unit-test specifications
const TEST_SPEC = [
  // Aces
  {
    category: 'aces',
    dice: [1, 1, 3, 4, 5],
    expected: 2,
    description: "Standard: Aces in [1, 1, 3, 4, 5]"
  },
  {
    category: 'aces',
    dice: ["1", "1", "3", "4", "5"],
    expected: 2,
    description: "Defensive Type Normalization: Aces with string array"
  },
  // Fives
  {
    category: 'fives',
    dice: [2, 5, 4, 5, 5],
    expected: 15,
    description: "Standard: Fives in [2, 5, 4, 5, 5]"
  },
  {
    category: 'fives',
    dice: ["5", "2", "5", "5", "1"],
    expected: 15,
    description: "Defensive Type Normalization: Fives with mixed string array"
  },
  // Three of a Kind
  {
    category: 'threeOfKind',
    dice: [3, 3, 3, 4, 5],
    expected: 18,
    description: "Standard: Three of a Kind with [3, 3, 3, 4, 5]"
  },
  {
    category: 'threeOfKind',
    dice: [3, 3, 2, 4, 5],
    expected: 0,
    description: "Standard: Invalid Three of a Kind with [3, 3, 2, 4, 5]"
  },
  // Four of a Kind
  {
    category: 'fourOfKind',
    dice: [5, 5, 5, 5, 1],
    expected: 21,
    description: "Standard: Four of a Kind with [5, 5, 5, 5, 1]"
  },
  {
    category: 'fourOfKind',
    dice: [5, 5, 5, 1, 2],
    expected: 0,
    description: "Standard: Invalid Four of a Kind with [5, 5, 5, 1, 2]"
  },
  // Full House
  {
    category: 'fullHouse',
    dice: [2, 2, 2, 6, 6],
    expected: 25,
    description: "Standard: Full House with [2, 2, 2, 6, 6]"
  },
  {
    category: 'fullHouse',
    dice: [5, 5, 5, 5, 5],
    expected: 25,
    description: "Official Edge Case: Yatzy [5, 5, 5, 5, 5] acts as a valid Full House"
  },
  {
    category: 'fullHouse',
    dice: [2, 2, 3, 6, 6],
    expected: 0,
    description: "Standard: Invalid Full House with [2, 2, 3, 6, 6]"
  },
  // Small Straight
  {
    category: 'smallStraight',
    dice: [1, 2, 3, 4, 2],
    expected: 30,
    description: "Standard: Sequence 1-2-3-4 with duplicate [1, 2, 3, 4, 2]"
  },
  {
    category: 'smallStraight',
    dice: [5, 2, 4, 3, 5],
    expected: 30,
    description: "Shuffled: Sequence 2-3-4-5 out of order [5, 2, 4, 3, 5]"
  },
  {
    category: 'smallStraight',
    dice: ["6", "4", "3", "5", "6"],
    expected: 30,
    description: "Defensive Normalization: Sequence 3-4-5-6 with duplicate strings [\"6\", \"4\", \"3\", \"5\", \"6\"]"
  },
  {
    category: 'smallStraight',
    dice: [1, 2, 4, 5, 6],
    expected: 0,
    description: "Standard: Gapped non-straight [1, 2, 4, 5, 6]"
  },
  // Large Straight
  {
    category: 'largeStraight',
    dice: [5, 2, 4, 1, 3],
    expected: 40,
    description: "Shuffled: Sequence 1-2-3-4-5 out of order [5, 2, 4, 1, 3]"
  },
  {
    category: 'largeStraight',
    dice: ["6", "4", "2", "3", "5"],
    expected: 40,
    description: "Defensive Normalization: Sequence 2-3-4-5-6 with string elements [\"6\", \"4\", \"2\", \"3\", \"5\"]"
  },
  {
    category: 'largeStraight',
    dice: [1, 2, 3, 4, 6],
    expected: 0,
    description: "Standard: Gapped non-straight [1, 2, 3, 4, 6]"
  },
  // Yatzy
  {
    category: 'yahtzee',
    dice: [4, 4, 4, 4, 4],
    expected: 50,
    description: "Standard: Yatzy [4, 4, 4, 4, 4]"
  },
  {
    category: 'yahtzee',
    dice: [4, 4, 4, 4, 3],
    expected: 0,
    description: "Standard: Invalid Yatzy [4, 4, 4, 4, 3]"
  },
  // Chance
  {
    category: 'chance',
    dice: [1, 2, 3, 4, 5],
    expected: 15,
    description: "Standard: Chance [1, 2, 3, 4, 5]"
  },
  {
    category: 'chance',
    dice: ["1", "2", "3", "4", "5"],
    expected: 15,
    description: "Defensive Type Normalization: Chance with string array"
  },
  {
    category: 'smallStraight',
    dice: [6, 6, 6, 6, 6],
    expected: 30,
    description: "Joker Activation: Subsequent Yahtzee with a string '50' still enables Joker scoring",
    stateOverride: {
      activePlayer: 0,
      playerScore: { yahtzee: "50", yahtzeeBonuses: 0 }
    }
  },
  {
    category: 'yahtzeeBonus',
    dice: [6, 6, 6, 6, 6],
    expected: 1,
    description: "Bonus Tracking: Subsequent Yahtzee increments bonus counter when initial Yahtzee is already scored",
    stateOverride: {
      activePlayer: 0,
      playerScore: { yahtzee: 50, yahtzeeBonuses: 0 }
    },
    bonusCheck: true
  }
];

// Run test suite
function runTestSuite() {
  const tbody = document.getElementById('tests-tbody');
  tbody.innerHTML = '';
  
  let passes = 0;
  
  TEST_SPEC.forEach((test, idx) => {
    const originalActivePlayer = STATE.activePlayer;
    const originalScores = JSON.parse(JSON.stringify(STATE.scores));
    const originalDice = [...STATE.dice];

    if (test.stateOverride) {
      const testPlayer = test.stateOverride.activePlayer ?? 0;
      STATE.activePlayer = testPlayer;
      STATE.scores[testPlayer] = {
        ...STATE.scores[testPlayer],
        ...test.stateOverride.playerScore
      };
    }

    // Run the actual detection function from app.js
    let actual;
    if (test.bonusCheck) {
      STATE.dice = (test.dice || []).map(Number);
      checkSubsequentYahtzeeBonus();
      actual = STATE.scores[STATE.activePlayer].yahtzeeBonuses;
    } else {
      actual = calculatePotentialScore(test.category, test.dice);
    }

    STATE.activePlayer = originalActivePlayer;
    STATE.scores = originalScores;
    STATE.dice = originalDice;
    const passed = actual === test.expected;
    
    if (passed) passes++;
    
    const tr = document.createElement('tr');
    tr.className = `test-row ${passed ? 'passed-row' : 'failed-row'}`;
    tr.setAttribute('data-category', test.category);
    tr.setAttribute('data-status', passed ? 'passed' : 'failed');
    
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="font-medium">${test.description}</td>
      <td><span class="badge badge-category">${test.category}</span></td>
      <td class="font-mono">${JSON.stringify(test.dice)}</td>
      <td class="font-bold text-blue">${test.expected}</td>
      <td class="font-bold ${passed ? 'text-green' : 'text-red'}">${actual}</td>
      <td>
        <span class="badge ${passed ? 'badge-pass' : 'badge-fail'}">
          ${passed ? '✓ PASS' : '✗ FAIL'}
        </span>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Calculate percentage
  const total = TEST_SPEC.length;
  const percent = Math.round((passes / total) * 100);
  
  // Update dashboard stats
  document.getElementById('total-tests').innerText = total;
  document.getElementById('passed-tests').innerText = passes;
  document.getElementById('failed-tests').innerText = total - passes;
  document.getElementById('pass-percentage').innerText = `${percent}%`;
  
  // Update progress bar
  const progressBar = document.getElementById('progress-bar-fill');
  progressBar.style.width = `${percent}%`;
  
  if (percent === 100) {
    progressBar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    playTestSound(true);
  } else {
    progressBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
    playTestSound(false);
  }
}

// Synthesis test sound confirmation (Web Audio API)
function playTestSound(success) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (success) {
      // Premium victory chime sequence (two ascending tones)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
      
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.45);
    } else {
      // Sad buzz tone for failures
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn("Audio Context blocked or failed to initialize", e);
  }
}

// Filter lists on input
document.getElementById('filter-search').oninput = (e) => {
  const query = e.target.value.toLowerCase();
  applyFilters(query, document.getElementById('filter-status').value);
};

document.getElementById('filter-status').onchange = (e) => {
  const status = e.target.value;
  applyFilters(document.getElementById('filter-search').value.toLowerCase(), status);
};

function applyFilters(searchQuery, statusFilter) {
  const rows = document.querySelectorAll('.test-row');
  rows.forEach(row => {
    const desc = row.children[1].innerText.toLowerCase();
    const cat = row.getAttribute('data-category').toLowerCase();
    const status = row.getAttribute('data-status');
    
    const matchesSearch = desc.includes(searchQuery) || cat.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    
    if (matchesSearch && matchesStatus) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Trigger suite run on page load
window.onload = () => {
  runTestSuite();
};
