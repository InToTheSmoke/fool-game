const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// Базовые middleware
const corsOptions = {
  origin: [
    'https://fool-game-client.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, process.env.NODE_ENV === 'production' ? '../build' : './build')));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
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

// API маршруты
app.get('/api', (req, res) => {
  res.json({
    message: 'Сервер игры "Дурак" работает!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'Server is running',
    rooms: rooms.size,
    users: users.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Обработка всех остальных запросов - возвращаем React приложение
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, process.env.NODE_ENV === 'production' ? '../build/index.html' : './build/index.html'));
});

// Функция для отправки списка комнат
function sendRoomsList(targetSocket = null) {
  const roomsList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    players: room.players.length,
    maxPlayers: 2,
    gameStarted: room.gameStarted,
    createdAt: room.createdAt
  }));
  
  if (targetSocket) {
    targetSocket.emit('rooms_list', roomsList);
  } else {
    io.emit('rooms_list', roomsList);
  }
}

// Обработка подключений WebSocket
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);
  
  // Немедленно отправляем подтверждение подключения
  socket.emit('connected', { 
    message: 'Подключение к серверу установлено',
    socketId: socket.id,
    status: 'connected'
  });
  
  // Обработка ping-запросов для поддержания активности
  socket.on('ping', (data) => {
    socket.emit('pong', { timestamp: Date.now(), original: data });
  });
  
  // Обработка входа пользователя
  socket.on('user_login', (userData) => {
    try {
      console.log('Получены данные пользователя:', userData);
      
      if (!userData || !userData.name) {
        socket.emit('login_error', { message: 'Имя пользователя обязательно' });
        return;
      }
      
      const user = {
        id: socket.id,
        name: userData.name,
        mafs: userData.mafs || 1000
      };
      
      users.set(socket.id, user);
      console.log('Пользователь сохранен:', user);
      
      // Отправляем подтверждение с полными данными пользователя
      socket.emit('login_success', { 
        user: user,
        message: 'Вход выполнен успешно'
      });
      
      console.log('Отправлено подтверждение входа пользователю:', socket.id);
    } catch (error) {
      console.error('Ошибка при входе пользователя:', error);
      socket.emit('login_error', { message: 'Внутренняя ошибка сервера' });
    }
  });
  
  // Получение списка комнат
  socket.on('get_rooms', () => {
    try {
      sendRoomsList(socket);
    } catch (error) {
      console.error('Ошибка при получении списка комнат:', error);
      socket.emit('error', { message: 'Ошибка при получении списка комнат' });
    }
  });
  
  // Создание новой комнаты
  socket.on('create_room', (data) => {
    try {
      const { roomName } = data;
      const user = users.get(socket.id);
      
      if (!user) {
        socket.emit('error', { message: 'Сначала войдите в систему' });
        return;
      }
      
      const roomId = Math.random().toString(36).substring(2, 8);
      const deck = shuffleDeck(generateDeck());
      const trumpCard = deck[0];
      
      const room = {
        id: roomId,
        name: roomName || `Комната ${roomId}`,
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
        gamePhase: 'waiting',
        createdAt: new Date().toISOString()
      };
      
      rooms.set(roomId, room);
      socket.join(roomId);
      
      // Отправляем ID комнаты только создателю
      socket.emit('room_created', { roomId: roomId });
      
      // Отправляем обновление состояния комнаты
      socket.emit('game_update', room);
      
      // Отправляем обновленный список комнат всем
      sendRoomsList();
      
      console.log('Комната создана:', roomId, 'Название:', room.name, 'Пользователь:', user.name);
    } catch (error) {
      console.error('Ошибка при создании комнаты:', error);
      socket.emit('error', { message: 'Ошибка при создании комнаты' });
    }
  });
  
  // Подключение к комнате
  socket.on('join_room', (roomId) => {
    try {
      const room = rooms.get(roomId);
      const user = users.get(socket.id);
      
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }
      
      if (room.players.length >= 2) {
        socket.emit('error', { message: 'Комната заполнена' });
        return;
      }
      
      if (!user) {
        socket.emit('error', { message: 'Сначала войдите в систему' });
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
      room.gameStarted = true;
      
      socket.join(roomId);
      
      // Отправляем обновление всем клиентам в комнате
      io.to(roomId).emit('game_update', room);
      
      // Отправляем обновленный список комнат всем
      sendRoomsList();
      
      console.log('Пользователь присоединился к комнате:', roomId);
    } catch (error) {
      console.error('Ошибка при присоединении к комнате:', error);
      socket.emit('error', { message: 'Ошибка при присоединении к комнате' });
    }
  });
  
  // Размещение ставки
  socket.on('place_bet', (data) => {
    try {
      const { roomId, amount } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        socket.emit('error', { message: 'Игрок не найден в комнате' });
        return;
      }
      
      if (player.mafs < amount) {
        socket.emit('bet_result', { success: false, message: 'Недостаточно монет' });
        return;
      }
      
      // Вычитаем ставку
      player.mafs -= amount;
      room.betAmount = amount;
      
      // Переходим к фазе атаки
      room.gamePhase = 'attacking';
      room.currentPlayer = 0; // Первый игрок начинает атаку
      
      // Отправляем результат ставки
      socket.emit('bet_result', { success: true });
      
      // Отправляем обновление игры всем игрокам
      io.to(roomId).emit('game_update', room);
      
      console.log(`Ставка размещена: ${amount} монет в комнате ${roomId}`);
    } catch (error) {
      console.error('Ошибка при размещении ставки:', error);
      socket.emit('bet_result', { success: false, message: 'Ошибка при размещении ставки' });
    }
  });
  
  // Обработка атаки
