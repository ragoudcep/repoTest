const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const FACES = ["cerise", "cloche", "prune", "citron", "orange", "BAR"];
const FRUITS = ["cerise", "cloche", "prune", "citron", "orange"];
const MAX_BONUS = 5;

let gameState = null;

function createNewGame() {
  return {
    round: 1,
    maxRounds: 12,
    dicePool: [],
    bowlRemaining: 9,
    grid: {
      cerise: Array(6).fill(null),
      cloche: Array(6).fill(null),
      prune: Array(6).fill(null),
      citron: Array(6).fill(null),
      orange: Array(6).fill(null),
    },
    malus: [],
    finished: false,
    barCount: 0,
    bonusRemaining: MAX_BONUS,
  };
}

function rollDie(ignoreBAR = false) {
  let face;
  do {
    face = FACES[Math.floor(Math.random() * FACES.length)];
  } while (ignoreBAR && face === "BAR");
  return face;
}

// --- Nouvelle partie ---
app.post("/api/start", (req, res) => {
  gameState = createNewGame();
  res.json(gameState);
});

// --- Placer premier dé ---
app.post("/api/place-first", (req, res) => {
  if (!gameState || gameState.finished)
    return res.status(400).json({ error: "Game inactive" });

  const { fruit } = req.body;
  if (!FRUITS.includes(fruit))
    return res.status(400).json({ error: "Fruit invalide" });

  gameState.dicePool.push(fruit);
  gameState.bowlRemaining--;
  res.json(gameState);
});

// --- Lancer un dé normal ---
app.post("/api/roll", (req, res) => {
  if (!gameState || gameState.finished)
    return res.status(400).json({ error: "Game inactive" });

  if (gameState.bowlRemaining <= 0)
    return res.status(400).json({ error: "No dice remaining" });

  const die = rollDie();
  gameState.bowlRemaining--;

  if (die === "BAR") {
    // compter les BAR dans la manche
    gameState.dicePool.push("BAR");
    gameState.barCount = (gameState.barCount || 0) + 1;

    // n'interrompt la manche qu'à 2 BAR cumulés
    if (gameState.barCount >= 2) {
      gameState.malus.push(gameState.round);

      // Manche terminée
      gameState.dicePool = [];
      gameState.bowlRemaining = 9;
      gameState.round++;
      gameState.barCount = 0;
      if (gameState.round > gameState.maxRounds) gameState.finished = true;
    }

    return res.json(gameState);
  }

  // Dé normal
  gameState.dicePool.push(die);

  // Fin automatique si saladier vide
  if (gameState.bowlRemaining === 0) {
    gameState.dicePool = [];
    gameState.bowlRemaining = 9;
    gameState.barCount = 0;
    gameState.round++;
    if (gameState.round > gameState.maxRounds) gameState.finished = true;
  }

  res.json(gameState);
});

// --- Sortir de la manche ---
app.post("/api/exit", (req, res) => {
  if (!gameState || gameState.finished)
    return res.status(400).json({ error: "Game inactive" });

  const { fruit } = req.body;
  if (!FRUITS.includes(fruit))
    return res.status(400).json({ error: "Fruit invalide" });

  const diceCount = gameState.dicePool.filter(d => d === fruit).length;

  // Si au moins un dé de ce fruit -> inscrire la valeur
  if (diceCount > 0) {
    const lineIndex = diceCount - 1; // 0 = première ligne, 1 = deuxième, ...
    const multiplier = lineIndex + 1; // deuxième ligne x2, troisième x3, etc.
    const valueToAdd = gameState.round * multiplier;
    gameState.grid[fruit][lineIndex] = valueToAdd;
  }

  // Reset pour manche suivante
  gameState.dicePool = [];
  gameState.bowlRemaining = 9;
  gameState.barCount = 0;
  gameState.round++;
  if (gameState.round > gameState.maxRounds) gameState.finished = true;

  res.json(gameState);
});

// --- Bonus ---
app.post("/api/use-bonus", (req, res) => {
  if (!gameState || gameState.finished)
    return res.status(400).json({ error: "Game inactive" });

  if (gameState.bonusRemaining <= 0)
    return res.status(400).json({ error: "No bonus remaining" });

  // Lancer 2 dés en ignorant BAR pour placement
  const die1 = rollDie(true);
  const die2 = rollDie(true);

  gameState.bonusRemaining--;

  // Cas spécial : si les deux dés sont BAR (on ne les place pas)
  if (die1 === "BAR" && die2 === "BAR") {
    return res.json({ dice: [], message: "2 BAR tirés, aucun placement" });
  }

  res.json({ dice: [die1, die2] });
});

app.post("/api/choose-bonus", (req, res) => {
  if (!gameState || gameState.finished)
    return res.status(400).json({ error: "Game inactive" });

  const { chosen } = req.body;
  if (!FRUITS.includes(chosen))
    return res.status(400).json({ error: "Fruit invalide" });

  gameState.dicePool.push(chosen);
  gameState.bowlRemaining--;

  res.json(gameState);
});

// --- État du jeu ---
app.get("/api/state", (req, res) => res.json(gameState));

// --- Score final ---
app.get("/api/score", (req, res) => {
  if (!gameState) return res.json({ score: 0 });
  // Addition simple des cases remplies
  let positive = 0;
  FRUITS.forEach(fruit => {
    const col = gameState.grid[fruit].filter(v => v !== null);
    const sum = col.reduce((a, b) => a + b, 0);
    positive += sum;
  });

  // Les malus sont soustraits par somme (pas produit)
  const negative = gameState.malus.length > 0 ? gameState.malus.reduce((a, b) => a + b, 0) : 0;

  const score = positive - negative;
  res.json({ score });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
