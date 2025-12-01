// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const WINDS = ['Oost', 'Zuid', 'West', 'Noord'];
const STORAGE_KEY = 'mahjong_game_state';

// Default state
const defaultState = {
    players: [
        { name: 'Player 1' },
        { name: 'Player 2' },
        { name: 'Player 3' },
        { name: 'Player 4' }
    ],
    scores: [25000, 25000, 25000, 25000],
    startingPoints: 25000,
    prevailingWind: 0, // 0=East, 1=South, 2=West, 3=North round
    currentDealer: 0, // Which player (0-3) is currently dealer
    startingDealer: 0, // Who was the first dealer (for score sheet calculation)
    dealerHandCount: 1, // How many hands this dealer has dealt
    roundHandCount: 0, // Total hands in this round (to track when to change prevailing wind)
    history: [],
    settings: {
        showPlusMinus: true,
        highlightDealer: true
    }
};

let state = JSON.parse(JSON.stringify(defaultState));

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save state:', e);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            state = JSON.parse(saved);
            // Ensure all required properties exist (for backwards compatibility)
            if (!state.settings) {
                state.settings = defaultState.settings;
            }
            // Migrate old state format to new format
            if (state.consecutiveDealerHands !== undefined && state.dealerHandCount === undefined) {
                state.dealerHandCount = state.consecutiveDealerHands;
                delete state.consecutiveDealerHands;
            }
            if (state.prevailingWind === undefined) {
                state.prevailingWind = 0;
            }
            if (state.roundHandCount === undefined) {
                state.roundHandCount = state.history.length;
            }
            if (state.startingDealer === undefined) {
                state.startingDealer = 0;
            }
            // Remove old seatIndex if it exists
            if (state.players[0].seatIndex !== undefined) {
                state.players.forEach(p => delete p.seatIndex);
            }
            return true;
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
    return false;
}

function resetState() {
    state = JSON.parse(JSON.stringify(defaultState));
    saveState();
}

// ============================================================================
// GAME LOGIC
// ============================================================================

// Get the seat wind for a player based on their position relative to dealer
function getPlayerWind(playerIndex) {
    // Dealer is always East, next player is South, etc.
    const offset = (playerIndex - state.currentDealer + 4) % 4;
    return WINDS[offset];
}

function getCurrentRoundLabel() {
    const prevailingWindName = WINDS[state.prevailingWind];
    return `${prevailingWindName}-${state.dealerHandCount}`;
}

function getPrevailingWindName() {
    return WINDS[state.prevailingWind];
}

function applyHandScores(winnerIndex, scoreChanges) {
    // Note: dealerIndex is now determined automatically from state.currentDealer
    const dealerIndex = state.currentDealer;

    // Apply score changes
    for (let i = 0; i < 4; i++) {
        state.scores[i] += scoreChanges[i];
    }

    // Create history entry
    const historyEntry = {
        handLabel: getCurrentRoundLabel(),
        prevailingWind: state.prevailingWind,
        dealer: dealerIndex,
        winner: winnerIndex, // null for draw
        scoreChanges: [...scoreChanges],
        resultingScores: [...state.scores],
        previousDealer: state.currentDealer,
        previousDealerHandCount: state.dealerHandCount,
        previousPrevailingWind: state.prevailingWind,
        previousRoundHandCount: state.roundHandCount
    };
    state.history.push(historyEntry);

    // Dealer rotation: East always passes to the next player after each hand
    state.roundHandCount++;
    state.currentDealer = (state.currentDealer + 1) % 4;
    state.dealerHandCount++;

    // Check if we should advance to next prevailing wind
    // After all 4 players have been dealer (completed a full round), move to next wind
    if (state.roundHandCount % 4 === 0) {
        state.prevailingWind = (state.prevailingWind + 1) % 4;
    }

    saveState();
}

