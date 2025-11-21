// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const WINDS = ['East', 'South', 'West', 'North'];
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

    // Handle dealer rotation according to Chinese Official rules
    const isDraw = winnerIndex === null;
    const dealerWon = winnerIndex === dealerIndex;

    state.roundHandCount++;

    if (dealerWon || isDraw) {
        // Dealer continues, hand count increases
        state.dealerHandCount++;
    } else {
        // Non-dealer won, dealer passes to next player
        state.currentDealer = (state.currentDealer + 1) % 4;
        state.dealerHandCount = 1;

        // Check if we should advance to next prevailing wind
        // After all 4 players have been dealer, move to next wind
        if (state.currentDealer === 0 && state.roundHandCount > 0) {
            state.prevailingWind = (state.prevailingWind + 1) % 4;
            state.roundHandCount = 0;
        }
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
    const startingPoints = state.startingPoints;

    state = JSON.parse(JSON.stringify(defaultState));
    state.startingPoints = startingPoints;
    state.scores = [startingPoints, startingPoints, startingPoints, startingPoints];

    if (oldNames) {
        state.players = oldNames.map(name => ({ name }));
    }

    saveState();
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderScoreTable() {
    const tbody = document.getElementById('score-table-body');
    tbody.innerHTML = '';

    state.players.forEach((player, index) => {
        const tr = document.createElement('tr');
        const isDealer = index === state.currentDealer;

        if (state.settings.highlightDealer && isDealer) {
            tr.classList.add('dealer-row');
        }

        const wind = getPlayerWind(index);
        const score = state.scores[index];
        const plusMinus = score - state.startingPoints;
        const plusMinusText = plusMinus >= 0 ? `+${plusMinus}` : `${plusMinus}`;
        const plusMinusClass = plusMinus > 0 ? 'plus-minus-positive' :
            plusMinus < 0 ? 'plus-minus-negative' : 'plus-minus-zero';

        tr.innerHTML = `
            <td class="wind-cell">${wind}${isDealer ? ' ⭐' : ''}</td>
            <td>${player.name}</td>
            <td class="score-cell">${score.toLocaleString()}</td>
            <td class="plus-minus-col ${plusMinusClass}">${plusMinusText}</td>
        `;

        tbody.appendChild(tr);
    });

    // Handle plus-minus column visibility
    const plusMinusCols = document.querySelectorAll('.plus-minus-col');
    plusMinusCols.forEach(col => {
        if (state.settings.showPlusMinus) {
            col.classList.remove('hidden');
        } else {
            col.classList.add('hidden');
        }
    });
}

function renderGameInfo() {
    const roundLabel = getCurrentRoundLabel();
    const prevailingWind = getPrevailingWindName();
    document.getElementById('current-round-display').textContent = `${prevailingWind} Round: ${roundLabel}`;
    document.getElementById('dealer-display').textContent = `Dealer: ${state.players[state.currentDealer].name} (East)`;
    document.getElementById('total-hands-display').textContent = `Hands Played: ${state.history.length}`;
}

function renderHandEntryForm() {
    // Populate winner select
    const winnerSelect = document.getElementById('hand-winner-select');
    winnerSelect.innerHTML = '<option value="">-- Select Player --</option>';
    state.players.forEach((player, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = player.name;
        winnerSelect.appendChild(option);
    });

    // Populate discarder select
    const discarderSelect = document.getElementById('discarder-select');
    discarderSelect.innerHTML = '';
    state.players.forEach((player, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = player.name;
        discarderSelect.appendChild(option);
    });

    // Initial display
    updateScoreDisplay();
}

function calculateScores() {
    const winnerValue = document.getElementById('hand-winner-select').value;

    // If no winner selected, return zeros
    if (winnerValue === '') {
        return [0, 0, 0, 0];
    }

    const winnerIndex = parseInt(winnerValue);
    const basePoints = parseInt(document.getElementById('base-points').value) || 0;
    const winType = document.getElementById('win-type-select').value;

    if (basePoints === 0) {
        return [0, 0, 0, 0];
    }

    const scores = [0, 0, 0, 0];
    const dealerIndex = state.currentDealer;
    const isWinnerDealer = winnerIndex === dealerIndex;

    if (winType === 'self-draw') {
        // Self-draw: all others pay the winner
        for (let i = 0; i < 4; i++) {
            if (i === winnerIndex) continue;

            const isPayerDealer = i === dealerIndex;

            if (isWinnerDealer) {
                // Dealer wins by self-draw: receives double from all
                scores[i] = -basePoints * 2;
                scores[winnerIndex] += basePoints * 2;
            } else if (isPayerDealer) {
                // Non-dealer wins, dealer pays: dealer pays double
                scores[i] = -basePoints * 2;
                scores[winnerIndex] += basePoints * 2;
            } else {
                // Non-dealer wins, non-dealer pays: normal
                scores[i] = -basePoints;
                scores[winnerIndex] += basePoints;
            }
        }
    } else {
        // Win on discard: only discarder pays
        const discarderIndex = parseInt(document.getElementById('discarder-select').value);
        const isDiscarderDealer = discarderIndex === dealerIndex;

        if (isWinnerDealer || isDiscarderDealer) {
            // Either winner or discarder is dealer: double
            scores[discarderIndex] = -basePoints * 2;
            scores[winnerIndex] = basePoints * 2;
        } else {
            // Neither is dealer: normal
            scores[discarderIndex] = -basePoints;
            scores[winnerIndex] = basePoints;
        }
    }

    return scores;
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


function renderHistory() {
    const historyList = document.getElementById('history-list');

    if (state.history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No hands played yet</div>';
        return;
    }

    // Build table header
    let tableHTML = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Hand</th>
                    <th>${state.players[0].name}</th>
                    <th>${state.players[1].name}</th>
                    <th>${state.players[2].name}</th>
                    <th>${state.players[3].name}</th>
                    <th>Mahjong</th>
                    <th>East</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Add rows for each hand
    state.history.forEach((hand, index) => {
        const dealerName = state.players[hand.dealer].name;
        // Handle old data that might have null winner (from when draw was an option)
        const winnerName = hand.winner !== null ? state.players[hand.winner].name : 'Draw';

        tableHTML += '<tr>';

        // Hand number
        tableHTML += `<td class="hand-number">${index + 1}</td>`;

        // Score changes for each player
        hand.scoreChanges.forEach((change) => {
            const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : 'zero';
            const changeText = change >= 0 ? `+${change}` : `${change}`;
            tableHTML += `<td class="score-change ${changeClass}">${changeText}</td>`;
        });

        // Mahjong winner
        tableHTML += `<td class="mahjong-winner">${winnerName}</td>`;

        // East (dealer)
        tableHTML += `<td class="east-dealer">${dealerName}</td>`;

        tableHTML += '</tr>';
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    historyList.innerHTML = tableHTML;
}

function renderSettings() {
    document.getElementById('setup-starting-points').value = state.startingPoints;

    state.players.forEach((player, index) => {
        document.getElementById(`player-name-${index}`).value = player.name;
    });

    document.getElementById('starting-dealer-select').value = state.currentDealer;
    document.getElementById('show-plus-minus').checked = state.settings.showPlusMinus;
    document.getElementById('highlight-dealer').checked = state.settings.highlightDealer;
}

function renderAll() {
    renderScoreTable();
    renderGameInfo();
    renderHandEntryForm();
    renderHistory();
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
        alert('Please select who had Mahjong');
        return;
    }

    const winnerIndex = parseInt(winnerValue);

    // Get calculated scores
    const scoreChanges = calculateScores();

    // Validate points were entered
    const basePoints = parseInt(document.getElementById('base-points').value) || 0;
    if (basePoints === 0) {
        alert('Please enter the points value');
        return;
    }

    // Apply scores
    applyHandScores(winnerIndex, scoreChanges);
    resetHandForm();
    renderAll();
}

function resetHandForm() {
    document.getElementById('hand-winner-select').value = '';
    document.getElementById('base-points').value = '';
    document.getElementById('win-type-select').value = 'self-draw';
    document.getElementById('mahjong-details').style.display = 'none';
    document.getElementById('discarder-group').style.display = 'none';
    updateScoreDisplay();
}

function handleUndo() {
    if (state.history.length === 0) {
        alert('No hands to undo');
        return;
    }

    showConfirm(
        'Undo Last Hand',
        'Are you sure you want to undo the last hand?',
        () => {
            undoLastHand();
            renderAll();
        }
    );
}

function handleNewGame() {
    showConfirm(
        'Start New Game',
        'Start a new game? This will reset all scores and history. Player names will be kept.',
        () => {
            startNewGame(true);
            renderAll();
            closeModal('settings-modal');
        }
    );
}

function handleResetAll() {
    showConfirm(
        'Reset All Data',
        'This will delete all data including player names and settings. Are you sure?',
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
    // Update starting points
    const startingPoints = parseInt(document.getElementById('setup-starting-points').value);
    if (startingPoints > 0) {
        state.startingPoints = startingPoints;
    }

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

    // Get starting points
    const startingPoints = parseInt(document.getElementById('setup-starting-score').value);

    // Initialize game state following Chinese Official rules
    state.players = [
        { name: playerNames[0] },
        { name: playerNames[1] },
        { name: playerNames[2] },
        { name: playerNames[3] }
    ];
    state.scores = [startingPoints, startingPoints, startingPoints, startingPoints];
    state.startingPoints = startingPoints;
    state.prevailingWind = 0; // Start with East round
    state.currentDealer = 0; // Player 1 starts as dealer
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

    // Winner selection changes
    document.getElementById('hand-winner-select').addEventListener('change', (e) => {
        const hasWinner = e.target.value !== '';
        document.getElementById('mahjong-details').style.display = hasWinner ? 'block' : 'none';

        // Update discarder dropdown to exclude winner
        if (hasWinner) {
            const winnerIndex = parseInt(e.target.value);
            const discarderSelect = document.getElementById('discarder-select');
            discarderSelect.innerHTML = '';

            state.players.forEach((player, index) => {
                if (index !== winnerIndex) {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = player.name;
                    discarderSelect.appendChild(option);
                }
            });
        }

        updateScoreDisplay();
    });

    // Win type changes
    document.getElementById('win-type-select').addEventListener('change', (e) => {
        const isDiscard = e.target.value === 'discard';
        document.getElementById('discarder-group').style.display = isDiscard ? 'block' : 'none';
        updateScoreDisplay();
    });

    // Base points changes
    document.getElementById('base-points').addEventListener('input', updateScoreDisplay);

    // Discarder selection changes
    document.getElementById('discarder-select').addEventListener('change', updateScoreDisplay);

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
    ['setup-starting-points', 'player-name-0', 'player-name-1', 'player-name-2', 'player-name-3'].forEach(id => {
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