socket.on('attack', (data) => {
  try {
    const { roomId, card } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    
    if (room.gamePhase !== 'attacking') {
      socket.emit('error', { message: 'Сейчас не фаза атаки' });
      return;
    }
    
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== room.currentPlayer) {
      socket.emit('error', { message: 'Сейчас не ваш ход' });
      return;
    }
    
    const player = room.players[playerIndex];
    // Проверяем, есть ли карта у игрока
    const cardIndex = player.cards.findIndex(c => 
      c.value === card.value && c.suit === card.suit
    );
    
    if (cardIndex === -1) {
      socket.emit('error', { message: 'У вас нет этой карты' });
      return;
    }
    
    // Убираем карту из руки игрока
    player.cards.splice(cardIndex, 1);
    
    // Добавляем карту на стол
    room.table.push({
      card,
      player: playerIndex,
      type: 'attack'
    });
    
    // Переходим к фазе защиты, НО НЕ МЕНЯЕМ ТЕКУЩЕГО ИГРОКА
    // Защищающимся будет следующий игрок
    room.gamePhase = 'defending';
    
    // Отправляем обновление игры всем игрокам
    io.to(roomId).emit('game_update', room);
    
    console.log(`Игрок ${player.name} атаковал картой ${card.value}${card.suit}`);
  } catch (error) {
    console.error('Ошибка при атаке:', error);
    socket.emit('error', { message: 'Ошибка при атаке' });
  }
});
  
// Защита
socket.on('defend', (data) => {
  try {
    const { roomId, card } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    
    if (room.gamePhase !== 'defending') {
      socket.emit('error', { message: 'Сейчас не фаза защиты' });
      return;
    }
    
    // Защищающийся - это следующий игрок после атакующего
    const defenderIndex = (room.currentPlayer + 1) % room.players.length;
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    
    if (playerIndex !== defenderIndex) {
      socket.emit('error', { message: 'Сейчас не ваша очередь защищаться' });
      return;
    }
    
    const player = room.players[playerIndex];
    // Берем последнюю атакующую карту
    const attackingCards = room.table.filter(item => item.type === 'attack');
    const lastAttackCard = attackingCards[attackingCards.length - 1].card;
    
    // Проверяем, может ли карта побить атакующую
    const canBeat = (
      card.suit === room.trumpCard.suit && lastAttackCard.suit !== room.trumpCard.suit
    ) || (
      card.suit === lastAttackCard.suit && getCardValue(card.value) > getCardValue(lastAttackCard.value)
    );
    
    if (!canBeat) {
      socket.emit('error', { message: 'Эта карта не может побить атакующую' });
      return;
    }
    
    // Проверяем, есть ли карта у игрока
    const cardIndex = player.cards.findIndex(c => 
      c.value === card.value && c.suit === card.suit
    );
    
    if (cardIndex === -1) {
      socket.emit('error', { message: 'У вас нет этой карты' });
      return;
    }
    
    // Убираем карту из руки игрока
    player.cards.splice(cardIndex, 1);
    
    // Добавляем карту на стол
    room.table.push({
      card,
      player: playerIndex,
      type: 'defense'
    });
    
    // Проверяем, закончилась ли защита
    const attackCardsCount = room.table.filter(item => item.type === 'attack').length;
    const defenseCardsCount = room.table.filter(item => item.type === 'defense').length;
    
    if (attackCardsCount === defenseCardsCount) {
      // Все атаки отбиты, можно завершить раунд
      room.gamePhase = 'attacking';
      // Ход переходит к следующему игроку (защищавшемуся)
      room.currentPlayer = defenderIndex;
    }
    
    // Отправляем обновление игры
    io.to(roomId).emit('game_update', room);
    
    console.log(`Игрок ${player.name} защитился картой ${card.value}${card.suit}`);
  } catch (error) {
    console.error('Ошибка при защите:', error);
    socket.emit('error', { message: 'Ошибка при защите' });
  }
});
  
 // Завершение раунда (Бито)
