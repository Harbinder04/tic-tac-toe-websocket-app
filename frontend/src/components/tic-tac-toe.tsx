import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TicTacToe = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const [board, setBoard] = useState(Array(9).fill(null));
	const [gameId, setGameId] = useState('');
	let [playerId, setPlayerId] = useState<string | null>(null);
	const [playerMark, setPlayerMark] = useState(null);
	const [currentTurn, setCurrentTurn] = useState<'X' | 'O' | null>(null);
	const [gameStatus, setGameStatus] = useState('INIT'); // INIT, WAITING, PLAYING, FINISHED
	const [winner, setWinner] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [player1Id, setPlayer1Id] = useState<string | null>(null);
	const [player2Id, setPlayer2Id] = useState<string | null>(null);

	const CELL_SIZE = 150;
	const CANVAS_SIZE = CELL_SIZE * 3;
	const GRID_COLOR = '#333';
	const STROKE_WIDTH = 5;

	// Drawing function
	const drawBoard = () => {
		const canvas = canvasRef.current;
		if (!canvas) return; // Guard clause for null canvas

		const ctx = canvas.getContext('2d');
		if (!ctx) return; // Guard clause for null context

		// Clear canvas
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

		// Set line style
		ctx.strokeStyle = GRID_COLOR;
		ctx.lineWidth = STROKE_WIDTH;

		// Draw vertical lines
		for (let x = 1; x < 3; x++) {
			ctx.beginPath();
			ctx.moveTo(x * CELL_SIZE, 0);
			ctx.lineTo(x * CELL_SIZE, CANVAS_SIZE);
			ctx.stroke();
		}

		// Draw horizontal lines
		for (let y = 1; y < 3; y++) {
			ctx.beginPath();
			ctx.moveTo(0, y * CELL_SIZE);
			ctx.lineTo(CANVAS_SIZE, y * CELL_SIZE);
			ctx.stroke();
		}

		// Draw X and O markers
		board.forEach((cell, index) => {
			if (cell) {
				const x = (index % 3) * CELL_SIZE + CELL_SIZE / 2;
				const y = Math.floor(index / 3) * CELL_SIZE + CELL_SIZE / 2;

				ctx.font = '100px Arial';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';

				ctx.fillStyle = cell === 'X' ? 'blue' : 'red';
				ctx.fillText(cell, x, y);
			}
		});
	};

	// useEffect(() => {
	// 	return () => {
	//     // Close WebSocket connection on unmount
	// 		wsRef.current && wsRef.current.close();
	// 	};
	// }, [wsRef]);

	const handleClickClose = () => {
		wsRef.current && wsRef.current.close();
	};

	useEffect(() => {
		drawBoard();
	}, [board, gameStatus]); // Redraw when board or game status changes

	const connectWebSocket = () => {
		wsRef.current = new WebSocket('ws://localhost:8080');

		wsRef.current.onmessage = (event) => {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case 'GAME_CREATED':
					setGameId(data.gameId);
					setPlayerMark(data.mark);
					setCurrentTurn(data.currentTurn);
					setGameStatus('WAITING');
					break;

				case 'GAME_STARTED':
					setBoard(data.board);
					setGameId(data.gameId);
					setPlayerMark(data.playerMark);
					setCurrentTurn(data.currentTurn);
					setGameStatus(data.gameStatus);
					break;

				case 'GAME_UPDATE':
					setBoard(data.board);
					setCurrentTurn(data.currentTurn);
					setPlayerId(data.nextPlayerId);
					if (data.winner) {
						setWinner(data.winner);
						setGameStatus('FINISHED');
					} else if (data.isDraw) {
						setWinner('DRAW');
						setGameStatus('FINISHED');
					}
					break;

				case 'PLAYER_LEFT':
					setError('Other player left the game');
					setGameStatus('FINISHED');
					break;

				case 'ERROR':
					setError(data.message);
					break;
			}
		};

		wsRef.current.onerror = (error) => {
			setError(`WebSocket connection error ${error}`);
		};
	};

	const createGame = () => {
		if (!wsRef.current) {
			connectWebSocket();
		}
		const generatedId = (Math.random() * 20).toString(36);
		setPlayer1Id(generatedId);
		setPlayerId(generatedId);
		if (wsRef.current != null) {
			wsRef.current.onopen = () => {
				if (wsRef.current != null) {
					wsRef.current.send(
						JSON.stringify({
							type: 'CREATE_GAME',
							player1Id: generatedId,
						})
					);

					// todo: see the if we have to implement await here. log console.log(playerId);
					console.log(generatedId);
				} else {
					setError('Websocket connection is not established');
				}
			};
		} else {
			setError('Websocket connection is not established');
		}
	};

	const joinGame = (gameIdToJoin: string) => {
		if (!wsRef.current) {
			connectWebSocket();
		}
		//Must have unique id
		const generatedId = (Math.random() * 20).toString(36);
		setPlayer2Id(generatedId);
		if (wsRef.current != null) {
			wsRef.current.onopen = () => {
				if (wsRef.current != null) {
					wsRef.current.send(
						JSON.stringify({
							type: 'JOIN_GAME',
							gameId: gameIdToJoin,
							player2Id: generatedId,
						})
					);
				} else {
					setError('Websocket connection is not established');
				}
			};
		} else {
			setError('Websocket connection is not established');
		}
	};

	const handleCanvasClick = (event: any) => {
		try {
			if (gameStatus !== 'PLAYING' || currentTurn !== playerMark) return;

			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;

			const cellX = Math.floor(x / CELL_SIZE);
			const cellY = Math.floor(y / CELL_SIZE);
			const cellIndex = cellY * 3 + cellX;

			if (board[cellIndex] === null) {
				wsRef.current &&
					wsRef.current.send(
						JSON.stringify({
							type: 'MAKE_MOVE',
							gameId,
							position: cellIndex,
							player1Id,
							player2Id,
							currentplayerId: playerId,
						})
					);
			}
		} catch (error) {
			console.error('Error handling canvas click:', error);
			setError('An error occurred while making a move.');
		}
	};

	return (
		<Card className='w-full max-w-md mx-auto'>
			<CardHeader>
				<CardTitle>Multiplayer Tic Tac Toe</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col items-center'>
				{gameStatus === 'INIT' && (
					<div className='space-y-4 w-full'>
						<Button onClick={createGame} className='w-full'>
							Create New Game
						</Button>
						<div className='flex space-x-2'>
							<Input
								placeholder='Enter Game ID'
								value={gameId}
								onChange={(e) => setGameId(e.target.value)}
								className='flex-1'
							/>
							<Button onClick={() => joinGame(gameId)}>Join Game</Button>
						</div>
					</div>
				)}

				{gameStatus === 'WAITING' && (
					<div className='text-center p-4'>
						<p>Waiting for opponent to join...</p>
						<p className='mt-2'>
							Share this Game ID: <span className='font-bold'>{gameId}</span>
						</p>
					</div>
				)}

				{(gameStatus === 'PLAYING' || gameStatus === 'FINISHED') && (
					<div className='flex flex-col items-center'>
						<canvas
							ref={canvasRef}
							width={CANVAS_SIZE}
							height={CANVAS_SIZE}
							onClick={handleCanvasClick}
							className='cursor-pointer mb-4 border border-gray-200 rounded'
						/>

						{winner ? (
							<div className='text-center mb-4 text-lg font-semibold'>
								{winner === 'DRAW'
									? 'Game ended in a Draw!'
									: `Player ${winner} Wins!`}
							</div>
						) : (
							<div className='text-center mb-4 text-lg'>
								{currentTurn === playerMark ? 'Your turn' : "Opponent's turn"}
							</div>
						)}
						<div>
							<Button onClick={handleClickClose}>Close Connection</Button>
						</div>
					</div>
				)}
				{error && <div className='text-red-500 text-center mt-2'>{error}</div>}
			</CardContent>
		</Card>
	);
};

export default TicTacToe;
