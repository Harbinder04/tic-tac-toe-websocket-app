import { WebSocketServer } from 'ws';
import http from 'http';

const health = http.createServer((req, res) => {
	if (req.url === '/health') {
		res.writeHead(200);
		res.end('OK');
	} else {
		res.writeHead(404);
		res.end();
	}
});

const server = new WebSocketServer({ path: '/api', port: 8080 }, () => {
	console.log('WebSocket server is running on port: 8080');
});

const games = new Map();
const players = new Map();

server.on('connection', (ws) => {
	ws.on('message', (message) => {
		const data = JSON.parse(message);

		switch (data.type) {
			case 'CREATE_GAME':
				handleCreateGame(ws, data);
				break;
			case 'JOIN_GAME':
				handleJoinGame(ws, data);
				break;
			case 'MAKE_MOVE':
				handleMove(ws, data);
				break;
			case 'LEAVE_GAME':
				handleExitGame(ws, data);
				break;
		}
	});

	ws.on('close', () => {
		handlePlayerDisconnect(ws);
	});
});

function generateGameId() {
	return (Math.random() * 10).toString(36).slice(2, 8); // Random 6 character string (0-9, a-z) e.g. 'x8k3z9'
}

function handleCreateGame(ws, data) {
	const gameId = generateGameId();

	const playerData = {
		id: data.player1Id,
		mark: 'X',
		ws: ws,
	};

	games.set(gameId, {
		players: [playerData],
		board: Array(9).fill(null),
		currentTurn: 'X',
		status: 'WAITING',
	});

	players.set(ws, {
		gameId,
		playerId: data.player1Id,
	});

	// send the current status through websocket
	ws.send(
		JSON.stringify({
			type: 'GAME_CREATED',
			gameId,
			playerId: data.player1Id,
			mark: 'X',
			currentTurn: 'X',
		})
	);
}

function handleJoinGame(ws, data) {
	try {
		const game = games.get(data.gameId);

		if (!game) {
			ws.send(
				JSON.stringify({
					type: 'ERROR',
					message: 'Game not found',
				})
			);
			return;
		}

		if (game.players.length == 2) {
			ws.send(
				JSON.stringify({
					type: 'ERROR',
					message: 'Game is full',
				})
			);
			return;
		}
		//to check: isn't the playerId same for both players.
		const playerData = {
			id: data.player2Id,
			mark: 'O',
			ws: ws,
		};

		game.players.push(playerData);
		game.status = 'PLAYING';

		players.set(ws, {
			gameId: data.gameId,
			playerId: data.player2Id,
		});

		// Notify both players that game is starting
		game.players.forEach((player) => {
			player.ws.send(
				JSON.stringify({
					type: 'GAME_STARTED',
					gameId: data.gameId,
					board: game.board,
					playerMark: player.mark,
					currentTurn: game.currentTurn,
					gameStatus: game.status,
				})
			);
		});
		// console.log(game.currentTurn);
	} catch (error) {
		console.error(error);
	}
}

function handleMove(ws, data) {
	const game = games.get(data.gameId);
	if (!game) return;

	const player1Id = players.get(ws).playerId;
	// const player2Id = players.get('player2Info').playerId;
	const player2Id = game.players.find((p) => p.id !== player1Id).id;

	const player = game.players.find(
		(p) => p.ws === ws && p.id === data.currentplayerId
	);
	if (!player || game.currentTurn !== player.mark) return;

	// Update board
	game.board[data.position] = player.mark;
	game.currentTurn = player.mark === 'X' ? 'O' : 'X';

	//update player turn
	const nextPlayerId = player.id === player1Id ? player2Id : player1Id;
	// Check for winner
	const winner = checkWinner(game.board);
	if (winner || isBoardFull(game.board)) {
		game.status = 'FINISHED';
	}

	// Broadcast updated state to both players
	game.players.forEach((player) => {
		player.ws.send(
			JSON.stringify({
				type: 'GAME_UPDATE',
				board: game.board,
				nextPlayerId: nextPlayerId,
				currentTurn: game.currentTurn,
				winner: winner,
				isDraw: !winner && isBoardFull(game.board),
			})
		);
	});
}

function handleExitGame(ws, data) {
	// const playerData = players.get(ws);
	// if (!playerData) return;
	if (!data || !data.gameId) {
		console.warn('handleLeaveGame called with invalid data:', data);
		return;
	}

	const game = games.get(data.gameId);
	if (!game) return;

	// Notify other player
	const otherPlayer = game.players.find((p) => p.ws !== ws);

	if (otherPlayer) {
		otherPlayer.ws.send(
			JSON.stringify({
				type: 'PLAYER_LEFT',
				gameId: data.gameId,
			})
		);
	}
	games.delete(data.gameId);
	players.delete(players);
}

function handleLeaveGame(ws) {
	const playerData = players.get(ws);
	if (!playerData) return;
	// console.log('Player data:', playerData);
	const game = games.get(playerData.gameId);
	if (!game) return;

	// Notify other player
	const otherPlayer = game.players.find((p) => p.ws !== ws);
	if (otherPlayer) {
		otherPlayer.ws.send(
			JSON.stringify({
				type: 'PLAYER_LEFT',
				gameId: playerData.gameId,
			})
		);
	}
	games.delete(playerData.gameId);
	players.delete(ws);
	ws.close();
}

function handlePlayerDisconnect(ws) {
	handleLeaveGame(ws);
}

function checkWinner(board) {
	const lines = [
		[0, 1, 2],
		[3, 4, 5],
		[6, 7, 8], // Rows
		[0, 3, 6],
		[1, 4, 7],
		[2, 5, 8], // Columns
		[0, 4, 8],
		[2, 4, 6], // Diagonals
	];

	for (let [a, b, c] of lines) {
		if (board[a] && board[a] === board[b] && board[a] === board[c]) {
			return board[a]; // Return the winning mark ('X' or 'O')
		}
	}
	return null;
}

function isBoardFull(board) {
	return board.every((cell) => cell !== null);
}
