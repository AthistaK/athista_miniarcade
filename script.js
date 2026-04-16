// Mini Arcade: shared app state and helpers
const homeView = document.getElementById("homeView");
const gameView = document.getElementById("gameView");
const gameTitle = document.getElementById("gameTitle");
const gameInstructions = document.getElementById("gameInstructions");
const gameScore = document.getElementById("gameScore");
const gameHighScore = document.getElementById("gameHighScore");
const gameContainer = document.getElementById("gameContainer");
const restartBtn = document.getElementById("restartBtn");
const backBtn = document.getElementById("backBtn");
const leaderboardList = document.getElementById("leaderboardList");

const darkModeBtn = document.getElementById("darkModeBtn");
const musicBtn = document.getElementById("musicBtn");
const sfxBtn = document.getElementById("sfxBtn");

let activeGame = null;
let cleanupGame = null;
let sfxEnabled = true;
let musicEnabled = false;
let audioCtx = null;
let musicNodes = [];

const highscores = loadHighScores();

function loadHighScores() {
  const defaults = {
    tictactoe: 0,
    snake: 0,
    rps: 0,
    memory: 999,
    clicktest: 0
  };
  try {
    const parsed = JSON.parse(localStorage.getItem("miniArcadeHighScores") || "{}");
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function saveHighScores() {
  localStorage.setItem("miniArcadeHighScores", JSON.stringify(highscores));
  renderLeaderboard();
}

function renderLeaderboard() {
  leaderboardList.innerHTML = "";
  const items = [
    ["Tic Tac Toe (best wins)", highscores.tictactoe],
    ["Snake (best score)", highscores.snake],
    ["RPS (best streak)", highscores.rps],
    ["Memory (best moves)", highscores.memory === 999 ? "--" : highscores.memory],
    ["Click Test (best clicks)", highscores.clicktest]
  ];

  items.forEach(([name, value]) => {
    const li = document.createElement("li");
    li.textContent = `${name}: ${value}`;
    leaderboardList.appendChild(li);
  });
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playSfx(type = "click") {
  if (!sfxEnabled) return;
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const tones = {
    click: 420,
    success: 640,
    fail: 200,
    pop: 780
  };

  osc.frequency.value = tones[type] || 420;
  osc.type = "triangle";
  gain.gain.value = 0.0001;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  osc.start(now);
  osc.stop(now + 0.15);
}

function stopMusic() {
  musicNodes.forEach((node) => {
    try { node.stop(); } catch {}
    try { node.disconnect(); } catch {}
  });
  musicNodes = [];
}

function startMusic() {
  ensureAudio();
  stopMusic();

  const freqs = [261.63, 329.63, 392.0];
  freqs.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.015;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * 0.08);
    musicNodes.push(osc);
  });
}

function switchView(showGame) {
  homeView.classList.toggle("active", !showGame);
  gameView.classList.toggle("active", showGame);
}

function setScore(score, highScore, label = "Score") {
  gameScore.textContent = `${label}: ${score}`;
  gameHighScore.textContent = `High Score: ${highScore}`;
}

function openGame(gameKey) {
  if (cleanupGame) cleanupGame();
  activeGame = gameKey;
  switchView(true);

  const config = gameDefinitions[gameKey];
  gameTitle.textContent = config.title;
  gameInstructions.textContent = config.instructions;

  gameContainer.innerHTML = "";
  cleanupGame = config.init();
}

function closeGame() {
  if (cleanupGame) cleanupGame();
  cleanupGame = null;
  activeGame = null;
  switchView(false);
  renderLeaderboard();
}

function restartActiveGame() {
  if (!activeGame) return;
  playSfx("click");
  openGame(activeGame);
}

