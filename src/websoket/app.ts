import { WebSocketServer } from 'ws';
import { Game } from './game';
import { Room } from './room';
import { Players } from './players';
import {
  AppWebSocket,
  Commands,
  SocketMessage,
  RoomInfo,
  UserInfo,
} from '../types';

export const usersAll: Map<string, UserInfo> = new Map();
export const roomsAll: Map<number, RoomInfo> = new Map();

export class App {
  players = new Players();
  game = new Game();
  room = new Room();

  constructor(public webSocketServer: WebSocketServer) {}

  registerWebSocket(ws: AppWebSocket, message: SocketMessage) {
    this.players.registerPlayer(message, ws);
    this.sendUpdate();
  }

  createRoomWebSocket(ws: AppWebSocket) {
    const roomId = this.game.createRoom(ws);

    if (roomId) {
      this.sendUpdate();
    }
  }

  addUserToRoomWebSocket(ws: AppWebSocket, message: SocketMessage) {
    const roomId = this.room.addUserToRoom(message.data, ws);

    if (roomId) {
      this.sendUpdate();
      this.game.createGame(roomId);
    }
  }

  addShipsWebSocket(message: SocketMessage) {
    this.game.addShips(message.data);
  }

  attackWebSocket(message: SocketMessage) {
    const winnerUserName = this.game.attack(message.data);

    if (winnerUserName) {
      this.addWinner(winnerUserName);
      this.sendUpdate();
    }
  }

  randomAttackWebSocket(message: SocketMessage) {
    this.game.attackRandom(message.data);
  }

  singlePlayWebSocket(ws: AppWebSocket) {
    this.game.createSinglePlay(ws);
  }

  cleanWebSocket(ws: AppWebSocket) {
    const winnerUserName = this.game.closeRoom(ws);

    if (winnerUserName) {
      this.addWinner(winnerUserName);
      this.sendUpdate();
    }

    ws.isActive = false;
    ws.terminate();
  }

  private addWinner(namePlayer: string) {
    const user = usersAll.get(namePlayer);

    if (user) {
      user.wins += 1;
    }
  }

  private sendUpdate() {
    this.room.sendFreeRooms(this.webSocketServer);

    const winnersList = Array.from(usersAll.values())
      .filter((user) => user.wins > 0)
      .map((user) => ({ name: user.name, wins: user.wins }));

    const message = JSON.stringify({
      id: 0,
      type: Commands.UpdateWinners,
      data: JSON.stringify(winnersList),
    });

    console.log('message', message);

    this.webSocketServer.clients.forEach((client) => client.send(message));
  }
}
