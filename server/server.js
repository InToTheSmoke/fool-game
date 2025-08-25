const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// Настройка CORS
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://fool-game-client.onrender.com"
  ],
  credentials: true
}));

app.use(express.json());

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, '../build')));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://fool-game-client.onrender.com"
    ],
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

// Функция для определения значения карты
const getCardValue = (value) => {
  const values = {
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return values[value] || 0;
};

// Игровые комнаты
const rooms = new Map();
// Подключенные пользователи
const users = new Map();

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Обработка корневого пути
app.get('/', (req, res) => {
  res.json({
    message: 'Сервер игры "Дурак" работает!',
    version: '1.0.0',
    endpoints: {
      status: '/api/status',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// API для получения статуса сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: 'Server is running',
    rooms: rooms.size,
    users: users.size,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Обработка 404 ошибок
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Запрашиваемый путь не существует',
    path: req.originalUrl
  });
});

// Обработка подключений WebSocket
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);
  
  // Обработка входа пользователя
  socket.on('user_login', (userData) => {
    try {
      console.log('Получены данные пользователя:', userData);
      
      if (!userData || !userData.name) {
        socket.emit('login_error', 'Имя пользователя обязательно');
        return;
      }
      
      const user = {
        id: socket.id,
        name: userData.name,
        mafs: userData.mafs || 1000
      };
      
      users.set(socket.id, user);
      console.log('Пользователь сохранен:', user);
      
      socket.emit('login_success', user);
    } catch (error) {
      console.error('Ошибка при входе пользователя:', error);
      socket.emit('login_error', 'Внутренняя ошибка сервера');
    }
  });
  
  // Создание новой комнаты
  socket.on('create_room', () => {
    try {
      const user = users.get(socket.id);
      
      if (!user) {
        socket.emit('error', 'Сначала войдите в систему');
        return;
      }
      
      const roomId = Math.random().toString(36).substring(2, 8);
      const deck = shuffleDeck(generateDeck());
      const trumpCard = deck[0];
      
      rooms.set(roomId, {
        id: roomId,
        players: [{
          id: socket.id,
          name: user.name,
          mafs: user.mafs,
          cards: deck.slice(1, 7),
          isActive: true
        }],
        deck: deck.slice(13),
        trumpCard,
        table: [],
        currentPlayer: 0,
        betAmount: 100,
        gameStarted: false,
        gamePhase: 'waiting'
      });
      
      socket.join(roomId);
      socket.emit('room_created', roomId);
      console.log('Комната создана:', roomId);
    } catch (error) {
      console.error('Ошибка при создании комнаты:', error);
      socket.emit('error', 'Ошибка при создании комнаты');
    }
  });
  
  // Подключение к комнате
  socket.on('join_room', (roomId) => {
    try {
      const room = rooms.get(roomId);
      const user = users.get(socket.id);
      
      if (!room) {
        socket.emit('error', 'Комната не найдена');
        return;
      }
      
      if (room.players.length >= 2) {
        socket.emit('error', 'Комната заполнена');
        return;
      }
      
      if (!user) {
        socket.emit('error', 'Сначала войдите в систему');
        return;
      }
      
      // Раздаем карты второму игроку
      const playerCards = room.deck.slice(0, 6);
      room.deck = room.deck.slice(6);
      
      room.players.push({
        id: socket.id,
        name: user.name,
        mafs: user.mafs,
        cards: playerCards,
        isActive: false
      });
      
      room.gamePhase = 'betting';
      
      socket.join(roomId);
      io.to(roomId).emit('game_update', room);
      console.log('Пользователь присоединился к комнате:', roomId);
    } catch (error) {
      console.error('Ошибка при присоединении к комнате:', error);
      socket.emit('error', 'Ошибка при присоединении к комнате');
    }
  });
  
  // Обработка отключения
  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
    
    try {
      // Удаляем пользователя из всех комнат
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          // Уведомляем другого игрока о отключении
          room.players.splice(playerIndex, 1);
          io.to(roomId).emit('player_disconnected');
          
          // Если комната пустая, удаляем ее
          if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log('Комната удалена:', roomId);
          }
          
          break;
        }
      }
      
      // Удаляем пользователя
      users.delete(socket.id);
    } catch (error) {
      console.error('Ошибка при обработке отключения:', error);
    }
  });
});

// Обработка ошибок сервера
server.on('error', (error) => {
  console.error('Ошибка сервера:', error);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный промис:', promise, 'причина:', reason);
});

// Запуск сервера
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=== СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT} ===`);
  console.log(`Время запуска: ${new Date().toISOString()}`);
  console.log(`Режим: ${process.env.NODE_ENV || 'development'}`);
});

// Экспорт для тестирования
module.exports = app;