// Game 1: Tic Tac Toe (2 player)
function initTicTacToe() {
  const wrap = document.createElement("div");
  wrap.innerHTML = '<p class="small-note" id="tttStatus"></p><div class="grid-ttt" id="tttGrid"></div>';
  gameContainer.appendChild(wrap);

  const status = document.getElementById("tttStatus");
  const grid = document.getElementById("tttGrid");

  let board = Array(9).fill("");
  let player = "X";
  let finished = false;
  let winsX = 0;
  let winsO = 0;
  let draws = 0;

  function updateBoardUI() {
    grid.innerHTML = "";
    board.forEach((val, idx) => {
      const btn = document.createElement("button");
      btn.className = "ttt-cell";
      btn.textContent = val;
      btn.addEventListener("click", () => move(idx));
      grid.appendChild(btn);
    });
  }

  function evaluateWinner() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
    }
    return null;
  }

  function roundReset() {
    board = Array(9).fill("");
    finished = false;
    player = "X";
    status.textContent = `New round. Turn: ${player}. X wins: ${winsX}, O wins: ${winsO}, Draws: ${draws}`;
    updateBoardUI();
  }

  function move(index) {
    if (finished || board[index]) return;
    board[index] = player;
    playSfx("click");

    const winner = evaluateWinner();
    if (winner) {
      finished = true;
      if (winner === "X") winsX += 1;
      if (winner === "O") winsO += 1;
      const best = Math.max(winsX, winsO);
      if (best > highscores.tictactoe) {
        highscores.tictactoe = best;
        saveHighScores();
      }
      setScore(`${winsX}-${winsO}`, highscores.tictactoe, "Session (X-O)");
      status.textContent = `${winner} wins this round. Tap restart for a fresh match.`;
      playSfx("success");
      updateBoardUI();
      return;
    }

    if (!board.includes("")) {
      finished = true;
      draws += 1;
      status.textContent = `Draw round. Tap restart for a fresh match.`;
      playSfx("fail");
      updateBoardUI();
      return;
    }

    player = player === "X" ? "O" : "X";
    status.textContent = `Turn: ${player}. X wins: ${winsX}, O wins: ${winsO}, Draws: ${draws}`;
    updateBoardUI();
  }

  setScore("0-0", highscores.tictactoe, "Session (X-O)");
  roundReset();

  return () => {
    board = [];
  };
}

// Game 2: Snake game
function initSnake() {
  const canvas = document.createElement("canvas");
  canvas.id = "snakeCanvas";
  canvas.width = 320;
  canvas.height = 320;
  gameContainer.appendChild(canvas);

  const note = document.createElement("p");
  note.className = "small-note";
  note.textContent = "Use arrow keys or WASD to move.";
  gameContainer.appendChild(note);

  const ctx = canvas.getContext("2d");
  const size = 16;
  const tiles = 20;

  let snake = [{ x: 8, y: 8 }];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 5, y: 5 };
  let score = 0;
  let intervalId = null;
  let ended = false;

  function placeFood() {
    let valid = false;
    while (!valid) {
      food.x = Math.floor(Math.random() * tiles);
      food.y = Math.floor(Math.random() * tiles);
      valid = !snake.some((s) => s.x === food.x && s.y === food.y);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(15,23,42,0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(food.x * size, food.y * size, size - 1, size - 1);

    ctx.fillStyle = "#22c55e";
    snake.forEach((part) => {
      ctx.fillRect(part.x * size, part.y * size, size - 1, size - 1);
    });
  }

  function tick() {
    if (ended) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.x >= tiles || head.y < 0 || head.y >= tiles;
    const hitSelf = snake.some((p) => p.x === head.x && p.y === head.y);

    if (hitWall || hitSelf) {
      ended = true;
      clearInterval(intervalId);
      playSfx("fail");
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      playSfx("pop");
      if (score > highscores.snake) {
        highscores.snake = score;
        saveHighScores();
      }
      placeFood();
    } else {
      snake.pop();
    }

    setScore(score, highscores.snake);
    draw();
  }

  function onKey(e) {
    const key = e.key.toLowerCase();
    if ((key === "arrowup" || key === "w") && dir.y !== 1) nextDir = { x: 0, y: -1 };
    if ((key === "arrowdown" || key === "s") && dir.y !== -1) nextDir = { x: 0, y: 1 };
    if ((key === "arrowleft" || key === "a") && dir.x !== 1) nextDir = { x: -1, y: 0 };
    if ((key === "arrowright" || key === "d") && dir.x !== -1) nextDir = { x: 1, y: 0 };
  }

  setScore(0, highscores.snake);
  draw();
  intervalId = setInterval(tick, 120);
  document.addEventListener("keydown", onKey);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener("keydown", onKey);
  };
}

