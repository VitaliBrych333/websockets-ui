import WebSocket from 'ws';

export enum Commands {
  Registration = 'reg',
  CreateRoom = 'create_room',
  AddUserToRoom = 'add_user_to_room',
  AddShips = 'add_ships',
  Attack = 'attack',
  RandomAttack = 'randomAttack',
  SinglePlay = 'single_play',
  UpdateWinners = 'update_winners',
  CreateGame = 'create_game',
  StartGame = 'start_game',
  Finish = 'finish',
  Turn = 'turn',
  UpdateRoom = 'update_room',
  Killed = 'killed',
  Shot = 'shot',
  Miss = 'miss',
}

export type SocketMessage = {
  id: number;
  type: string;
  data: string;
};

export interface AppWebSocket extends WebSocket {
  namePlayer: string;
  isActive: boolean;
}

export type ShipInfo = {
  position: {
    x: number;
    y: number;
  };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
  hp?: number;
};

export type PlayerInfo = {
  id: number;
  ws?: AppWebSocket;
  ships?: ShipInfo[];
  isBot: boolean;
  game?: { shipIndex: number; isAttacked: boolean }[][];
};

export type UserInfo = {
  id: number;
  name: string;
  password: string;
  ws: AppWebSocket;
  wins: number;
};

export type RoomInfo = {
  idRoom: number;
  idPlayerCurrent: number;
  namePlayer: string;
  players: PlayerInfo[];
};

export type Cell = {
  shipIndex: number;
  isAttacked: boolean;
};