function undoLastHand() {
    if (state.history.length === 0) {
        return false;
    }

    const lastHand = state.history.pop();

    // Reverse score changes
    for (let i = 0; i < 4; i++) {
        state.scores[i] -= lastHand.scoreChanges[i];
    }

    // Restore dealer state
    state.currentDealer = lastHand.previousDealer;
    state.dealerHandCount = lastHand.previousDealerHandCount;
    state.prevailingWind = lastHand.previousPrevailingWind;
    state.roundHandCount = lastHand.previousRoundHandCount;

    saveState();
    return true;
}

function startNewGame(keepPlayerNames = true) {
    const oldNames = keepPlayerNames ? state.players.map(p => p.name) : null;
    const oldStartingDealer = state.startingDealer || 0;
    const startingPoints = 25000; // Fixed starting points

    state = JSON.parse(JSON.stringify(defaultState));
    state.startingPoints = startingPoints;
    state.scores = [startingPoints, startingPoints, startingPoints, startingPoints];
    state.startingDealer = oldStartingDealer;
    state.currentDealer = oldStartingDealer;

    if (oldNames) {
        state.players = oldNames.map(name => ({ name }));
    }

    saveState();
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderCurrentScores() {
    const scoresDiv = document.getElementById('current-scores');
    scoresDiv.innerHTML = '';

    state.players.forEach((player, index) => {
        const isDealer = index === state.currentDealer;
        const score = state.scores[index];
        const diff = score - state.startingPoints;
        const diffText = diff >= 0 ? `+${diff}` : `${diff}`;
        const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';

        const card = document.createElement('div');
        card.className = `current-score-card ${isDealer ? 'dealer' : ''}`;
        card.innerHTML = `
            <div class="current-score-name">${player.name}</div>
            <div class="current-score-value">${score.toLocaleString()}</div>
            <div class="current-score-diff ${diffClass}">${diffText}</div>
        `;
        scoresDiv.appendChild(card);
    });
}

function renderScoreSheet() {
    const tbody = document.getElementById('score-sheet-body');
    tbody.innerHTML = '';

    // Update table headers with player names
    for (let i = 0; i < 4; i++) {
        document.getElementById(`player-col-${i}`).textContent = state.players[i].name;
    }

    // Use the stored starting dealer
    const startingDealer = state.startingDealer || 0;

    // Create 16 rows (4 rounds × 4 hands each)
    for (let handNum = 0; handNum < 16; handNum++) {
        const windIndex = Math.floor(handNum / 4);
        const windName = WINDS[windIndex];
        const dealerIndex = (startingDealer + handNum) % 4;
        const dealerName = state.players[dealerIndex].name;

        const tr = document.createElement('tr');
        const isCurrentHand = handNum === state.history.length;
        const isCompleted = handNum < state.history.length;

        if (isCurrentHand) {
            tr.classList.add('current-hand');
        } else if (isCompleted) {
            tr.classList.add('completed-hand');
        }

        let rowHTML = `
            <td class="hand-number">${handNum + 1}</td>
            <td class="wind-round">${windName}</td>
            <td class="east-player">${dealerName}</td>
        `;

        // Add score columns for each player
        for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
            let scoreHTML = '-';
            if (isCompleted) {
                const hand = state.history[handNum];
                const scoreChange = hand.scoreChanges[playerIndex];
                const scoreClass = scoreChange > 0 ? 'positive' : scoreChange < 0 ? 'negative' : '';
                const scoreText = scoreChange >= 0 ? `+${scoreChange}` : `${scoreChange}`;
                scoreHTML = `<span class="score-value ${scoreClass}">${scoreText}</span>`;
            } else if (isCurrentHand) {
                scoreHTML = `<span class="score-value empty">-</span>`;
            } else {
                scoreHTML = `<span class="score-value empty">-</span>`;
            }
            rowHTML += `<td>${scoreHTML}</td>`;
        }

        // Add winner column
        let winnerHTML = '-';
        if (isCompleted) {
            const hand = state.history[handNum];
            if (hand.winner !== null) {
                winnerHTML = state.players[hand.winner].name;
            }
        }
        rowHTML += `<td>${winnerHTML}</td>`;

        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    }
}

