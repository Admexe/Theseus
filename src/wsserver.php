<?php
use Workerman\Worker;

require_once __DIR__ . '/vendor/autoload.php';

$ws_worker = new Worker("websocket://0.0.0.0:8282");

// Store the current state of the game
$connections = [];
$players = [];  // This will store player IDs, their positions, and colors

// Function to generate random positions
function getRandomPosition() {
    return [
        'x' => rand(50, 750),  // Assuming the game canvas width is 800px
        'y' => rand(50, 550)   // Assuming the game canvas height is 600px
    ];
}

// Function to generate a random color
function getRandomColor() {
    $letters = '0123456789ABCDEF';
    $color = '#';
    for ($i = 0; $i < 6; $i++) {
        $color .= $letters[rand(0, 15)];
    }
    return $color;
}

$ws_worker->onConnect = function($connection) use (&$connections, &$players) {
    $playerId = $connection->id;  // Use connection ID as player ID
    $position = getRandomPosition();  // Generate a random position
    $color = getRandomColor();  // Generate a random color

    // Save player data
    $players[$playerId] = [
        'position' => $position,
        'color' => $color,
        'trail' => []
    ];

    $connections[$playerId] = $connection; // Add connection to the list

    // Send new player data to all connected clients
    $newPlayerData = json_encode([
        'type' => 'newPlayer',
        'player' => $playerId,
        'position' => $position,
        'color' => $color
    ]);

    foreach ($connections as $conn) {
        $conn->send($newPlayerData);
    }

    // Optionally, send data about all other players to the new player
    foreach ($players as $id => $player) {
        if ($id !== $playerId) {
            $connections[$playerId]->send(json_encode([
                'type' => 'playerData',
                'player' => $id,
                'position' => $player['position'],
                'color' => $player['color']
            ]));
        }
    }

    echo "New connection (Player ID: $playerId) with position {$position['x']}, {$position['y']} and color $color\n";
};



$ws_worker->onMessage = function($connection, $data) use (&$connections, &$players) {
    try {
        $data = json_decode($data, true);
        if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
            echo "Error decoding JSON: " . json_last_error_msg() . "\n";
            return;
        }
        if ($data['type'] === 'move' && isset($players[$data['player']])) {
            $players[$data['player']]['position'] = $data['position'];
    
            foreach ($connections as $conn) {
                $conn->send(json_encode([
                    'type' => 'move',
                    'player' => $data['player'],
                    'position' => $data['position']
                ]));
            }
        }
        if($data['type'] ==  'requestPlayerID'){
            $playerId = $connection->id;
            $players[$playerId] = [
                'position' => getRandomPosition(),
                'color' => getRandomColor()
            ];
            $connections[$playerId] = $connection;
            $connection->send(json_encode([
                'type' => 'assignPlayerID',
                'player' => $playerId,
                'position' => $players[$playerId]['position'],
                'color' => $players[$playerId]['color']
            ]));


        }
    } catch (Exception $e) {
        echo "Exception in onMessage: " . $e->getMessage() . "\n";
    }
};


$ws_worker->onClose = function($connection) use (&$connections, &$players) {
    $playerId = $connection->id;
    unset($players[$playerId]);  // Remove player from tracking
    unset($connections[$playerId]);  // Remove connection
    echo "Connection closed (Player ID: $playerId)\n";

    // Broadcast disconnection
    $data = json_encode(['type' => 'disconnect', 'player' => $playerId]);
    foreach ($connections as $conn) {
        $conn->send($data);
    }
};

Worker::runAll();
