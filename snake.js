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
    easy: { speed: 200, scoreMultiplier: 1, name: 'Easy' },
    medium: { speed: 100, scoreMultiplier: 2, name: 'Medium' },
    hard: { speed: 60, scoreMultiplier: 3, name: 'Hard' }
};

let currentDifficulty = 'medium';
let gameSpeed = difficulties.medium.speed;

// Game state
let snake = [
    {x: 10, y: 10}
];
let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let gameRunning = true;
let gameStarted = false;
let gamePaused = false;
let animationFrame = 0; // For frog blinking animation

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
        gameLoop();
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
    // Initialize sound system if not already initialized
    if (!audioContext) {
        initSounds();
    }
    
    snake = [{ x: 10, y: 10 }];
    dx = 0;
    dy = 0;
    score = 0;
    gameRunning = true;
    gameStarted = false;
    gamePaused = false;
    scoreElement.textContent = score;
    gameOverElement.style.display = 'none';
    generateFood();
    gameLoop();
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

// Draw frog with blinking animation
function drawFrog(x, y) {
    const centerX = x * gridSize + gridSize / 2;
    const centerY = y * gridSize + gridSize / 2;
    const size = gridSize - 4;
    
    // Frog body (green ellipse)
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 2, size * 0.4, size * 0.35, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Frog head (darker green circle)
    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 2, size * 0.35, size * 0.3, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Eyes (white circles with black pupils)
    const eyeRadius = size * 0.08;
    const eyeOffset = size * 0.15;
    
    // Left eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(centerX - eyeOffset, centerY - size * 0.15, eyeRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(centerX + eyeOffset, centerY - size * 0.15, eyeRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Blinking animation - hide pupils during blink
    const blinkCycle = 60; // Blink every 60 frames
    const isBlinking = (animationFrame % blinkCycle) < 3; // Blink for 3 frames
    
    if (!isBlinking) {
        // Left pupil
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(centerX - eyeOffset, centerY - size * 0.15, eyeRadius * 0.6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Right pupil
        ctx.beginPath();
        ctx.arc(centerX + eyeOffset, centerY - size * 0.15, eyeRadius * 0.6, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Mouth (small arc)
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY + size * 0.05, size * 0.1, 0, Math.PI);
    ctx.stroke();
    
    // Front legs (small green ovals)
    ctx.fillStyle = '#4CAF50';
    // Left leg
    ctx.beginPath();
    ctx.ellipse(centerX - size * 0.25, centerY + size * 0.2, size * 0.08, size * 0.12, 0, 0, 2 * Math.PI);
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.ellipse(centerX + size * 0.25, centerY + size * 0.2, size * 0.08, size * 0.12, 0, 0, 2 * Math.PI);
    ctx.fill();
}

// Draw game elements
function draw() {
    // Increment animation frame for frog blinking
    animationFrame++;
    
    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw snake
    ctx.fillStyle = 'lime';
    for (let segment of snake) {
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    }
    
    // Draw frog (food)
    drawFrog(food.x, food.y);
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
}

// Game over
function gameOver() {
    gameRunning = false;
    sounds.gameOver(); // Play game over sound
    gameOverElement.style.display = 'block';
}

// Game loop
function gameLoop() {
    if (!gamePaused) {
        update();
    }
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
    
    if (gameRunning && !gamePaused) {
        setTimeout(gameLoop, gameSpeed);
    } else if (gamePaused) {
        // Keep drawing when paused but don't schedule next update
        setTimeout(() => {
            if (gamePaused) gameLoop();
        }, 100);
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
        if (diffX > 0 && dx !== 1) {
            dx = -1;
            dy = 0;
            gameStarted = true;
            sounds.move();
        } else if (diffX < 0 && dx !== -1) {
            dx = 1;
            dy = 0;
            gameStarted = true;
            sounds.move();
        }
    } else {
        if (diffY > 0 && dy !== 1) {
            dx = 0;
            dy = -1;
            gameStarted = true;
            sounds.move();
        } else if (diffY < 0 && dy !== -1) {
            dx = 0;
            dy = 1;
            gameStarted = true;
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
    
    // Prevent snake from reversing into itself
    switch(e.code) {
        case 'ArrowUp':
            if (dy !== 1) {
                dx = 0;
                dy = -1;
                gameStarted = true;
            }
            break;
        case 'ArrowDown':
            if (dy !== -1) {
                dx = 0;
                dy = 1;
                gameStarted = true;
            }
            break;
        case 'ArrowLeft':
            if (dx !== 1) {
                dx = -1;
                dy = 0;
                gameStarted = true;
            }
            break;
        case 'ArrowRight':
            if (dx !== -1) {
                dx = 1;
                dy = 0;
                gameStarted = true;
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
            if (dy !== 1) {
                dx = 0;
                dy = -1;
                gameStarted = true;
                sounds.move();
            }
        });
    }
    
    if (dpadDown) {
        dpadDown.addEventListener('click', () => {
            if (dy !== -1) {
                dx = 0;
                dy = 1;
                gameStarted = true;
                sounds.move();
            }
        });
    }
    
    if (dpadLeft) {
        dpadLeft.addEventListener('click', () => {
            if (dx !== 1) {
                dx = -1;
                dy = 0;
                gameStarted = true;
                sounds.move();
            }
        });
    }
    
    if (dpadRight) {
        dpadRight.addEventListener('click', () => {
            if (dx !== -1) {
                dx = 1;
                dy = 0;
                gameStarted = true;
                sounds.move();
            }
        });
    }
    
    init();
}

// Return to difficulty selection
function returnToMenu() {
    gameScreen.style.display = 'none';
    difficultyScreen.style.display = 'block';
}
