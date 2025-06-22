import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TicTacToe = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const [board, setBoard] = useState(Array(9).fill(null));
	const [gameId, setGameId] = useState<string>('');
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [playerMark, setPlayerMark] = useState(null);
	const [currentTurn, setCurrentTurn] = useState<'X' | 'O' | null>(null);
	const [gameStatus, setGameStatus] = useState('INIT'); // INIT, WAITING, PLAYING, FINISHED, LEFT
	const [winner, setWinner] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copySuccess, setCopySuccess] = useState(false);

	const CELL_SIZE = 150;
	const CANVAS_SIZE = CELL_SIZE * 3;
	const GRID_COLOR = '#0DA192';
	const STROKE_WIDTH = 5;

	// Drawing function
	const drawBoard = useCallback(() => {
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

				ctx.fillStyle =
					cell === 'X' ? 'rgb(244, 244, 244)' : 'rgb(255, 255, 0)';
				ctx.fillText(cell, x, y);
			}
		});
	}, [board, GRID_COLOR, STROKE_WIDTH, CANVAS_SIZE, CELL_SIZE]);

	useEffect(() => {
		drawBoard();
	}, [board, gameStatus, drawBoard]); // Redraw when board or game status changes

	const connectWebSocket = () => {
		wsRef.current = new WebSocket('ws://mygame.harbinder.tech/api');

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
					setGameStatus('LEFT');
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

	interface CanvasClickEvent extends React.MouseEvent<HTMLCanvasElement> {
		clientX: number;
		clientY: number;
	}

	const handleCanvasClick = (event: CanvasClickEvent) => {
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
			console.log('up playerId', playerId);
			if (board[cellIndex] === null) {
				wsRef.current?.send(
					JSON.stringify({
						type: 'MAKE_MOVE',
						gameId,
						position: cellIndex,
						currentplayerId: playerId,
					})
				);
			}
		} catch (error) {
			console.error('Error handling canvas click:', error);
			setError('An error occurred while making a move.');
		}
	};

	const handleClickClose = () => {
		setGameStatus('LEFT');
		setWinner(null);
		setBoard(Array(9).fill(null));
		setPlayerMark(null);
		setCurrentTurn(null);
		setError('Connection Closed you left the game');
		console.log('gameID', gameId);
		wsRef.current?.send(
			JSON.stringify({
				type: 'LEAVE_GAME',
				gameId: gameId,
			})
		);

		if (wsRef.current) {
			wsRef.current.close();
		}
	};

	const handleCopyClipboard = () => {
		if (gameId) {
			navigator.clipboard.writeText(gameId).then(() => {
				setCopySuccess(true);
			});
		} else {
			setError('Game ID not copied');
		}
	};
	return (
		<Card className='w-full max-w-md mx-auto'>
			<CardHeader className='text-center'>
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
								name='Game ID'
								placeholder='Enter Game ID'
								value={gameId}
								onChange={(e) => setGameId(e.target.value)}
								className='flex-1'
								autoFocus
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
							<Button
								onClick={handleCopyClipboard}
								className={`ml-2 ${
									copySuccess ? 'bg-green-700 hover:bg-green-700' : ''
								}`}>
								{copySuccess ? 'Copied!' : 'Copy'}
							</Button>
						</p>
					</div>
				)}

				{(gameStatus === 'PLAYING' || gameStatus === 'FINISHED') && (
					<div className='relative flex flex-col items-center'>
						<canvas
							ref={canvasRef}
							width={CANVAS_SIZE}
							height={CANVAS_SIZE}
							onClick={handleCanvasClick}
							className={`bg-[#26cfbe] cursor-pointer mb-4 border border-gray-200 rounded ${
								gameStatus === 'FINISHED' ? 'opacity-50' : ''
							} transition-opacity duration-300`}
						/>

						{winner ? (
							<div
								className={`${
									gameStatus === 'FINISHED'
										? 'absolute top-[45%] text-wrap font-bold text-4xl backdrop-blur-sm'
										: ''
								} text-center mb-4`}>
								{winner === 'DRAW' ? (
									<div>
										<span className='text-red-600'>Game ended in a Draw!</span>
										<br />
									</div>
								) : (
									<div>
										Player <span className='text-green-600'>{winner}</span>{' '}
										Wins!
									</div>
								)}
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
				{gameStatus === 'LEFT' ? (
					<>
						<div className='text-red-500 text-center mt-2'>{error}</div>
						<Button onClick={() => window.location.reload()} className='mt-4'>
							Restart
						</Button>
					</>
				) : (
					<></>
				)}
				{error && gameStatus !== 'LEFT' && (
					<div className='text-red-500 text-center mt-2'>{error}</div>
				)}
			</CardContent>
		</Card>
	);
};

export default TicTacToe;
