import { WebSocketServer } from 'ws';
import { roomsAll } from './app';
import { AppWebSocket, Commands } from '../types';

export class Room {
  sendFreeRooms(webSocketServer: WebSocketServer) {
    const freeRooms = Array.from(roomsAll.entries())
      .filter(([, Room]) => Room.players.length === 1)
      .map(([id, Room]) => ({
        roomId: id,
        roomUsers: Room.players.map((player) => ({
          name: player.ws?.namePlayer,
          index: player.id,
        })),
      }));

    const message = JSON.stringify({
      id: 0,
      type: Commands.UpdateRoom,
      data: JSON.stringify(freeRooms),
    });

    console.log('message', message);

    webSocketServer.clients.forEach((client) => client.send(message));
  }

  addUserToRoom(dataString: string, ws: AppWebSocket) {
    const { indexRoom } = JSON.parse(dataString);
    const Room = roomsAll.get(indexRoom);

    if (!Room) return;

    const players = Room.players;

    if (players.length !== 1 || Room.namePlayer === ws.namePlayer) return;

    const firstPlayer = players[0];

    if (firstPlayer) {
      roomsAll.set(indexRoom, {
        ...Room,
        players: [firstPlayer, { ws, id: 1, isBot: false }],
      });
    }

    return indexRoom;
  }
}
