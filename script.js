// Roles:
// - C: Center
// - PG: Point Guard
// - SG: Shooting Guard
// - SF: Small Forward
// - PF: Power Forward
const roles = ["PG", "SG", "SF", "PF", "C"];

// - Overall: the overall quality of the player
// - Inside scoring: how good the player is at scoring inside the paint
// - Outside scoring: how good the player is at scoring from outside the paint
// - Playmaking: how good the player is at creating opportunities for his teammates and dribbling
// - Rebounding: how good the player is at getting rebounds
// - Defense: how good the player is at defending
// - Athleticism: how good the player is at running and jumping
// - Height: how tall the player is
const stats = [
  "Overall",
  "Inside",
  "Outside",
  "Playmaking",
  "Athleticism",
  "Defending",
  "Rebounding",
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
      header = header.replace(/"/g, "").trim();
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
    availablePlayers.includes(row.Name)
  );

  return players;
}

function showLog(message, level) {
  const node = document.createElement("div");
  node.classList.add(level);
  node.innerText = message;
  document.getElementById("console").appendChild(node);
  if (level === "error") {
    throw new Error(message);
  }
}

// Loop through all combinations of orders of roles, and find the one the minimizes the score difference
// But also maximize the score of the team

function createTeams(players, numTeams) {
  // Initialize teams
  const teams = Array.from({ length: numTeams }, () => {
    return roles.reduce((acc, role) => {
      acc[role] = null;
      return acc;
    }, {});
  });

  const byRoles = roles.reduce((acc, role) => {
    acc[role] = [
      ...players
        .filter((player) => player.Role === role)
        .map((player) => ({
          ...player,
          assignedRole: role,
          scoreByRole: player.score,
          penalty: 1,
        }))
        .sort((a, b) => b.scoreByRole - a.scoreByRole),
      ...players
        .filter((player) => player.SecondaryRole === role)
        .map((player) => ({
          ...player,
          assignedRole: role,
          scoreByRole: player.score * 0.9,
          penalty: 0.9,
        }))
        .sort((a, b) => b.scoreByRole - a.scoreByRole),
      ...players
        .filter((player) => player.TertiaryRole === role)
        .map((player) => ({
          ...player,
          assignedRole: role,
          scoreByRole: player.score * 0.6,
          penalty: 0.6,
        }))
        .sort((a, b) => b.scoreByRole - a.scoreByRole),
    ];

    // Add a index for everyone
    let index = 0;
    for (const player of acc[role]) {
      player.index = index++;
    }

    return acc;
  }, {});

  // Now loop through the teams and assign players by spreading out the score
  // So, for the first one, get the first best role, for the second one, get the second best role, etc.
  const orderedRoles = roles
    .map((e) => {
      const playersInRole = players.filter((player) => player.Role === e);
      return { role: e, count: playersInRole.length };
    })
    .sort((a, b) => a.count - b.count);

  showLog(
    "Ordered roles: " +
      orderedRoles.map((e) => `${e.role} (${e.count})`).join(", "),
    "info"
  );

  let teamIndex = 0;

  // Loop until all teams have assigned players for all roles
  while (teams.some((team) => roles.some((role) => team[role] === null))) {
    for (const { role } of orderedRoles) {
      if (teams[teamIndex][role] !== null) {
        continue;
      }

      const player = byRoles[role].shift();
      if (!player) {
        showLog(
          `Needed a role "${role}" for team ${
            teamIndex + 1
          }, but couldn't find any player left`,
          "error"
        );
      }

      teams[teamIndex][role] = player;

      // Remove the player from the other roles
      roles.forEach((r) => {
        byRoles[r] = byRoles[r].filter((p) => p.Name !== player.Name);
      });

      showLog(
        `Assigning player "${player.Name}" to role "${role}" in "Team ${
          teamIndex + 1
        }" - position ${
          player.index + 1
        } in the list of ${role} with a score of ${player.scoreByRole.toFixed(
          0
        )} ppts`,
        "info"
      );

      if (player.Role !== role) {
        showLog(
          `Player "${player.Name}" is playing out of position: ${player.Role} -> ${role}, ${player.score} * ${player.penalty} ppts -> ${player.scoreByRole} ppts`,
          "warning"
        );
      }

      // Find the teamIndex with the lowest score
      const teamScores = teams.map(calculateTeamScore);
      teamIndex = teamScores.indexOf(Math.min(...teamScores));

      // teamIndex = (teamIndex + 1) % numTeams;
    }
  }

  return balanceTeams(teams);
}