// Game 3: Rock Paper Scissors
function initRPS() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="rps-buttons">
      <button data-pick="rock">Rock</button>
      <button data-pick="paper">Paper</button>
      <button data-pick="scissors">Scissors</button>
    </div>
    <p class="small-note" id="rpsStatus">Choose your move.</p>
  `;
  gameContainer.appendChild(wrap);

  const status = document.getElementById("rpsStatus");
  const choices = ["rock", "paper", "scissors"];
  let streak = 0;

  function result(me, cpu) {
    if (me === cpu) return 0;
    if ((me === "rock" && cpu === "scissors") || (me === "paper" && cpu === "rock") || (me === "scissors" && cpu === "paper")) {
      return 1;
    }
    return -1;
  }

  wrap.querySelectorAll("button[data-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const me = btn.dataset.pick;
      const cpu = choices[Math.floor(Math.random() * choices.length)];
      const r = result(me, cpu);

      if (r === 1) {
        streak += 1;
        status.textContent = `You picked ${me}, CPU picked ${cpu}. You win this round.`;
        playSfx("success");
      } else if (r === -1) {
        streak = 0;
        status.textContent = `You picked ${me}, CPU picked ${cpu}. You lose this round.`;
        playSfx("fail");
      } else {
        status.textContent = `Both picked ${me}. It's a draw.`;
        playSfx("click");
      }

      if (streak > highscores.rps) {
        highscores.rps = streak;
        saveHighScores();
      }

      setScore(streak, highscores.rps, "Win Streak");
    });
  });

  setScore(0, highscores.rps, "Win Streak");
  return () => {};
}

// Game 4: Memory card matching
function initMemory() {
  const wrap = document.createElement("div");
  wrap.innerHTML = '<p class="small-note" id="memoryStatus">Find all matching pairs.</p><div class="memory-grid" id="memoryGrid"></div>';
  gameContainer.appendChild(wrap);

  const status = document.getElementById("memoryStatus");
  const grid = document.getElementById("memoryGrid");

  const symbols = ["A", "B", "C", "D", "E", "F"];
  const deck = [...symbols, ...symbols]
    .map((val, idx) => ({ id: idx, val }))
    .sort(() => Math.random() - 0.5);

  let opened = [];
  let matched = 0;
  let moves = 0;
  let lock = false;

  function render() {
    grid.innerHTML = "";
    deck.forEach((card) => {
      const btn = document.createElement("button");
      btn.className = "memory-card";
      const isOpen = opened.includes(card.id);
      const isMatched = card.matched;
      btn.classList.toggle("revealed", isOpen);
      btn.classList.toggle("matched", !!isMatched);
      btn.textContent = isOpen || isMatched ? card.val : "?";
      btn.disabled = isOpen || isMatched || lock;
      btn.addEventListener("click", () => flip(card.id));
      grid.appendChild(btn);
    });
  }

  function flip(id) {
    if (lock) return;
    opened.push(id);
    playSfx("click");
    render();

    if (opened.length === 2) {
      lock = true;
      moves += 1;
      const [a, b] = opened.map((oid) => deck.find((c) => c.id === oid));

      if (a.val === b.val) {
        a.matched = true;
        b.matched = true;
        matched += 1;
        opened = [];
        lock = false;
        playSfx("success");
      } else {
        playSfx("fail");
        setTimeout(() => {
          opened = [];
          lock = false;
          render();
        }, 600);
      }

      setScore(moves, highscores.memory === 999 ? "--" : highscores.memory, "Moves");
      if (matched === symbols.length) {
        status.textContent = `Completed in ${moves} moves!`;
        if (moves < highscores.memory) {
          highscores.memory = moves;
          saveHighScores();
        }
      }

      render();
    }
  }

  setScore(0, highscores.memory === 999 ? "--" : highscores.memory, "Moves");
  render();

  return () => {
    lock = true;
  };
}

