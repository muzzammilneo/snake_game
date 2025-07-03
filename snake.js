// Get elements (with error checking)
let canvas, ctx, scoreElement, gameOverElement, difficultyElement, difficultyScreen, gameScreen;

function initializeElements() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return false;
    }
    
    ctx = canvas.getContext('2d');
    scoreElement = document.getElementById('score');
    gameOverElement = document.getElementById('gameOver');
    difficultyElement = document.getElementById('difficulty');
    difficultyScreen = document.getElementById('difficultyScreen');
    gameScreen = document.getElementById('gameScreen');
    
    return true;
}

// Game settings
const gridSize = 20;
let tileCount = 20; // Will be set when canvas is initialized

// Difficulty settings
const difficulties = {
    easy: { speed: 150, scoreMultiplier: 1, name: 'Easy' },
    medium: { speed: 100, scoreMultiplier: 2, name: 'Medium' },
    hard: { speed: 60, scoreMultiplier: 3, name: 'Hard' }
};

let currentDifficulty = 'medium';
let gameSpeed = difficulties.medium.speed;

// Game state
let snake = [
    {x: 10, y: 10},
    {x: 9, y: 10},
    {x: 8, y: 10}
];
// Smooth movement state
let snakeRenderPositions = [];
let moveProgress = 0;
let lastMoveTime = 0;
let targetPositions = [];

let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let gameRunning = true;
let gameStarted = false;
let gamePaused = false;
let directionChanged = false; // Prevent multiple direction changes per frame
let animationFrame = 0; // For frog blinking animation
let gameLoopTimeoutId = null; // Track game loop timeout
let renderLoopId = null; // Track render loop
let lastUpdateTime = 0; // Track last game logic update
let eventListenersAdded = false; // Track if event listeners are already added

// Sound effects
let soundEnabled = true;
let audioContext = null;
let sounds = {
    eat: () => {},
    gameOver: () => {},
    move: () => {}
};

// Initialize sounds using Web Audio API
function initSounds() {
    if (audioContext) return; // Only initialize once
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        // Create sound effects using oscillators
        sounds.eat = () => {
            if (!soundEnabled || !audioContext) return;
            try {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                console.log('Sound error:', e);
            }
        };
        
        sounds.gameOver = () => {
            if (!soundEnabled || !audioContext) return;
            try {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.5);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
                console.log('Sound error:', e);
            }
        };
        
        sounds.move = () => {
            if (!soundEnabled || !audioContext) return;
            try {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
                oscillator.type = 'square';
                
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.05);
            } catch (e) {
                console.log('Sound error:', e);
            }
        };
    } catch (e) {
        console.log('Audio context creation failed:', e);
        // Create silent fallback functions
        sounds.eat = () => {};
        sounds.gameOver = () => {};
        sounds.move = () => {};
    }
}

// Pause/Resume game
function togglePause() {
    if (!gameRunning || !gameStarted) return;
    
    gamePaused = !gamePaused;
    if (!gamePaused) {
        lastUpdateTime = Date.now(); // Reset timing when resuming
    }
}

// Toggle sound on/off
function toggleSound() {
    soundEnabled = !soundEnabled;
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    }
}

// Restart game
function restartGame() {
    init();
}

// Initialize game
function init() {
    // Clear any existing game loop
    if (gameLoopTimeoutId) {
        clearTimeout(gameLoopTimeoutId);
        gameLoopTimeoutId = null;
    }
    
    // Initialize sound system if not already initialized
    if (!audioContext) {
        initSounds();
    }
    
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    
    // Initialize smooth movement positions
    initializeSmoothPositions();
    
    dx = 0;
    dy = 0;
    score = 0;
    gameRunning = true;
    gameStarted = false;
    gamePaused = false;
    directionChanged = false; // Reset direction change flag
    moveProgress = 0;
    lastMoveTime = Date.now();
    scoreElement.textContent = score;
    gameOverElement.style.display = 'none';
    generateFood();
    lastUpdateTime = Date.now();
    renderLoop();
    gameLogicLoop();
}

// Generate random food position
function generateFood() {
    food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
    };
    
    // Make sure food doesn't spawn on snake
    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            generateFood();
            return;
        }
    }
}