function renderGameInfo() {
    const currentHandNum = state.history.length + 1;
    document.getElementById('current-hand-number').textContent = `${currentHandNum}`;
}

function renderHandEntryForm() {
    // Populate winner segmented buttons
    const winnerButtonsDiv = document.getElementById('hand-winner-buttons');
    winnerButtonsDiv.innerHTML = '';
    state.players.forEach((player, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'segmented-button';
        button.dataset.value = index;
        button.textContent = player.name;
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            winnerButtonsDiv.querySelectorAll('.segmented-button').forEach(btn => {
                btn.classList.remove('active');
            });
            // Add active class to clicked button
            button.classList.add('active');
            // Set hidden input value
            document.getElementById('hand-winner-select').value = index;
            // Show mahjong details
            document.getElementById('mahjong-details').style.display = 'block';
            updateScoreDisplay();
        });
        winnerButtonsDiv.appendChild(button);
    });

    // Populate individual counts inputs
    const individualCountsDiv = document.getElementById('individual-counts');
    individualCountsDiv.innerHTML = '';
    state.players.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'individual-count-group';
        div.innerHTML = `
            <label for="individual-count-${index}">${player.name}</label>
            <input type="number" id="individual-count-${index}" min="0" step="1" value="0" placeholder="0">
        `;
        individualCountsDiv.appendChild(div);
    });

    // Initial display
    updateScoreDisplay();
}

function calculateNTSSettlement(winnerIndex, individualCounts) {
    // NTS Rules (Nederlandse Toernooi Spelregels):
    // 1. Winner receives from all 3 other players
    // 2. Winner never pays
    // 3. Other 3 players settle scores among themselves
    // 4. East (Oost) always pays and receives DOUBLE in all transactions

    const scoreChanges = [0, 0, 0, 0];
    const dealerIndex = state.currentDealer;

    // Step 1: Winner receives from all other players
    for (let i = 0; i < 4; i++) {
        if (i === winnerIndex) continue;

        let payment = individualCounts[winnerIndex];

        // Double if either winner or payer is East
        if (winnerIndex === dealerIndex || i === dealerIndex) {
            payment *= 2;
        }

        scoreChanges[winnerIndex] += payment;
        scoreChanges[i] -= payment;
    }

    // Step 2: Non-winners settle with each other
    const nonWinners = [0, 1, 2, 3].filter(i => i !== winnerIndex);

    for (let i = 0; i < nonWinners.length; i++) {
        for (let j = i + 1; j < nonWinners.length; j++) {
            const player1 = nonWinners[i];
            const player2 = nonWinners[j];

            let diff = individualCounts[player1] - individualCounts[player2];

            // Double if either player is East
            if (player1 === dealerIndex || player2 === dealerIndex) {
                diff *= 2;
            }

            scoreChanges[player1] += diff;
            scoreChanges[player2] -= diff;
        }
    }

    return scoreChanges;
}

function calculateScores() {
    const winnerValue = document.getElementById('hand-winner-select').value;

    // If no winner selected, return zeros
    if (winnerValue === '') {
        return [0, 0, 0, 0];
    }

    const winnerIndex = parseInt(winnerValue);

    // Get individual counts from inputs
    const individualCounts = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const input = document.getElementById(`individual-count-${i}`);
        individualCounts[i] = parseInt(input?.value || 0) || 0;
    }

    // Check if any counts were entered
    const hasAnyCounts = individualCounts.some(count => count !== 0);
    if (!hasAnyCounts) {
        return [0, 0, 0, 0];
    }

    // Calculate using NTS settlement rules
    return calculateNTSSettlement(winnerIndex, individualCounts);
}

function updateScoreDisplay() {
    const scores = calculateScores();
    const scoreDisplay = document.getElementById('score-display');
    scoreDisplay.innerHTML = '';

    state.players.forEach((player, index) => {
        const score = scores[index];
        const scoreClass = score > 0 ? 'positive' : score < 0 ? 'negative' : 'zero';
        const scoreText = score >= 0 ? `+${score}` : `${score}`;
        const wind = getPlayerWind(index);

        const div = document.createElement('div');
        div.className = 'score-display-item';
        div.innerHTML = `
            <span class="score-display-label">${wind} - ${player.name}</span>
            <span class="score-display-value ${scoreClass}">${scoreText}</span>
        `;
        scoreDisplay.appendChild(div);
    });
}


