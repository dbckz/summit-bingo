(async function () {
  const config = await fetch('config.json').then(r => r.json());
  const { gridSize, freeSpaceText, terms } = config;
  const totalCells = gridSize * gridSize;
  const centerIndex = Math.floor(totalCells / 2);

  document.getElementById('title').textContent = config.title;
  document.getElementById('subtitle').textContent = config.subtitle;
  document.title = config.title;

  const board = document.getElementById('bingo-board');
  const winBanner = document.getElementById('win-banner');
  let cells = [];
  let gotBingo = false;
  let gotFullHouse = false;

  // --- Fireworks ---
  const canvas = document.getElementById('fireworks');
  const ctx = canvas.getContext('2d');
  let fireworksActive = false;
  let particles = [];
  let rockets = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const COLORS = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#fda085', '#f6d365', '#a8edea', '#fed6e3',
    '#ff9a9e', '#fecfef', '#ffecd2', '#fcb69f',
  ];

  function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 1;
      this.decay = Math.random() * 0.02 + 0.015;
      this.size = Math.random() * 3 + 1;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.05; // gravity
      this.alpha -= this.decay;
      this.size *= 0.98;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Rocket {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height;
      this.targetY = Math.random() * canvas.height * 0.4 + canvas.height * 0.1;
      this.vy = -(Math.random() * 4 + 6);
      this.color = randomColor();
      this.exploded = false;
      this.trail = [];
    }

    update() {
      if (!this.exploded) {
        this.trail.push({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > 8) this.trail.shift();
        this.y += this.vy;
        this.vy *= 0.98;
        if (this.y <= this.targetY) {
          this.explode();
        }
      }
      this.trail.forEach(t => { t.alpha -= 0.08; });
      this.trail = this.trail.filter(t => t.alpha > 0);
    }

    explode() {
      this.exploded = true;
      const count = 60 + Math.floor(Math.random() * 40);
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(this.x, this.y, this.color));
      }
    }

    draw() {
      this.trail.forEach(t => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.alpha);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    get done() {
      return this.exploded && this.trail.length === 0;
    }
  }

  function fireworksLoop() {
    if (!fireworksActive && particles.length === 0 && rockets.length === 0) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    if (fireworksActive && Math.random() < 0.15) {
      rockets.push(new Rocket());
    }

    rockets.forEach(r => { r.update(); r.draw(); });
    rockets = rockets.filter(r => !r.done);

    particles.forEach(p => { p.update(); p.draw(); });
    particles = particles.filter(p => p.alpha > 0);

    requestAnimationFrame(fireworksLoop);
  }

  function startFireworks() {
    fireworksActive = true;
    fireworksLoop();
  }

  function stopFireworks() {
    fireworksActive = false;
    setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 3000);
  }

  // --- Shuffle & Board ---
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildBoard() {
    gotBingo = false;
    gotFullHouse = false;
    fireworksActive = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    winBanner.classList.remove('show');
    winBanner.classList.add('hidden');
    statusBar.classList.add('hidden');
    board.innerHTML = '';
    cells = [];
    particles = [];
    rockets = [];

    const headers = ['B', 'I', 'N', 'G', 'O'];
    board.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    board.style.gridTemplateRows = `auto repeat(${gridSize}, 1fr)`;

    // Column headers
    headers.forEach(letter => {
      const hdr = document.createElement('div');
      hdr.className = 'cell col-header';
      hdr.textContent = letter;
      board.appendChild(hdr);
    });

    const shuffled = shuffle(terms).slice(0, totalCells - 1);
    let termIdx = 0;

    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      if (i === centerIndex) {
        cell.classList.add('free-space', 'selected');
        cell.innerHTML = `<span>${freeSpaceText}</span><span class="stamp">&#10003;</span>`;
        cell.dataset.selected = 'true';
      } else {
        const term = shuffled[termIdx++];
        cell.innerHTML = `<span>${term}</span><span class="stamp">&#10003;</span>`;
        cell.dataset.selected = 'false';
        cell.addEventListener('click', () => toggleCell(cell, i));
      }

      cells.push(cell);
      board.appendChild(cell);
    }
  }

  function toggleCell(cell, index) {
    if (gotFullHouse) return;
    const isSelected = cell.dataset.selected === 'true';
    cell.dataset.selected = isSelected ? 'false' : 'true';
    cell.classList.toggle('selected');

    if (!isSelected) {
      checkWin();
    }
  }

  function checkWin() {
    const grid = cells.map(c => c.dataset.selected === 'true');

    // Check full house first
    if (grid.every(Boolean)) {
      triggerFullHouse();
      return;
    }

    // Only check for first bingo
    if (gotBingo) return;

    const lines = [];

    // Rows
    for (let r = 0; r < gridSize; r++) {
      const line = [];
      for (let c = 0; c < gridSize; c++) line.push(r * gridSize + c);
      lines.push(line);
    }

    // Columns
    for (let c = 0; c < gridSize; c++) {
      const line = [];
      for (let r = 0; r < gridSize; r++) line.push(r * gridSize + c);
      lines.push(line);
    }

    // Diagonals
    const diag1 = [], diag2 = [];
    for (let i = 0; i < gridSize; i++) {
      diag1.push(i * gridSize + i);
      diag2.push(i * gridSize + (gridSize - 1 - i));
    }
    lines.push(diag1, diag2);

    for (const line of lines) {
      if (line.every(idx => grid[idx])) {
        triggerBingo(line);
        return;
      }
    }
  }

  const statusBar = document.getElementById('status-bar');
  const winSubtext = winBanner.querySelector('.win-subtext');

  function triggerBingo(winningLine) {
    gotBingo = true;
    winningLine.forEach(idx => cells[idx].classList.add('winning'));

    const winText = winBanner.querySelector('.win-text');
    winText.textContent = 'BINGO!';
    winSubtext.textContent = 'Now go for the Full House!';
    winBanner.classList.remove('hidden', 'show');
    void winBanner.offsetWidth;
    winBanner.classList.add('show');
    startFireworks();

    setTimeout(() => {
      stopFireworks();
      winBanner.classList.remove('show');
      statusBar.textContent = 'BINGO! Now go for the Full House!';
      statusBar.classList.remove('hidden');
    }, 4000);
  }

  function triggerFullHouse() {
    gotFullHouse = true;
    statusBar.classList.add('hidden');
    cells.forEach(c => c.classList.add('winning'));
    const winText = winBanner.querySelector('.win-text');
    winText.textContent = 'FULL HOUSE!';
    winSubtext.textContent = '';
    winBanner.classList.remove('hidden', 'show');
    void winBanner.offsetWidth;
    winBanner.classList.add('show');
    startFireworks();
  }

  // --- Controls ---
  document.getElementById('new-card').addEventListener('click', buildBoard);
  document.getElementById('reset').addEventListener('click', () => {
    gotBingo = false;
    gotFullHouse = false;
    stopFireworks();
    winBanner.classList.remove('show');
    winBanner.classList.add('hidden');
    statusBar.classList.add('hidden');
    cells.forEach((cell, i) => {
      cell.classList.remove('winning');
      if (i === centerIndex) return;
      cell.dataset.selected = 'false';
      cell.classList.remove('selected');
    });
  });

  buildBoard();
})();