function calculateScoreDifference(teams) {
  const scores = teams.map(calculateTeamScore);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  return maxScore - minScore;
}

function calculateTeamScore(team) {
  return roles.reduce(
    (sum, role) => sum + (team[role] ? team[role].scoreByRole : 0),
    0
  );
}

function swapPlayers(team1, team2, role) {
  const temp = team1[role];
  team1[role] = team2[role];
  team2[role] = temp;
}

function deepCloneTeams(teams) {
  return teams.map((team) => {
    const newTeam = {};
    for (const role in team) {
      newTeam[role] = { ...team[role] };
    }
    return newTeam;
  });
}

function balanceTeams(teams) {
  let minDifference = calculateScoreDifference(teams);
  let bestTeams = deepCloneTeams(teams);

  for (let i = 0; i < teams.length - 1; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      for (const role of roles) {
        const clonedTeams = deepCloneTeams(teams);
        swapPlayers(clonedTeams[i], clonedTeams[j], role);
        const newDifference = calculateScoreDifference(clonedTeams);

        if (newDifference < minDifference) {
          showLog(
            `Swapping players in role "${role}" ("${
              clonedTeams[i][role].Name
            }" with "${clonedTeams[j][role].Name}") between teams ${
              i + 1
            } and ${
              j + 1
            } reduces the score difference from ${minDifference.toFixed(
              2
            )} to ${newDifference.toFixed(2)}`,
            "info"
          );

          minDifference = newDifference;
          bestTeams = clonedTeams;
        }
      }
    }
  }

  return bestTeams;
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
      return player.Name.toLowerCase() === playerName.toLowerCase();
    });
    if (!player) {
      showLog(`Player "${playerName}" not found`, "error");
    }
    return player;
  });
}

const key = "1ay3hN5dqq6umyvu8v5Zi1ppQ3MV8J_x4G8kiCGpzfD0";
const sheetName = "Players";

async function onButtonClick() {
  // Clear error and warning messages
  const $console = document.getElementById("console");
  $console.innerHTML = "";

  const allPlayers = await downloadPlayers(key, sheetName);

  const players = parseAvailablePlayers(allPlayers);
  const numTeams = Math.floor(players.length / roles.length);

  const teams = createTeams(players, numTeams);

  // Display the teams in the HTML
  const $teamsContainer = document.getElementById("teams-container");
  $teamsContainer.innerHTML = "";

  teams.forEach((team, index) => {
    const $team = document.createElement("div");
    $team.classList.add("team");

    const $header = document.createElement("div");
    $header.classList.add("header");

    const $teamName = document.createElement("div");
    $teamName.classList.add("team-name");
    $teamName.innerHTML = `Team ${index + 1}`;
    $header.appendChild($teamName);

    const $teamScore = document.createElement("div");
    $teamScore.classList.add("team-score");
    $teamScore.innerHTML = calculateTeamScore(team).toFixed(0);
    $header.appendChild($teamScore);

    $team.appendChild($header);

    const $court = document.createElement("div");
    $court.classList.add("court");

    roles.forEach((role) => {
      const player = team[role];
      const $player = document.createElement("div");

      $player.classList.add("player");
      $player.classList.add(`role-${role.toLowerCase()}`);

      const $role = document.createElement("div");
      $role.classList.add("role");
      $role.innerText = role;

      if (player.penalty <= 0.6) {
        $role.classList.add("out-of-position-error");
      } else if (player.penalty <= 0.9) {
        $role.classList.add("out-of-position-warning");
      }
      $player.appendChild($role);

      const $name = document.createElement("div");
      $name.classList.add("name");
      $name.innerText = `${player.Name} (${player.Role})`;
      $player.appendChild($name);

      $court.appendChild($player);
    });

    $team.appendChild($court);
    $teamsContainer.appendChild($team);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("create-teams");
  button.addEventListener("click", onButtonClick);
});
