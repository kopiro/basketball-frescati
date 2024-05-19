// Roles:
// - C: Center
// - PG: Point Guard
// - SG: Shooting Guard
// - SF: Small Forward
// - PF: Power Forward
const roles = ["C", "PG", "SG", "SF", "PF"];

// - Overall: the overall quality of the player
// - Inside scoring: how good the player is at scoring inside the paint
// - Outside scoring: how good the player is at scoring from outside the paint
// - Playmaking: how good the player is at creating opportunities for his teammates and dribbling
// - Rebounding: how good the player is at getting rebounds
// - Defense: how good the player is at defending
// - Athleticism: how good the player is at running and jumping
// - Height: how tall the player is
const stats = [
  "overall",
  "inside",
  "outside",
  "playmaking",
  "athleticism",
  "defending",
  "rebounding",
];

async function downloadPlayers(key, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${key}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
  const response = await fetch(url);
  const csvData = await response.text();

  // Parse CSV data
  const csvRows = csvData.split("\n");
  const headers = csvRows[0].split(",");
  const data = csvRows.slice(1).map((row) => {
    const values = row.split(",");
    return headers.reduce((obj, header, index) => {
      header = header.replace(/"/g, "").trim().toLowerCase();
      obj[header] = values[index].replace(/"/g, "").trim();
      return obj;
    }, {});
  });

  data.forEach((row) => {
    let score = 0;
    stats.forEach((stat) => {
      row[stat] = parseInt(row[stat]);
      score += row[stat];
    });
    row.score = score;
  });

  return data;
}

function filterPlayers(allPlayers, availablePlayers) {
  // Filter the players that are in the available players list
  const players = allPlayers.filter((row) =>
    availablePlayers.includes(row.name)
  );

  return players;
}

function showError(error) {
  const errorElement = document.getElementById("error");
  errorElement.innerText = error;
  throw error;
}

function showWarning(warning) {
  const warningElement = document.getElementById("warning");
  // Add a node
  var node = document.createElement("div");
  node.innerText = warning;
  warningElement.appendChild(node);
}

// Function to balance teams
function createTeams(players, numTeams, teamSize) {
  // Initialize teams
  const teams = Array.from({ length: numTeams }, () => []);

  // Split players by role
  const centers = players.filter((player) => player.role === "C");
  const pointGuards = players.filter((player) => player.role === "PG");
  const others = players.filter(
    (player) => player.role !== "C" && player.role !== "PG"
  );

  // Sort players by score (from lowest to highest)
  centers.sort((a, b) => b.score - a.score);
  pointGuards.sort((a, b) => b.score - a.score);

  // Distribute Centers and Point Guards
  for (let i = 0; i < numTeams; i++) {
    if (centers.length > 0) {
      teams[i].push(centers.pop());
    }
    if (pointGuards.length > 0) {
      teams[i].push(pointGuards.pop());
    }
  }

  // Distribute the rest of the players
  // Add unused centers and point guards to the others list
  centers.forEach((center) => others.push(center));
  pointGuards.forEach((pg) => others.push(pg));

  // Sort
  others.sort((a, b) => b.score - a.score);

  let i = 0;
  while (teams.some((team) => team.length < teamSize) && others.length > 0) {
    if (teams[i % numTeams].length < teamSize) {
      teams[i % numTeams].push(others.shift());
    }
    i++;
  }

  // Show warning for all players that were not included in the teams
  if (others.length > 0) {
    showWarning(
      `The following players were not included in the teams: ${others
        .map((player) => player.name)
        .join(", ")}`
    );
  }

  // Ensure all teams have 5 players
  teams.forEach((team) => {
    if (team.length < teamSize) {
      showError("Not enough players to complete the teams");
    }
  });

  // Balance teams based on overall stats
  balanceTeams(teams);

  return teams;
}

function balanceTeams(teams) {
  let balanced = false;
  let balanceThreshold = 5;
  let maxAttempts = 100; // Prevent infinite loop
  let attempts = 0;

  while (!balanced && attempts < maxAttempts) {
    const teamStats = teams.map((team) =>
      team.reduce((acc, player) => acc + player.score, 0)
    );

    let maxIndex = teamStats.indexOf(Math.max(...teamStats));
    let minIndex = teamStats.indexOf(Math.min(...teamStats));

    if (teamStats[maxIndex] - teamStats[minIndex] <= balanceThreshold) {
      balanced = true;
    } else {
      // Swap the player with the highest score from the strongest team
      // with the player with the lowest score from the weakest team
      let maxPlayerIndex = teams[maxIndex].reduce(
        (maxIdx, player, idx, arr) =>
          player.score > arr[maxIdx].score ? idx : maxIdx,
        0
      );
      let minPlayerIndex = teams[minIndex].reduce(
        (minIdx, player, idx, arr) =>
          player.score < arr[minIdx].score ? idx : minIdx,
        0
      );

      let temp = teams[maxIndex][maxPlayerIndex];
      teams[maxIndex][maxPlayerIndex] = teams[minIndex][minPlayerIndex];
      teams[minIndex][minPlayerIndex] = temp;

      attempts++;
    }

    // Increase balanceThreshold if the loop is taking too long
    if (attempts % 10 === 0) {
      balanceThreshold += 5;
      showWarning(`Increasing balance threshold: ${balanceThreshold}`);
    }
  }

  if (attempts >= maxAttempts) {
    showWarning(
      `Teams could not be balanced within ${maxAttempts} attempts. Last threshold: ${balanceThreshold}`
    );
  }
}

function parseAvailablePlayers(allPlayers) {
  const playersLines = document
    .getElementById("available-players")
    .value.split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) =>
      line.replace(/\d+\s*[.)]*/, "").replace(/[^a-zA-Z0-9]/g, "")
    );

  return playersLines.map((playerName) => {
    const player = allPlayers.find((player) => {
      return player.name.toLowerCase() === playerName.toLowerCase();
    });
    if (!player) {
      showError(`Player "${playerName}" not found`);
    }
    return player;
  });
}

const key = "1ay3hN5dqq6umyvu8v5Zi1ppQ3MV8J_x4G8kiCGpzfD0";
const sheetName = "Players";

async function onButtonClick() {
  // Clear error and warning messages
  const errorElement = document.getElementById("error");
  errorElement.innerText = "";
  const warningElement = document.getElementById("warning");
  warningElement.innerHTML = "";

  const teamSize = parseInt(document.querySelector("#team-size").value);
  const allPlayers = await downloadPlayers(key, sheetName);

  console.log("allPlayers :>> ", allPlayers);

  const players = parseAvailablePlayers(allPlayers);
  const numTeams = Math.floor(players.length / teamSize);

  const teams = createTeams(players, numTeams, teamSize);

  // Display the teams in the HTML
  const teamsContainer = document.getElementById("teams-container");
  teamsContainer.innerHTML = "";
  teams.forEach((team, index) => {
    const teamElement = document.createElement("div");
    teamElement.classList.add("team");
    teamElement.innerHTML = `<h2>Team ${index + 1}</h2>`;
    team.forEach((player) => {
      const playerElement = document.createElement("div");
      playerElement.classList.add("player");
      playerElement.innerHTML = `<strong>${player.name}</strong> (${player.role})`;
      teamElement.appendChild(playerElement);
    });
    const scoreElement = document.createElement("div");
    scoreElement.classList.add("score");
    const score = team.reduce((acc, player) => acc + player.score, 0);
    scoreElement.innerHTML = `Total score: ${score}`;
    teamElement.appendChild(scoreElement);
    teamsContainer.appendChild(teamElement);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("create-teams");
  button.addEventListener("click", onButtonClick);
});
