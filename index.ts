import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import dotenv from 'dotenv';
import { cwd } from 'process';
import { httpServer } from './src/http_server/index';
import { AppWebSocket, Commands, SocketMessage } from './src/types';
import { App } from './src/websoket/app';

dotenv.config({ path: path.resolve(cwd(), '.env') });

const HTTP_PORT = process.env.PORT;

export const webSocketServer = new WebSocketServer({ server: httpServer });

const server = new App(webSocketServer);

const intervalSessions = setInterval(function ping() {
  webSocketServer.clients.forEach(function each(wsClient: WebSocket) {
    const ws = wsClient as AppWebSocket;
    if (ws.isActive === false) {
      return ws.terminate();
    }
    ws.isActive = false;
    ws.ping();
  });
}, 15000);

httpServer.listen(HTTP_PORT, () =>
  console.log(`Start static http server on the ${HTTP_PORT} port!`),
);

webSocketServer.on('connection', function connection(ws: AppWebSocket, req) {
  ws.isActive = true;

  if (
    req.headers.upgrade === 'websocket' &&
    req.headers.connection === 'Upgrade'
  ) {
    console.log(
      'WebSocket connected, key WebSocket is',
      req.headers['sec-websocket-key'],
    );
  }

  ws.on('error', console.error)
    .on('pong', () => (ws.isActive = true))
    .on('close', () => server.cleanWebSocket(ws))
    .on('message', (rawMessage: WebSocket.RawData) => {
      const message: SocketMessage = JSON.parse(rawMessage.toString());

      switch (message.type) {
        case Commands.Registration: {
          server.registerWebSocket(ws, message);
          break;
        }

        case Commands.CreateRoom: {
          server.createRoomWebSocket(ws);
          break;
        }

        case Commands.AddUserToRoom: {
          server.addUserToRoomWebSocket(ws, message);
          break;
        }

        case Commands.AddShips: {
          server.addShipsWebSocket(message);
          break;
        }

        case Commands.Attack: {
          server.attackWebSocket(message);
          break;
        }

        case Commands.RandomAttack: {
          server.randomAttackWebSocket(message);
          break;
        }

        case Commands.SinglePlay: {
          server.singlePlayWebSocket(ws);
          break;
        }
      }
    });
});

process.on('SIGINT', () => {
  clearInterval(intervalSessions);

  webSocketServer.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  webSocketServer.close();
  httpServer.close();

  process.exit();
});