function renderSettings() {
    state.players.forEach((player, index) => {
        document.getElementById(`player-name-${index}`).value = player.name;
    });

    document.getElementById('starting-dealer-select').value = state.currentDealer;
    document.getElementById('show-plus-minus').checked = state.settings.showPlusMinus;
    document.getElementById('highlight-dealer').checked = state.settings.highlightDealer;
}

function renderAll() {
    renderCurrentScores();
    renderGameInfo();
    renderHandEntryForm();
    renderScoreSheet();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleHandSubmit(e) {
    e.preventDefault();

    // Get form values (dealer is automatic from state.currentDealer)
    const winnerValue = document.getElementById('hand-winner-select').value;

    // Validate winner is selected
    if (winnerValue === '') {
        alert('Selecteer wie Mahjong had');
        return;
    }

    const winnerIndex = parseInt(winnerValue);

    // Get individual counts
    const individualCounts = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const input = document.getElementById(`individual-count-${i}`);
        individualCounts[i] = parseInt(input?.value || 0) || 0;
    }

    // Validate at least one count was entered
    const hasAnyCounts = individualCounts.some(count => count !== 0);
    if (!hasAnyCounts) {
        alert('Voer minimaal één individueel punt in');
        return;
    }

    // Get calculated scores using NTS settlement rules
    const scoreChanges = calculateScores();

    // Apply scores
    applyHandScores(winnerIndex, scoreChanges);
    resetHandForm();
    renderAll();
}