// Draw apple food item
function drawApple(x, y) {
    const centerX = x * gridSize + gridSize / 2;
    const centerY = y * gridSize + gridSize / 2;
    const size = gridSize - 4;
    const radius = size * 0.4;
    
    // Apple body (red circle)
    ctx.fillStyle = '#FF3B30';
    ctx.beginPath();
    ctx.arc(centerX, centerY + 1, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Apple highlight (lighter red)
    ctx.fillStyle = '#FF6B60';
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.3, centerY - radius * 0.2, radius * 0.4, 0, 2 * Math.PI);
    ctx.fill();
    
    // Apple stem (brown)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(centerX - 1, centerY - radius - 2, 2, 6);
    
    // Apple leaf (green)
    ctx.fillStyle = '#34C759';
    ctx.beginPath();
    ctx.ellipse(centerX + 3, centerY - radius + 1, 3, 5, Math.PI / 6, 0, 2 * Math.PI);
    ctx.fill();
}

// Initialize smooth movement positions
function initializeSmoothPositions() {
    snakeRenderPositions = [];
    targetPositions = [];
    for (let i = 0; i < snake.length; i++) {
        snakeRenderPositions.push({ x: snake[i].x, y: snake[i].y });
        targetPositions.push({ x: snake[i].x, y: snake[i].y });
    }
}

// Update smooth movement positions
function updateSmoothPositions() {
    const now = Date.now();
    const timeSinceLastMove = now - lastMoveTime;
    moveProgress = Math.min(1, timeSinceLastMove / gameSpeed);
    
    // Interpolate between current and target positions
    for (let i = 0; i < snakeRenderPositions.length; i++) {
        if (i < targetPositions.length) {
            snakeRenderPositions[i].x = snakeRenderPositions[i].x + (targetPositions[i].x - snakeRenderPositions[i].x) * moveProgress;
            snakeRenderPositions[i].y = snakeRenderPositions[i].y + (targetPositions[i].y - snakeRenderPositions[i].y) * moveProgress;
        }
    }
}

