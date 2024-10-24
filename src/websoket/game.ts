import { roomsAll } from './app';
import {
  AppWebSocket,
  Commands,
  RoomInfo,
  PlayerInfo,
  ShipInfo,
  Cell,
} from '../types';

export class Game {
  roomsCounter = 1;

  createGame(roomId: number) {
    roomsAll.get(roomId)?.players?.forEach(
      ({ ws, id }) =>
        ws &&
        this.sendMessage(ws, Commands.CreateGame, {
          idGame: roomId,
          idPlayer: id,
        }),
    );
  }

  createRoom(ws: AppWebSocket) {
    const roomForGame = Array.from(roomsAll.values()).find(
      (item) => item.namePlayer === ws.namePlayer,
    );

    if (roomForGame) return;

    const newRoomId = this.roomsCounter++;

    roomsAll.set(newRoomId, {
      idRoom: newRoomId,
      namePlayer: ws.namePlayer,
      idPlayerCurrent: -1,
      players: [{ ws, id: 0, isBot: false }],
    });

    return { roomId: newRoomId, Room: roomsAll.get(newRoomId) as RoomInfo };
  }

  addShips(dataString: string) {
    const { gameId, indexPlayer, ships } = JSON.parse(dataString);

    const roomThisGame = roomsAll.get(gameId);
    const players = roomThisGame?.players;
    const player = players?.[indexPlayer];

    if (!roomThisGame || !player) return;

    player.ships = ships;

    const board = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => ({
        ...{ shipIndex: -1, isAttacked: false },
      })),
    );

    ships.forEach((ship: ShipInfo, id: number) => {
      ship.hp = ship.length;

      const { x, y } = ship.position;
      const shipLength = ship.length;

      for (let i = 0; i < shipLength; i++) {
        const cell = ship.direction ? board[x]?.[y + i] : board[x + i]?.[y];

        if (cell && cell.shipIndex === -1) {
          cell.shipIndex = id;
        }
      }
    });

    player.game = board;

    if (players.every((player) => !!player.ships)) {
      players.forEach(
        ({ ws, ships }) =>
          ws &&
          this.sendMessage(ws, Commands.StartGame, {
            currentPlayerIndex: player.id,
            ships,
          }),
      );

      this.nextStep(gameId, player.id === 1 ? 0 : 1);
    }
  }

  createSinglePlay(ws: AppWebSocket) {
    const roomThisGame = Array.from(roomsAll.values()).find(
      (item) => item.namePlayer === ws.namePlayer,
    );

    if (roomThisGame && roomThisGame.players.length === 2) return;

    const bot = this.createBotPlayer();

    let currentRoom = roomThisGame;

    if (!currentRoom) {
      const roomId = this.createRoom(ws)?.roomId as number;
      currentRoom = roomsAll.get(roomId) as RoomInfo;
    }

    currentRoom.players = [currentRoom.players[0] as PlayerInfo, bot];
    this.createGame(currentRoom.idRoom);
  }

  attack(dataString: string) {
    const { gameId, indexPlayer, x, y } = JSON.parse(dataString);
    const roomThisGame = roomsAll.get(gameId);
    const players = roomThisGame?.players;

    if (!roomThisGame || roomThisGame.idPlayerCurrent !== indexPlayer) return;

    const competitorId = indexPlayer === 1 ? 0 : 1;
    const competitorPlayer = players?.[competitorId];

    if (!competitorPlayer) return;

    const currentPlayer = players?.[indexPlayer];

    if (!currentPlayer) return;

    const attackResult = this.resultAttack(competitorPlayer, x, y);

    if (!attackResult) return;

    let isWin = false;

    if (attackResult.status === Commands.Killed) {
      const ship = competitorPlayer.ships?.[attackResult.shipIndex];

      if (!ship) return;

      const shipLength = ship.length;

      for (let i = -1; i < shipLength + 1; i++) {
        for (let j = -1; j < 2; j++) {
          const x = ship.position.x + (ship.direction ? j : i);
          const y = ship.position.y + (ship.direction ? i : j);

          const cell = competitorPlayer.game?.[x]?.[y];

          if (!cell || cell.isAttacked) continue;

          cell.isAttacked = true;

          roomThisGame.players.forEach(
            ({ ws }) =>
              ws &&
              this.sendMessage(ws, Commands.Attack, {
                position: { x, y },
                currentPlayer: roomThisGame.idPlayerCurrent,
                status: Commands.Miss,
              }),
          );

          this.nextStep(roomThisGame.idRoom);
        }
      }

      isWin = !!competitorPlayer.ships?.every((ship) => ship.hp === 0);
    }

    players.forEach(
      ({ ws }) =>
        ws &&
        this.sendMessage(ws, Commands.Attack, {
          position: { x, y },
          currentPlayer: indexPlayer,
          status: attackResult.status,
        }),
    );

    if (isWin) {
      this.gameOver(players, indexPlayer);

      roomsAll?.delete(gameId);

      return competitorPlayer.isBot || currentPlayer.isBot
        ? undefined
        : currentPlayer.ws?.namePlayer;
    }

    this.nextStep(
      gameId,
      attackResult.status === Commands.Miss ? competitorId : undefined,
    );
  }

  attackRandom(dataString: string) {
    const { gameId, indexPlayer } = JSON.parse(dataString);
    const competitorId = indexPlayer === 1 ? 0 : 1;
    const competitorPlayer = roomsAll
      .get(gameId)
      ?.players?.find((player) => player.id === competitorId);

    if (!competitorPlayer) return;

    while (true) {
      const x = Math.floor(Math.random() * 10);
      const y = Math.floor(Math.random() * 10);

      const cell = competitorPlayer.game?.[x]?.[y];

      if (!cell || cell.isAttacked) continue;

      this.attack(JSON.stringify({ gameId, indexPlayer, x, y }));
      break;
    }
  }

  gameOver(players: PlayerInfo[], winnerPlayerIndex: number) {
    players.forEach(
      ({ ws }) =>
        ws &&
        this.sendMessage(ws, Commands.Finish, { winPlayer: winnerPlayerIndex }),
    );
  }

  createBotPlayer(): PlayerInfo {
    const ships: ShipInfo[] = [];
    const shipTypes: ('small' | 'medium' | 'large' | 'huge')[] = [
      'huge',
      'large',
      'medium',
      'small',
    ];
    const shipLengths = [4, 3, 2, 1];
    const shipCounts = [1, 2, 3, 4];
    const gridSize = 10;
    const grid: boolean[][] = Array.from({ length: gridSize }, () =>
      new Array(gridSize).fill(false),
    );

    for (let i = 0; i < shipTypes.length; i++) {
      const shipType = shipTypes[i];
      const shipLength = shipLengths[i];
      const shipCount = shipCounts[i];

      if (
        shipCount !== undefined &&
        shipLength !== undefined &&
        shipType !== undefined
      ) {
        for (let j = 0; j < shipCount; j++) {
          let isPlaced = false;

          while (!isPlaced) {
            const direction = Math.random() < 0.5;
            const { x, y } = this.getRandomPosition(
              gridSize,
              shipLength,
              direction,
            );

            if (!this.isValidPlacement(grid, x, y, shipLength, direction))
              continue;

            this.placeShip(grid, x, y, shipLength, direction);

            ships.push({
              position: { x, y },
              direction,
              length: shipLength,
              type: shipType,
              hp: shipLength,
            });

            isPlaced = true;
          }
        }
      }
    }

    const board: Cell[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => ({
        shipIndex: -1,
        isAttacked: false,
      })),
    );

    ships.forEach((ship, index) => {
      ship.hp = ship.length;

      const { x, y } = ship.position;
      const shipLength = ship.length;

      for (let i = 0; i < shipLength; i++) {
        const cell = ship.direction ? board[x]?.[y + i] : board[x + i]?.[y];

        if (cell && cell.shipIndex === -1) {
          cell.shipIndex = index;
        }
      }
    });

    return { id: 1, isBot: true, ships, game: board };
  }

  closeRoom(ws: AppWebSocket) {
    const roomThisGame = Array.from(roomsAll.values()).find(
      (item) =>
        item.namePlayer === ws.namePlayer ||
        (item.players[1]?.ws?.namePlayer === ws.namePlayer &&
          item.players.length === 2),
    );

    if (!roomThisGame) return;

    const winnerPlayerIndex = roomThisGame.namePlayer === ws.namePlayer ? 1 : 0;
    const winnerUserName =
      roomThisGame.players[winnerPlayerIndex]?.ws?.namePlayer;

    this.gameOver(roomThisGame.players, winnerPlayerIndex);

    roomsAll.delete(roomThisGame.idRoom);

    return winnerUserName;
  }

  private sendMessage(ws: AppWebSocket, type: string, data: any) {
    const message = JSON.stringify({ type, data: JSON.stringify(data), id: 0 });
    console.log('message', message);
    ws.send(message);
  }

  private nextStep(gameId: number, nextPlayerId?: number) {
    const roomThisGame = roomsAll.get(gameId);

    if (!roomThisGame || !roomThisGame.players) return;

    if (nextPlayerId !== undefined) {
      roomThisGame.idPlayerCurrent = nextPlayerId;
    }

    roomThisGame.players.forEach(({ ws, isBot, id }) => {
      ws &&
        this.sendMessage(ws, Commands.Turn, {
          currentPlayer: roomThisGame.idPlayerCurrent,
        });

      if (isBot && roomThisGame.idPlayerCurrent === id) {
        setTimeout(
          () => this.attackRandom(JSON.stringify({ gameId, indexPlayer: id })),
          500,
        ); // time for bot to think
      }
    });
  }

  private resultAttack(competitorPlayer: PlayerInfo, x: number, y: number) {
    const cell = competitorPlayer.game?.[x]?.[y];

    if (!cell || cell.isAttacked) return;

    cell.isAttacked = true;

    if (cell.shipIndex === -1)
      return { status: Commands.Miss, shipIndex: cell.shipIndex };

    const ship = competitorPlayer.ships?.[cell.shipIndex];

    if (!ship || !ship.hp) return;

    ship.hp -= 1;

    return {
      status: ship.hp === 0 ? Commands.Killed : Commands.Shot,
      shipIndex: cell.shipIndex,
    };
  }

  private getRandomPosition(
    gridSize: number,
    shipLength: number,
    direction: boolean,
  ) {
    const x = Math.floor(
      Math.random() * (gridSize - (direction ? 0 : shipLength)),
    );
    const y = Math.floor(
      Math.random() * (gridSize - (direction ? shipLength : 0)),
    );

    return { x, y };
  }

  private isValidPlacement(
    grid: boolean[][],
    x: number,
    y: number,
    shipLength: number,
    direction: boolean,
  ) {
    for (let i = -1; i < shipLength + 1; i++) {
      for (let j = -1; j < 2; j++) {
        const newX = direction ? x + j : x + i;
        const newY = direction ? y + i : y + j;

        if (grid[newX]?.[newY]) return false;
      }
    }

    return true;
  }

  private placeShip(
    grid: boolean[][],
    x: number,
    y: number,
    shipLength: number,
    direction: boolean,
  ) {
    for (let i = 0; i < shipLength; i++) {
      const newX = direction ? x : x + i;
      const newY = direction ? y + i : y;
      (grid[newX] as boolean[])[newY] = true;
    }
  }
}