function resetHandForm() {
    document.getElementById('hand-winner-select').value = '';

    // Reset all segmented buttons
    document.querySelectorAll('.segmented-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Reset all individual count inputs
    for (let i = 0; i < 4; i++) {
        const input = document.getElementById(`individual-count-${i}`);
        if (input) {
            input.value = '0';
        }
    }

    document.getElementById('mahjong-details').style.display = 'none';
    updateScoreDisplay();
}

function handleUndo() {
    if (state.history.length === 0) {
        alert('Geen handen om ongedaan te maken');
        return;
    }

    showConfirm(
        'Laatste Hand Ongedaan Maken',
        'Weet je zeker dat je de laatste hand ongedaan wilt maken?',
        () => {
            undoLastHand();
            renderAll();
        }
    );
}

function handleNewGame() {
    showConfirm(
        'Start Nieuw Spel',
        'Nieuw spel starten? Dit zal alle scores en geschiedenis resetten. Spelernamen blijven behouden.',
        () => {
            startNewGame(true);
            renderAll();
            closeModal('settings-modal');
        }
    );
}

function handleResetAll() {
    showConfirm(
        'Reset Alle Data',
        'Dit zal alle data inclusief spelernamen en instellingen verwijderen. Weet je het zeker?',
        () => {
            resetState();
            closeModal('settings-modal');
            showWelcomeScreen();
            // Clear the setup form
            document.getElementById('setup-form').reset();
        }
    );
}

function handleSettingsUpdate() {
    // Update player names
    state.players.forEach((player, index) => {
        const nameInput = document.getElementById(`player-name-${index}`);
        if (nameInput.value.trim()) {
            player.name = nameInput.value.trim();
        }
    });

    // Update display settings
    state.settings.showPlusMinus = document.getElementById('show-plus-minus').checked;
    state.settings.highlightDealer = document.getElementById('highlight-dealer').checked;

    saveState();
    renderAll();
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const yesBtn = document.getElementById('confirm-yes-btn');
    const noBtn = document.getElementById('confirm-no-btn');

    // Remove old listeners
    const newYesBtn = yesBtn.cloneNode(true);
    const newNoBtn = noBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    newYesBtn.addEventListener('click', () => {
        onConfirm();
        closeModal('confirm-modal');
    });

    newNoBtn.addEventListener('click', () => {
        closeModal('confirm-modal');
    });

    openModal('confirm-modal');
}

// ============================================================================
// SCREEN MANAGEMENT
// ============================================================================

function showWelcomeScreen() {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('game-screen').style.display = 'none';
}

function showGameScreen() {
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
}

function handleSetupSubmit(e) {
    e.preventDefault();

    // Get player names
    const playerNames = [
        document.getElementById('setup-player-1').value.trim(),
        document.getElementById('setup-player-2').value.trim(),
        document.getElementById('setup-player-3').value.trim(),
        document.getElementById('setup-player-4').value.trim()
    ];

    // Get starting dealer selection
    const startingDealer = parseInt(document.getElementById('setup-starting-dealer').value);

    // Starting points fixed at 25000
    const startingPoints = 25000;

    // Initialize game state following NTS rules
    state.players = [
        { name: playerNames[0] },
        { name: playerNames[1] },
        { name: playerNames[2] },
        { name: playerNames[3] }
    ];
    state.scores = [startingPoints, startingPoints, startingPoints, startingPoints];
    state.startingPoints = startingPoints;
    state.prevailingWind = 0; // Start with East round
    state.currentDealer = startingDealer; // User-selected starting dealer
    state.startingDealer = startingDealer; // Store for score sheet
    state.dealerHandCount = 1;
    state.roundHandCount = 0;
    state.history = [];

    saveState();

    // Show game screen and render
    showGameScreen();
    renderAll();
    renderSettings();
    setupGameListeners();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    // Try to load existing game state
    const hasExistingGame = loadState();

    // Setup event listeners for setup form
    document.getElementById('setup-form').addEventListener('submit', handleSetupSubmit);

    // Update starting dealer dropdown when player names change
    const updateDealerOptions = () => {
        const dealerSelect = document.getElementById('setup-starting-dealer');
        const currentValue = dealerSelect.value;

        for (let i = 0; i < 4; i++) {
            const nameInput = document.getElementById(`setup-player-${i + 1}`);
            const option = dealerSelect.options[i];
            const name = nameInput.value.trim();
            option.textContent = name ? name : `Player ${i + 1}`;
        }

        dealerSelect.value = currentValue;
    };

    // Add listeners to player name inputs
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`setup-player-${i}`).addEventListener('input', updateDealerOptions);
    }

    // If no existing game, show welcome screen
    if (!hasExistingGame) {
        showWelcomeScreen();
        return;
    }

    // Otherwise show game screen
    showGameScreen();
    renderAll();
    renderSettings();

    // Setup game screen event listeners
    setupGameListeners();
}

// Track if listeners have been set up to avoid duplicates
let gameListenersSetup = false;

function setupGameListeners() {
    if (gameListenersSetup) return;
    gameListenersSetup = true;

    document.getElementById('hand-entry-form').addEventListener('submit', handleHandSubmit);
    document.getElementById('undo-btn').addEventListener('click', handleUndo);

    // Individual count input changes - delegate to parent container
    document.getElementById('individual-counts').addEventListener('input', (e) => {
        if (e.target.matches('input[type="number"]')) {
            updateScoreDisplay();
        }
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        renderSettings();
        openModal('settings-modal');
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
        handleSettingsUpdate();
        closeModal('settings-modal');
    });

    document.getElementById('new-game-btn').addEventListener('click', handleNewGame);
    document.getElementById('reset-all-btn').addEventListener('click', handleResetAll);

    // Settings change listeners
    document.getElementById('show-plus-minus').addEventListener('change', handleSettingsUpdate);
    document.getElementById('highlight-dealer').addEventListener('change', handleSettingsUpdate);

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });

    // Auto-save settings on input changes
    ['player-name-0', 'player-name-1', 'player-name-2', 'player-name-3'].forEach(id => {
        document.getElementById(id).addEventListener('change', handleSettingsUpdate);
    });

    console.log('Mahjong Scoring App initialized');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
