const fruits = ["cerise", "cloche", "prune", "citron", "orange"];

const roundEl = document.getElementById("round");
const bowlEl = document.getElementById("bowl");
const dicePoolEl = document.getElementById("dicePool");
const gridEl = document.getElementById("grid");
const malusEl = document.getElementById("malus");
const scoreEl = document.getElementById("score");
const fruitSelect = document.getElementById("fruitSelect");
const bonusRemainingEl = document.getElementById("bonusRemaining");

// remplir selects
fruits.forEach(f => {
  const option1 = document.createElement("option");
  option1.value = f;
  option1.textContent = f;
  fruitSelect.appendChild(option1);
});

function createCell(content, extraClass = "") {
  const div = document.createElement("div");
  div.className = "cell " + extraClass;
  div.textContent = content;
  return div;
}

async function fetchState() {
  const res = await fetch("/api/state");
  return res.json();
}

async function refreshState() {
  const state = await fetchState();
  if (!state) return;

  // manche et saladier
  roundEl.textContent = state.round <= state.maxRounds ? state.round : state.maxRounds;
  bowlEl.textContent = state.bowlRemaining;

  // dés en jeu
  dicePoolEl.innerHTML = "";
  state.dicePool.forEach(d => {
    const div = createCell(d, "die " + (d === "BAR" ? "BAR" : d));
    dicePoolEl.appendChild(div);
  });

  // grille
  gridEl.innerHTML = "";
  gridEl.appendChild(createCell("", "header")); // coin vide
  fruits.forEach(f => gridEl.appendChild(createCell(f, "header")));
  for (let i = 0; i < 6; i++) {
    gridEl.appendChild(createCell(i + 1, "header"));
    fruits.forEach(f => {
      gridEl.appendChild(createCell(state.grid[f][i] ?? ""));
    });
  }

  // malus
  malusEl.textContent = state.malus.join(" × ");

  // score
  if (state.finished) {
    const scoreRes = await fetch("/api/score");
    const scoreData = await scoreRes.json();
    scoreEl.textContent = scoreData.score;
  } else {
    scoreEl.textContent = "";
  }

  // bonus restants
  bonusRemainingEl.textContent = state.bonusRemaining;
}

// --- boutons ---

// Le mécanisme du premier dé a été retiré : on commence direct par un lancer

// nouvelle partie
document.getElementById("startBtn").onclick = async () => {
  await fetch("/api/start", { method: "POST" });
  refreshState();
};

// lancer dé classique
document.getElementById("rollBtn").onclick = async () => {
  await fetch("/api/roll", { method: "POST" });
  refreshState();
};

// sortir de la manche
document.getElementById("exitBtn").onclick = async () => {
  const fruit = fruitSelect.value;
  await fetch("/api/exit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fruit })
  });
  refreshState();
};

// utiliser bonus
document.getElementById("bonusBtn").onclick = async () => {
  const res = await fetch("/api/use-bonus", { method: "POST" });
  const data = await res.json();

  if (!data.dice || data.dice.length === 0) {
    alert(data.message || "Aucun dé disponible pour ce bonus");
    refreshState();
    return;
  }

  const chosen = prompt(`Choisissez un dé à placer : ${data.dice.join(", ")}`);
  if (!chosen || !fruits.includes(chosen)) return;

  await fetch("/api/choose-bonus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chosen })
  });

  refreshState();
};

refreshState();
