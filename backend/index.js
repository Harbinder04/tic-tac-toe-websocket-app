import { WebSocketServer } from 'ws';
import http from 'http';

// Create HTTP server that handles both health checks and WebSocket upgrades
const server = http.createServer((req, res) => {
	// Handle health check endpoint
	if (req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(
			JSON.stringify({
				status: 'healthy',
				timestamp: new Date().toISOString(),
			})
		);
		return;
	}
	// 404 for other paths
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('Not Found');
});

// Create WebSocket server using the same HTTP server
const wss = new WebSocketServer({
	server: server,
	path: '/api', // WebSocket connections on /api path
});

const games = new Map();
const players = new Map();

// Start the server on port 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Health check: http://localhost:${PORT}/health`);
	console.log(`WebSocket endpoint: ws://localhost:${PORT}/api`);
});

wss.on('connection', (ws) => {
	// console.log('New WebSocket connection established');

	ws.on('message', (message) => {
		try {
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
		} catch (error) {
			console.error('Error parsing message:', error);
			ws.send(
				JSON.stringify({
					type: 'ERROR',
					message: 'Invalid message format',
				})
			);
		}
	});

	ws.on('close', () => {
		handlePlayerDisconnect(ws);
	});

	ws.on('error', (error) => {
		console.error('WebSocket error:', error);
	});
});

function generateGameId() {
	return Math.random().toString(36).substring(2, 8); // Random 6 character string
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

	// console.log(`Game created: ${gameId} by player: ${data.player1Id}`);
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

		if (game.players.length >= 2) {
			ws.send(
				JSON.stringify({
					type: 'ERROR',
					message: 'Game is full',
				})
			);
			return;
		}

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
	} catch (error) {
		console.error('Error in handleJoinGame:', error);
		ws.send(
			JSON.stringify({
				type: 'ERROR',
				message: 'Failed to join game',
			})
		);
	}
}

function handleMove(ws, data) {
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

	const playerInfo = players.get(ws);
	if (!playerInfo) {
		ws.send(
			JSON.stringify({
				type: 'ERROR',
				message: 'Player not found',
			})
		);
		return;
	}

	const player = game.players.find((p) => p.ws === ws);
	if (!player || game.currentTurn !== player.mark) {
		ws.send(
			JSON.stringify({
				type: 'ERROR',
				message: 'Not your turn',
			})
		);
		return;
	}

	// Check if position is valid and empty
	if (
		data.position < 0 ||
		data.position > 8 ||
		game.board[data.position] !== null
	) {
		ws.send(
			JSON.stringify({
				type: 'ERROR',
				message: 'Invalid move',
			})
		);
		return;
	}

	// Update board
	game.board[data.position] = player.mark;
	game.currentTurn = player.mark === 'X' ? 'O' : 'X';

	// Get other player ID
	const otherPlayer = game.players.find((p) => p.ws !== ws);
	const nextPlayerId = otherPlayer ? otherPlayer.id : null;

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
				gameStatus: game.status,
			})
		);
	});
}

function handleExitGame(ws, data) {
	if (!data || !data.gameId) {
		console.warn('handleExitGame called with invalid data:', data);
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
	players.delete(ws);
	// console.log(`Player left game: ${data.gameId}`);
}

function handleLeaveGame(ws) {
	const playerData = players.get(ws);
	if (!playerData) return;

	const game = games.get(playerData.gameId);
	if (!game) {
		players.delete(ws);
		return;
	}

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
	// console.log(`Player disconnected from game: ${playerData.gameId}`);
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