socket.on('bito', (roomId) => {
  try {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    
    // Проверяем, что событие вызвал атакующий игрок
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    
    if (playerIndex !== room.currentPlayer) {
      socket.emit('error', { message: 'Только атакующий может завершить раунд' });
      return;
    }
    
    // Завершаем раунд
    room.table = [];
    room.gamePhase = 'attacking';
    // Ход переходит к защищавшемуся игроку (следующему)
    room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
    
    // Добираем карты
    room.players.forEach(player => {
      while (player.cards.length < 6 && room.deck.length > 0) {
        player.cards.push(room.deck.shift());
      }
    });
    
    // Отправляем обновление игры
    io.to(roomId).emit('game_update', room);
    
    console.log(`Раунд завершен. Ход переходит к игроку ${room.currentPlayer}`);
  } catch (error) {
    console.error('Ошибка при завершении раунда:', error);
    socket.emit('error', { message: 'Ошибка при завершении раунда' });
  }
});
  
  // Взять карты
  socket.on('take_cards', (roomId) => {
    try {
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }
      
      if (room.gamePhase !== 'defending') {
        socket.emit('error', { message: 'Сейчас не фаза защиты' });
        return;
      }
      
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      // Проверяем, что это защищающийся игрок
      if (playerIndex !== room.currentPlayer) {
        socket.emit('error', { message: 'Сейчас не ваша очередь защищаться' });
        return;
      }
      
      // Игрок берет все карты со стола
      const defender = room.players[playerIndex];
      room.table.forEach(item => {
        defender.cards.push(item.card);
      });
      
      // Очищаем стол
      room.table = [];
      
      // Переход хода к следующему игроку (атакующему)
      room.gamePhase = 'attacking';
      room.currentPlayer = (playerIndex + 1) % room.players.length;
      
      // Добираем карты
      room.players.forEach(player => {
        while (player.cards.length < 6 && room.deck.length > 0) {
          player.cards.push(room.deck.shift());
        }
      });
      
      // Отправляем обновление игры
      io.to(roomId).emit('game_update', room);
      
      console.log(`Игрок ${defender.name} взял карты`);
    } catch (error) {
      console.error('Ошибка при взятии карт:', error);
      socket.emit('error', { message: 'Ошибка при взятии карт' });
    }
  });
  
  // Пас
  socket.on('pass', (roomId) => {
    try {
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }
      
      if (room.gamePhase !== 'attacking') {
        socket.emit('error', { message: 'Сейчас не фаза атаки' });
        return;
      }
      
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== room.currentPlayer) {
        socket.emit('error', { message: 'Сейчас не ваш ход' });
        return;
      }
      
      // Переход хода к следующему игроку
      room.currentPlayer = (room.currentPlayer + 1) % 2;
      
      // Если стол пустой, начинаем новую атаку
      if (room.table.length === 0) {
        room.gamePhase = 'attacking';
      }
      
      // Отправляем обновление игры
      io.to(roomId).emit('game_update', room);
      
      console.log(`Игрок ${room.players[playerIndex].name} пасует`);
    } catch (error) {
      console.error('Ошибка при пасе:', error);
      socket.emit('error', { message: 'Ошибка при пасе' });
    }
  });
  
  // Принудительное продолжение игры
  socket.on('force_continue', (data) => {
    try {
      const { roomId } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }
      
      if (room.gamePhase === 'betting') {
        // Пропускаем фазу ставки и переходим к атаке
        room.gamePhase = 'attacking';
        room.currentPlayer = 0;
        
        console.log(`Принудительное продолжение игры в комнате ${roomId}`);
        
        // Отправляем обновление игры
        io.to(roomId).emit('game_update', room);
      }
    } catch (error) {
      console.error('Ошибка при принудительном продолжении:', error);
      socket.emit('error', { message: 'Ошибка при продолжении игры' });
    }
  });
  
  // Обработка отключения
  socket.on('disconnect', (reason) => {
    console.log('Пользователь отключился:', socket.id, 'Причина:', reason);
    
    try {
      // Удаляем пользователя из всех комнат
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          // Уведомляем другого игрока о отключении
          room.players.splice(playerIndex, 1);
          io.to(roomId).emit('player_disconnected', { message: 'Игрок отключился' });
          
          // Если комната пустая, удаляем ее
          if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log('Комната удалена:', roomId);
          } else {
            // Отправляем обновление состояния игры
            io.to(roomId).emit('game_update', room);
          }
          
          break;
        }
      }
      
      // Удаляем пользователя
      users.delete(socket.id);
      
      // Отправляем обновленный список комнат
      sendRoomsList();
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
  console.log(`Доступные API endpoints:`);
  console.log(`- GET /api - Информация о сервере`);
  console.log(`- GET /api/status - Статус сервера`);
  console.log(`- GET /api/health - Health check`);
  console.log(`CORS разрешён для: https://fool-game-client.onrender.com`);
});

// Экспорт для тестирования
module.exports = app;
