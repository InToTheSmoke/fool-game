const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: ["https://fool-game-bte4.onrender.com/"], 
  credentials: true}
  ));
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["https://fool-game-bte4.onrender.com/"], 
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Генерация колоды карт
const generateDeck = () => {
  const suits = ['♥', '♦', '♣', '♠'];
  const values = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ value, suit });
    }
  }
  
  return deck;
};

// Функция перемешивания колоды
const shuffleDeck = (deck) => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// Игровые комнаты
const rooms = new Map();
const users = new Map();

// Обработка подключений
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);
  
  // Обработка входа пользователя
  socket.on('user_login', (userData) => {
    users.set(socket.id, {
      id: socket.id,
      name: userData.name,
      mafs: userData.mafs || 1000
    });
    
    socket.emit('login_success', users.get(socket.id));
    console.log('Пользователь вошел:', userData.name);
  });
  
  // Создание комнаты
  socket.on('create_room', () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    const user = users.get(socket.id);
    
    if (!user) return;
    
    rooms.set(roomId, {
      id: roomId,
      players: [{ ...user, cards: [], isActive: true }],
      gameStarted: false
    });
    
    socket.join(roomId);
    socket.emit('room_created', roomId);
    console.log('Комната создана:', roomId);
  });
  
  // Подключение к комнате
  socket.on('join_room', (roomId) => {
    const room = rooms.get(roomId);
    const user = users.get(socket.id);
    
    if (!room || !user || room.players.length >= 2) return;
    
    // Раздаем карты
    const deck = shuffleDeck(generateDeck());
    room.players[0].cards = deck.slice(0, 6);
    
    room.players.push({
      ...user,
      cards: deck.slice(6, 12),
      isActive: false
    });
    
    room.deck = deck.slice(12);
    room.trumpCard = deck[0];
    room.table = [];
    room.currentPlayer = 0;
    room.gameStarted = true;
    room.gamePhase = 'attacking';
    
    socket.join(roomId);
    io.to(roomId).emit('game_update', room);
    console.log('Пользователь присоединился к комнате:', roomId);
  });
  
  // Обработка отключения
  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
    users.delete(socket.id);
  });
});

// Простой маршрут для проверки работы сервера
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running', rooms: rooms.size, users: users.size });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`API доступно по: http://localhost:${PORT}`);
  console.log(`Статус сервера: http://localhost:${PORT}/api/status`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