// Game 5: Click speed test
function initClickTest() {
  const wrap = document.createElement("div");
  wrap.className = "click-area";
  wrap.innerHTML = `
    <button id="clickStartBtn">Start 5-Second Test</button>
    <div class="click-target" id="clickTarget">Press start</div>
    <p class="small-note" id="clickTimer">Time Left: 5.0s</p>
  `;
  gameContainer.appendChild(wrap);

  const startBtn = document.getElementById("clickStartBtn");
  const target = document.getElementById("clickTarget");
  const timerText = document.getElementById("clickTimer");

  let count = 0;
  let running = false;
  let startTime = 0;
  let timerId = null;

  function endTest() {
    running = false;
    clearInterval(timerId);
    target.textContent = `Done! Clicks: ${count}`;
    playSfx("success");

    if (count > highscores.clicktest) {
      highscores.clicktest = count;
      saveHighScores();
    }
    setScore(count, highscores.clicktest, "Clicks");
  }

  function tick() {
    const elapsed = (Date.now() - startTime) / 1000;
    const left = Math.max(0, 5 - elapsed);
    timerText.textContent = `Time Left: ${left.toFixed(1)}s`;
    if (left <= 0) endTest();
  }

  startBtn.addEventListener("click", () => {
    playSfx("click");
    count = 0;
    running = true;
    startTime = Date.now();
    target.textContent = "Click here rapidly!";
    setScore(0, highscores.clicktest, "Clicks");
    clearInterval(timerId);
    timerId = setInterval(tick, 50);
  });

  target.addEventListener("click", () => {
    if (!running) return;
    count += 1;
    target.textContent = `Clicks: ${count}`;
    playSfx("pop");
  });

  setScore(0, highscores.clicktest, "Clicks");

  return () => {
    clearInterval(timerId);
  };
}

const gameDefinitions = {
  tictactoe: {
    title: "Tic Tac Toe",
    instructions: "2 players on one screen. Take turns as X and O. First with 3 in a row wins.",
    init: initTicTacToe
  },
  snake: {
    title: "Snake",
    instructions: "Move with Arrow keys or WASD. Eat red food, avoid walls and your own tail.",
    init: initSnake
  },
  rps: {
    title: "Rock Paper Scissors",
    instructions: "Pick a move each round. Track your best win streak against the computer.",
    init: initRPS
  },
  memory: {
    title: "Memory Match",
    instructions: "Flip cards and remember positions. Match all pairs in as few moves as possible.",
    init: initMemory
  },
  clicktest: {
    title: "Click Speed Test",
    instructions: "Start the timer, then click inside the target area as fast as possible for 5 seconds.",
    init: initClickTest
  }
};

// Menu and controls wiring
document.querySelectorAll(".game-card").forEach((card) => {
  card.querySelector("button").addEventListener("click", () => {
    playSfx("click");
    openGame(card.dataset.game);
  });
});

backBtn.addEventListener("click", () => {
  playSfx("click");
  closeGame();
});

restartBtn.addEventListener("click", restartActiveGame);

darkModeBtn.addEventListener("click", () => {
  const next = !document.body.classList.contains("dark");
  document.body.classList.toggle("dark", next);
  darkModeBtn.textContent = next ? "Light Mode" : "Dark Mode";
  darkModeBtn.setAttribute("aria-pressed", String(next));
  localStorage.setItem("miniArcadeDarkMode", String(next));
  playSfx("click");
});

musicBtn.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    startMusic();
    musicBtn.textContent = "Music On";
  } else {
    stopMusic();
    musicBtn.textContent = "Music Off";
  }
  musicBtn.setAttribute("aria-pressed", String(musicEnabled));
  playSfx("click");
});

sfxBtn.addEventListener("click", () => {
  sfxEnabled = !sfxEnabled;
  sfxBtn.textContent = sfxEnabled ? "SFX On" : "SFX Off";
  sfxBtn.setAttribute("aria-pressed", String(sfxEnabled));
  if (sfxEnabled) playSfx("click");
});

(function boot() {
  const darkStored = localStorage.getItem("miniArcadeDarkMode") === "true";
  document.body.classList.toggle("dark", darkStored);
  darkModeBtn.textContent = darkStored ? "Light Mode" : "Dark Mode";
  darkModeBtn.setAttribute("aria-pressed", String(darkStored));

  renderLeaderboard();
  switchView(false);
})();