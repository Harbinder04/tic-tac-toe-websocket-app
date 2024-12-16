import  { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TicTacToe = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState<string | null>(null);
  // const [gameMode, setGameMode] = useState('local'); // 'local' or 'online'
  // const [roomCode, setRoomCode] = useState('');

  // Canvas configuration
  const GRID_COLOR = '#111';
  const CELL_SIZE = 150;
  const CANVAS_SIZE = CELL_SIZE * 3;
  const STROKE_WIDTH = 5;

  // Draw the game board on canvas
  const drawBoard = (ctx: CanvasRenderingContext2D | null) => {
    if (!ctx) return;
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

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (winner) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cellX = Math.floor(x / CELL_SIZE);
    const cellY = Math.floor(y / CELL_SIZE);
    const cellIndex = cellY * 3 + cellX;

    // Check if cell is empty
    console.log(board[cellIndex]);
    if (board[cellIndex] === null) {
      const newBoard = [...board];
      newBoard[cellIndex] = currentPlayer;
      setBoard(newBoard);
      
      // Check for winner
      checkWinner(newBoard);
      
      // Switch player
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  // Check for winner or draw
  const checkWinner = (currentBoard: any) => {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (let pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (
        currentBoard[a] &&
        currentBoard[a] === currentBoard[b] &&
        currentBoard[a] === currentBoard[c]
      ) {
        setWinner(currentBoard[a]);
        return;
      }
    }

    // Check for draw
    if (currentBoard.every((cell: any) => cell !== null)) {
      setWinner('Draw');
    }
  };

  // Reset game
  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawBoard(ctx);
  }, [board]);

  return (
    <Card className="w-full flex flex-col items-center">
      <CardHeader>
        <CardTitle>Tic Tac Toe</CardTitle>
      </CardHeader>
      <CardContent>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onClick={handleCanvasClick}
          className="cursor-pointer mb-4 self-center" 
        />
        
        {winner ? (
          <div className="mb-4">
            {winner === 'Draw' 
              ? 'It\'s a Draw!' 
              : `Player ${winner} Wins!`}
          </div>
        ) : (
          <div className="mb-4">
            Current Player: {currentPlayer}
          </div>
        )}
        
        <Button onClick={resetGame} className="w-full">
          Reset Game
        </Button>
      </CardContent>
    </Card>
  );
};

export default TicTacToe;