// Draw natural snake with smooth interpolation
function drawInterpolatedSnake() {
    if (snakeRenderPositions.length === 0) return;

    // Update smooth positions before drawing
    updateSmoothPositions();

    // Draw snake body as connected segments with tapering
    for (let i = 0; i < snakeRenderPositions.length; i++) {
        const segment = snakeRenderPositions[i];
        const centerX = segment.x * gridSize + gridSize / 2;
        const centerY = segment.y * gridSize + gridSize / 2;

        // Calculate size based on position (tapering effect)
        const maxRadius = (gridSize - 2) / 2;
        const minRadius = maxRadius * 0.3; // Tail will be 30% of head size
        const sizeRatio = (snakeRenderPositions.length - i) / snakeRenderPositions.length;
        const radius = minRadius + (maxRadius - minRadius) * sizeRatio;

        // Set solid blue color for high quality appearance
        ctx.fillStyle = '#4285F4';  // Consistent Google blue for all segments

        // Draw circular segment
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw connection to next segment for smooth appearance
        if (i < snakeRenderPositions.length - 1) {
            const nextSegment = snakeRenderPositions[i + 1];
            const nextCenterX = nextSegment.x * gridSize + gridSize / 2;
            const nextCenterY = nextSegment.y * gridSize + gridSize / 2;

            // Calculate next radius for smooth connection
            const nextSizeRatio = (snakeRenderPositions.length - (i + 1)) / snakeRenderPositions.length;
            const nextRadius = minRadius + (maxRadius - minRadius) * nextSizeRatio;

            // Draw connecting segment
            const angle = Math.atan2(nextCenterY - centerY, nextCenterX - centerX);
            const perpAngle = angle + Math.PI / 2;

            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(perpAngle) * radius, centerY + Math.sin(perpAngle) * radius);
            ctx.lineTo(centerX - Math.cos(perpAngle) * radius, centerY - Math.sin(perpAngle) * radius);
            ctx.lineTo(nextCenterX - Math.cos(perpAngle) * nextRadius, nextCenterY - Math.sin(perpAngle) * nextRadius);
            ctx.lineTo(nextCenterX + Math.cos(perpAngle) * nextRadius, nextCenterY + Math.sin(perpAngle) * nextRadius);
            ctx.closePath();
            ctx.fill();
        }

        // Add highlight to head
        if (i === 0) {
            ctx.strokeStyle = '#1A73E8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - 1, 0, 2 * Math.PI);
            ctx.stroke();

            // Eyes
            const eyeSize = Math.max(2, radius * 0.2);
            const eyeOffset = radius * 0.4;

            ctx.fillStyle = 'white';
            // Left eye
            ctx.beginPath();
            ctx.arc(centerX - eyeOffset, centerY - eyeOffset, eyeSize, 0, 2 * Math.PI);
            ctx.fill();
            // Right eye
            ctx.beginPath();
            ctx.arc(centerX + eyeOffset, centerY - eyeOffset, eyeSize, 0, 2 * Math.PI);
            ctx.fill();

            // Eye pupils
            ctx.fillStyle = 'black';
            const pupilSize = eyeSize * 0.6;
            ctx.beginPath();
            ctx.arc(centerX - eyeOffset, centerY - eyeOffset, pupilSize, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX + eyeOffset, centerY - eyeOffset, pupilSize, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

// Draw chess board background
function drawChessBoard() {
    // Define two alternating greenish colors like Google Snake
    const lightTile = '#AAD751';  // Light green
    const darkTile = '#A2D149';   // Slightly darker green
    
    // Draw chess board pattern
    for (let x = 0; x < tileCount; x++) {
        for (let y = 0; y < tileCount; y++) {
            // Determine tile color based on position (alternating pattern)
            const isLightTile = (x + y) % 2 === 0;
            ctx.fillStyle = isLightTile ? lightTile : darkTile;
            
            // Draw square tile
            ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
    }
}

// Draw game elements
function draw() {
    // Increment animation frame for frog blinking
    animationFrame++;
    
    // Draw chess board background
    drawChessBoard();
    
    // Draw snake with natural appearance
drawInterpolatedSnake();
    
    // Draw apple (food)
    drawApple(food.x, food.y);
}

// Update game state
function update() {
    if (!gameRunning || !gameStarted) return;

    // Only move if there's a direction set
    if (dx === 0 && dy === 0) return;

    // Move snake head
    const head = {x: snake[0].x + dx, y: snake[0].y + dy};

    // Check wall collisions
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }

    // Check self collision
    for (let segment of snake) {
        if (head.x === segment.x && head.y === segment.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // Check food collision
    if (head.x === food.x && head.y === food.y) {
        score += 10 * difficulties[currentDifficulty].scoreMultiplier;
        scoreElement.textContent = score;
        sounds.eat(); // Play eating sound
        generateFood();
    } else {
        snake.pop();
    }

    // Update target positions for smooth movement
    updateTargetPositions();

    // Reset direction change flag after snake has moved
    directionChanged = false;
    lastMoveTime = Date.now();
    moveProgress = 0;
}

// Game over
function gameOver() {
    gameRunning = false;
    // Clear the game loop timeout
    if (gameLoopTimeoutId) {
        clearTimeout(gameLoopTimeoutId);
        gameLoopTimeoutId = null;
    }
    sounds.gameOver();
    gameOverElement.style.display = 'block';
}

// High-framerate render loop (60 FPS)
function renderLoop() {
    draw();
    
    // Show pause indicator
    if (gamePaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.font = '16px Arial';
        ctx.fillText('Press P or Spacebar to resume', canvas.width / 2, canvas.height / 2 + 40);
    }
    
    if (gameRunning) {
        renderLoopId = requestAnimationFrame(renderLoop);
    }
}

// Update target positions for smooth interpolation
function updateTargetPositions() {
    // Handle snake growth (when snake length increases)
    while (targetPositions.length < snake.length) {
        // Instead of pushing {x: 0, y: 0}, use the last segment's position
        const lastPos = targetPositions[targetPositions.length - 1] || snake[snake.length - 1];
        targetPositions.push({ x: lastPos.x, y: lastPos.y });
    }
    
    // Handle snake shrinking (shouldn't happen in normal gameplay)
    while (targetPositions.length > snake.length) {
        targetPositions.pop();
    }
    
    // Handle render positions array
    while (snakeRenderPositions.length < snake.length) {
        // Use the last render position or the corresponding snake segment
        const lastPos = snakeRenderPositions[snakeRenderPositions.length - 1] || snake[snake.length - 1];
        snakeRenderPositions.push({ x: lastPos.x, y: lastPos.y });
    }
    
    while (snakeRenderPositions.length > snake.length) {
        snakeRenderPositions.pop();
    }
    
    // Update target positions to match logical snake positions
    for (let i = 0; i < snake.length; i++) {
        targetPositions[i].x = snake[i].x;
        targetPositions[i].y = snake[i].y;
    }
}

// Game logic update loop (runs at game speed)
function gameLogicLoop() {
    if (!gamePaused && gameRunning) {
        const currentTime = Date.now();
        if (currentTime - lastUpdateTime >= gameSpeed) {
            update();
            lastUpdateTime = currentTime;
        }
    }
    
    if (gameRunning) {
        gameLoopTimeoutId = setTimeout(gameLogicLoop, 16); // Check every ~16ms for smooth timing
    }
}

// Handle touch input for mobile
let initialX = null;
let initialY = null;

function startTouch(e) {
    initialX = e.touches[0].clientX;
    initialY = e.touches[0].clientY;
    e.preventDefault(); // Prevent page scrolling
}

function moveTouch(e) {
    if (initialX === null || initialY === null) {
        e.preventDefault(); // Prevent page scrolling even if we return early
        return;
    }

    let currentX = e.touches[0].clientX;
    let currentY = e.touches[0].clientY;

    let diffX = initialX - currentX;
    let diffY = initialY - currentY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0 && dx !== 1 && !directionChanged) {
            // Unpause if game is paused
            if (gamePaused) {
                gamePaused = false;
                lastUpdateTime = Date.now();
            }
            dx = -1;
            dy = 0;
            gameStarted = true;
            directionChanged = true;
            sounds.move();
        } else if (diffX < 0 && dx !== -1 && !directionChanged) {
            // Unpause if game is paused
            if (gamePaused) {
                gamePaused = false;
                lastUpdateTime = Date.now();
            }
            dx = 1;
            dy = 0;
            gameStarted = true;
            directionChanged = true;
            sounds.move();
        }
    } else {
        if (diffY > 0 && dy !== 1 && !directionChanged) {
            // Unpause if game is paused
            if (gamePaused) {
                gamePaused = false;
                lastUpdateTime = Date.now();
            }
            dx = 0;
            dy = -1;
            gameStarted = true;
            directionChanged = true;
            sounds.move();
        } else if (diffY < 0 && dy !== -1 && !directionChanged) {
            // Unpause if game is paused
            if (gamePaused) {
                gamePaused = false;
                lastUpdateTime = Date.now();
            }
            dx = 0;
            dy = 1;
            gameStarted = true;
            directionChanged = true;
            sounds.move();
        }
    }

    initialX = null;
    initialY = null;
    e.preventDefault(); // Prevent page scrolling
}

// Handle keyboard input
document.addEventListener('keydown', (e) => {
    if (!gameRunning) {
        if (e.code === 'Space') {
            init();
        } else if (e.code === 'Escape') {
            returnToMenu();
        }
        return;
    }
    
    // Prevent snake from reversing into itself and multiple direction changes per frame
    switch(e.code) {
        case 'ArrowUp':
            if (dy !== 1 && !directionChanged) {
                // Unpause if game is paused
                if (gamePaused) {
                    gamePaused = false;
                    lastUpdateTime = Date.now();
                }
                dx = 0;
                dy = -1;
                gameStarted = true;
                directionChanged = true;
            }
            break;
        case 'ArrowDown':
            if (dy !== -1 && !directionChanged) {
                // Unpause if game is paused
                if (gamePaused) {
                    gamePaused = false;
                    lastUpdateTime = Date.now();
                }
                dx = 0;
                dy = 1;
                gameStarted = true;
                directionChanged = true;
            }
            break;
        case 'ArrowLeft':
            if (dx !== 1 && !directionChanged) {
                // Unpause if game is paused
                if (gamePaused) {
                    gamePaused = false;
                    lastUpdateTime = Date.now();
                }
                dx = -1;
                dy = 0;
                gameStarted = true;
                directionChanged = true;
            }
            break;
        case 'ArrowRight':
            if (dx !== -1 && !directionChanged) {
                // Unpause if game is paused
                if (gamePaused) {
                    gamePaused = false;
                    lastUpdateTime = Date.now();
                }
                dx = 1;
                dy = 0;
                gameStarted = true;
                directionChanged = true;
            }
            break;
        case 'KeyP':
            togglePause();
            break;
        case 'KeyM':
            toggleSound();
            break;
        case 'KeyR':
            restartGame();
            break;
        case 'Space':
            e.preventDefault(); // Prevent page scrolling
            togglePause();
            break;
    }
});

// Start game with selected difficulty
function startGame(difficulty) {
    // Initialize elements first
    if (!initializeElements()) {
        console.error('Failed to initialize game elements');
        return;
    }
    
    // Set tile count now that canvas is available
    tileCount = canvas.width / gridSize;
    
    currentDifficulty = difficulty;
    gameSpeed = difficulties[difficulty].speed;
    difficultyElement.textContent = difficulties[difficulty].name;
    
    // Show game screen and hide difficulty selection
    difficultyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    // Only add event listeners if they haven't been added yet
    if (!eventListenersAdded) {
        // Add touch event listeners to canvas with passive: false to allow preventDefault
        canvas.addEventListener('touchstart', startTouch, { passive: false });
        canvas.addEventListener('touchmove', moveTouch, { passive: false });
        
        // Set up control button event listeners
        const restartBtn = document.getElementById('restartToggle');
        const pauseBtn = document.getElementById('pauseToggle');
        const soundBtn = document.getElementById('soundToggle');
        
        if (restartBtn) {
            restartBtn.addEventListener('click', restartGame);
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', togglePause);
        }
        
        if (soundBtn) {
            soundBtn.addEventListener('click', toggleSound);
        }
        
        // Set up virtual D-pad event listeners
        const dpadUp = document.querySelector('.dpad-up');
        const dpadDown = document.querySelector('.dpad-down');
        const dpadLeft = document.querySelector('.dpad-left');
        const dpadRight = document.querySelector('.dpad-right');
        
        if (dpadUp) {
            dpadUp.addEventListener('click', () => {
                if (dy !== 1 && !directionChanged) {
                    // Unpause if game is paused
                    if (gamePaused) {
                        gamePaused = false;
                        lastUpdateTime = Date.now();
                    }
                    dx = 0;
                    dy = -1;
                    gameStarted = true;
                    directionChanged = true;
                    sounds.move();
                }
            });
        }
        
        if (dpadDown) {
            dpadDown.addEventListener('click', () => {
                if (dy !== -1 && !directionChanged) {
                    // Unpause if game is paused
                    if (gamePaused) {
                        gamePaused = false;
                        lastUpdateTime = Date.now();
                    }
                    dx = 0;
                    dy = 1;
                    gameStarted = true;
                    directionChanged = true;
                    sounds.move();
                }
            });
        }
        
        if (dpadLeft) {
            dpadLeft.addEventListener('click', () => {
                if (dx !== 1 && !directionChanged) {
                    // Unpause if game is paused
                    if (gamePaused) {
                        gamePaused = false;
                        lastUpdateTime = Date.now();
                    }
                    dx = -1;
                    dy = 0;
                    gameStarted = true;
                    directionChanged = true;
                    sounds.move();
                }
            });
        }
        
        if (dpadRight) {
            dpadRight.addEventListener('click', () => {
                if (dx !== -1 && !directionChanged) {
                    // Unpause if game is paused
                    if (gamePaused) {
                        gamePaused = false;
                        lastUpdateTime = Date.now();
                    }
                    dx = 1;
                    dy = 0;
                    gameStarted = true;
                    directionChanged = true;
                    sounds.move();
                }
            });
        }
        
        eventListenersAdded = true;
    }
    
    init();
}

// Return to difficulty selection
function returnToMenu() {
    gameScreen.style.display = 'none';
    difficultyScreen.style.display = 'block';
}

// Toggle How to Play content visibility
function toggleHowToPlay() {
    const content = document.getElementById('howToPlayContent');
    const button = document.querySelector('.how-to-play-btn');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.textContent = '📖 Hide Instructions';
        // Smooth scroll to the content
        setTimeout(() => {
            content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        content.style.display = 'none';
        button.textContent = '📖 How to Play';
    }
}
