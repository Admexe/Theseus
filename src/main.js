const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let ws = new WebSocket('wss://node95.webte.fei.stuba.sk:8443/wss'); // Ensure this URL is correct!

let players = {}; // All players' positions and colors, including yours

let player = null; // This will be set once and only once per browser session.

ws.onopen = function() {
    // Request a new player ID from the server when the connection opens.
    ws.send(JSON.stringify({ type: 'requestPlayerID' }));
};
// Set up a basic event listener for arrow keys to control your player
document.addEventListener('keydown', function(event) {
    const key = event.key;
    const speed = 5; // Speed of movement
    let moved = false;
    //console.log("sem tu");
    if (player && players[player]) {
        //console.log("dostal sem sa tu");
        switch (key) {
            case 'ArrowUp': players[player].position.y -= speed; moved = true; break;
            case 'ArrowDown': players[player].position.y += speed; moved = true; break;
            case 'ArrowLeft': players[player].position.x -= speed; moved = true; break;
            case 'ArrowRight': players[player].position.x += speed; moved = true; break;
        }

        if (moved) {
            ws.send(JSON.stringify({
                type: 'move',
                player: player,
                position: players[player].position
            }));
            console.log("Move sent: ", JSON.stringify({
                type: 'move',
                player: player,
                position: players[player].position
            }));
        }
    }
});

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);

    console.log(data);
    switch (data.type) {
        case 'assignPlayerID':
            if (player === null) {
              player = data.player;
              players[player] = {
                position: data.position, // Use position from server
                color: data.color, // Use color from server
                trail: []  // Initialize the trail array here
              };
              console.log("Assigned player ID: ", player);
            }
            break;
        case 'playerData':
            // This case handles the initialization data for all other players already in the game
            players[data.player] = {
                position: data.position,
                color: data.color,
                trail: data.trail || []  // Initialize trail if not provided
            };
            break;
        case 'newPlayer':
            // This case is triggered when a new player joins the game
            // Ensure that data for new players is integrated without overriding existing data unnecessarily
            if (!players[data.player]) {
                players[data.player] = {
                    position: data.position,
                    color: data.color,
                    trail: []  // Start with an empty trail
                };
            }
            break;
        case 'move':
            // This case updates the position of a player and records it in their trail
            if (players[data.player]) {
                players[data.player].position = data.position;
                players[data.player].trail.push(data.position);
            }
            break;
        case 'disconnect':
            // This case handles the removal of a player from the game
            delete players[data.player];
            break;
    }

    updateCanvas();  // Call a function to update the game canvas whenever new data is processed
};

function drawPlayer(pos, color) {
    if (!pos || pos.x === undefined || pos.y === undefined) {
        console.error("Invalid player position", pos);
        return;
    }
    ctx.fillStyle = color;
    ctx.fillRect(pos.x, pos.y, 30, 30);  // Draw a 30x30 square for each player
}

function drawTrail(trail, color) {
    if (!trail || !Array.isArray(trail)) {
        //console.log("No Trail");
        return;  // Exit the function if trail is undefined or not an array
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 15;
    ctx.beginPath();
    trail.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.stroke();
    //console.log(trail);
}
function updateCanvas() {
    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw each player and their trail
    Object.keys(players).forEach(id => {
        const player = players[id];
        if (player.trail && player.trail.length > 0) {
            drawTrail(player.trail, player.color);
        }
        drawPlayer(player.position, player.color);
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas for redrawing
    Object.keys(players).forEach(id => {
        drawTrail(players[id].trail, players[id].color);
        drawPlayer(players[id].position, players[id].color);
    });
}

function updateGame() {
    draw();
    requestAnimationFrame(updateGame);
}

updateGame(); // Start the game loop