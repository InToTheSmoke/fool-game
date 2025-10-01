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

// Функция для проверки, может ли карта побить другую карту
const canCardBeat = (card, targetCard, trumpSuit) => {
  // Если карта - козырь, а целевая карта - нет, то может побить
  if (card.suit === trumpSuit && targetCard.suit !== trumpSuit) {
    return true;
  }
  
  // Если обе карты одной масти, сравниваем значения
  if (card.suit === targetCard.suit) {
    return getCardValue(card.value) > getCardValue(targetCard.value);
  }
  
  // Если карта не козырь, а целевая карта - козырь, то не может побить
  if (card.suit !== trumpSuit && targetCard.suit === trumpSuit) {
    return false;
  }
  
  // Карты разных мастей, и ни одна не козырь - не может побить
  return false;
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

// Функция для добора карт игрокам
const refillPlayersCards = (room) => {
  room.players.forEach(player => {
    while (player.cards.length < 6 && room.deck.length > 0) {
      player.cards.push(room.deck.shift());
    }
  });
};

// Функция для завершения раунда и смены ролей
const completeRound = (room, winnerIndex) => {
  // Очищаем стол
  room.table = [];
  
  // Добираем карты
  refillPlayersCards(room);
  
  // Определяем нового атакующего и защищающегося
  if (winnerIndex !== -1) {
    // Победитель раунда становится атакующим
    room.currentPlayer = winnerIndex;
    room.defenderIndex = (winnerIndex + 1) % 2;
  } else {
    // Если победителя нет (ничья), меняем роли
    room.currentPlayer = room.defenderIndex;
    room.defenderIndex = (room.defenderIndex + 1) % 2;
  }
  
  room.gamePhase = 'attacking';
  
  // Проверяем конец игры
  checkGameEnd(room);
};

// Функция для проверки окончания игры
const checkGameEnd = (room) => {
  // Если у одного из игроков закончились карты и в колоде пусто
  const player1Cards = room.players[0].cards.length;
  const player2Cards = room.players[1].cards.length;
  const deckEmpty = room.deck.length === 0;
  
  if (deckEmpty && (player1Cards === 0 || player2Cards === 0)) {
    // Определяем победителя
    let winnerIndex = -1;
    if (player1Cards === 0 && player2Cards > 0) {
      winnerIndex = 0;
    } else if (player2Cards === 0 && player1Cards > 0) {
      winnerIndex = 1;
    }
    // Если у обоих 0 карт - ничья
    
    room.gamePhase = 'finished';
    room.winner = winnerIndex;
    
    // Отправляем уведомление о конце игры
    io.to(room.id).emit('game_finished', {
      winner: winnerIndex,
      winnerName: winnerIndex !== -1 ? room.players[winnerIndex].name : 'Ничья'
    });
  }
};

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
      const trumpCard = deck[deck.length - 1]; // Берем последнюю карту как козырь
      
      const room = {
        id: roomId,
        name: roomName || `Комната ${roomId}`,
        players: [{
          id: socket.id,
          name: user.name,
          mafs: user.mafs,
          cards: deck.slice(0, 6), // Первые 6 карт
          isActive: true
        }],
        deck: deck.slice(6, deck.length - 1), // Остальные карты кроме козыря
        trumpCard,
        table: [],
        currentPlayer: 0, // Индекс атакующего игрока
        defenderIndex: -1, // Индекс защищающегося игрока
        betAmount: 100,
        gameStarted: false,
        gamePhase: 'waiting',
        attacksCount: 0, // Количество атак в текущем раунде
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
      console.error('Ошибка при создании комната:', error);
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
      
      // Устанавливаем защищающегося игрока (второй игрок)
      room.defenderIndex = 1;
      room.currentPlayer = 0; // Первый игрок атакует
      
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
      
      // Если это первая атака, можно использовать любую карту
      if (room.table.length === 0) {
        // Для первой атаки можно использовать любую карту
        room.attacksCount = 1;
      } else {
        // Для последующих атак карта должна совпадать по достоинству с одной из карт на столе
        const canAddToAttack = room.table.some(item => 
          item.card.value === card.value
        );
        
        if (!canAddToAttack) {
          socket.emit('error', { message: 'Можно подкидывать только карты того же достоинства, что уже есть на столе' });
          return;
        }
        room.attacksCount++;
      }
      
      // Убираем карту из руки игрока
      player.cards.splice(cardIndex, 1);
      
      // Добавляем карту на стол
      room.table.push({
        card,
        player: playerIndex,
        type: 'attack'
      });
      
      // Переходим к фазе защиты
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
      
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== room.defenderIndex) {
        socket.emit('error', { message: 'Сейчас не ваша очередь защищаться' });
        return;
      }
      
      const player = room.players[playerIndex];
      
      // Находим последнюю неотбитую атакующую карту
      const attackCards = room.table.filter(item => item.type === 'attack');
      const defenseCards = room.table.filter(item => item.type === 'defense');
      
      if (defenseCards.length >= attackCards.length) {
        socket.emit('error', { message: 'Все атаки уже отбиты' });
        return;
      }
      
      const targetAttackCard = attackCards[defenseCards.length].card;
      
      // Проверяем, может ли карта побить атакующую
      const canBeat = canCardBeat(card, targetAttackCard, room.trumpCard.suit);
      
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
      
      // Проверяем, все ли атаки отбиты
      if (room.table.filter(item => item.type === 'defense').length === room.attacksCount) {
        // Все атаки отбиты, можно завершить раунд
        room.gamePhase = 'round_end';
      }
      
      // Отправляем обновление игры
      io.to(roomId).emit('game_update', room);
      
      console.log(`Игрок ${player.name} защитился картой ${card.value}${card.suit}`);
    } catch (error) {
      console.error('Ошибка при защите:', error);
      socket.emit('error', { message: 'Ошибка при защите' });
    }
  });
  
  // Подкинуть карту (дополнительная атака)
  socket.on('add_attack', (data) => {
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
      
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== room.currentPlayer) {
        socket.emit('error', { message: 'Только атакующий может подкидывать карты' });
        return;
      }
      
      // Проверяем, что у защищающегося достаточно карт для отбития
      const defender = room.players[room.defenderIndex];
      const currentAttacks = room.table.filter(item => item.type === 'attack').length;
      const currentDefenses = room.table.filter(item => item.type === 'defense').length;
      
      if (currentAttacks - currentDefenses >= defender.cards.length) {
        socket.emit('error', { message: 'Нельзя подкидывать больше карт, чем есть у защищающегося' });
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
      
      // Проверяем, можно ли подкинуть эту карту (должна совпадать по достоинству с одной из карт на столе)
      const canAddToAttack = room.table.some(item => 
        item.card.value === card.value
      );
      
      if (!canAddToAttack) {
        socket.emit('error', { message: 'Можно подкидывать только карты того же достоинства, что уже есть на столе' });
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
      
      room.attacksCount++;
      
      // Отправляем обновление игры
      io.to(roomId).emit('game_update', room);
      
      console.log(`Игрок ${player.name} подкинул карту ${card.value}${card.suit}`);
    } catch (error) {
      console.error('Ошибка при подкидывании карты:', error);
      socket.emit('error', { message: 'Ошибка при подкидывании карты' });
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
      
      if (room.gamePhase !== 'defending' && room.gamePhase !== 'round_end') {
        socket.emit('error', { message: 'Сейчас нельзя завершить раунд' });
        return;
      }
      
      // Завершаем раунд - защищающийся успешно отбился
      completeRound(room, room.defenderIndex);
      
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
      if (playerIndex !== room.defenderIndex) {
        socket.emit('error', { message: 'Сейчас не ваша очередь защищаться' });
        return;
      }
      
      // Игрок берет все карты со стола
      const defender = room.players[playerIndex];
      room.table.forEach(item => {
        defender.cards.push(item.card);
      });
      
      // Завершаем раунд - защищающийся взял карты
      completeRound(room, room.currentPlayer);
      
      // Отправляем обновление игры
      io.to(roomId).emit('game_update', room);
      
      console.log(`Игрок ${defender.name} взял карты`);
    } catch (error) {
      console.error('Ошибка при взятии карт:', error);
      socket.emit('error', { message: 'Ошибка при взятии карт' });
    }
  });
  
  // Пас (передача хода)
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
      
      // Если на столе есть карты, нельзя пасовать
      if (room.table.length > 0) {
        socket.emit('error', { message: 'Нельзя пасовать, когда на столе есть карты' });
        return;
      }
      
      // Переход хода к защищавшемуся игроку
      room.currentPlayer = room.defenderIndex;
      room.defenderIndex = (room.defenderIndex + 1) % room.players.length;
      
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
