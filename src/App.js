import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

// Стилизация компонентов
const styles = {
  // ... (стили остаются без изменений)
};

// Error Boundary для отлова ошибок
class ErrorBoundary extends React.Component {
  // ... (код ErrorBoundary без изменений)
}

// Компонент карты
const Card = React.memo(({ value, suit, onClick, style = {} }) => {
  // ... (код Card без изменений)
});

// Основной компонент игры
const FoolGame = ({ user, socket, onReconnect, connectionStatus }) => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [gamePhase, setGamePhase] = useState('lobby');
  const [error, setError] = useState('');
  const [betStatus, setBetStatus] = useState('idle');
  const betTimeoutRef = useRef(null);
  const wakeUpIntervalRef = useRef(null);

  // Функция для "пробуждения" сервера
  const wakeUpServer = useCallback(() => {
    if (socket && socket.connected) {
      socket.emit('ping', { timestamp: Date.now() });
    }
  }, [socket]);

  // Настройка интервала для "пробуждения" сервера
  useEffect(() => {
    wakeUpIntervalRef.current = setInterval(wakeUpServer, 8000);
    
    return () => {
      if (wakeUpIntervalRef.current) {
        clearInterval(wakeUpIntervalRef.current);
      }
      if (betTimeoutRef.current) {
        clearTimeout(betTimeoutRef.current);
      }
    };
  }, [wakeUpServer]);

  // Обработка сообщений от сервера
  useEffect(() => {
    if (!socket) {
      setError('Нет подключения к серверу');
      return;
    }
    
    console.log('Настройка обработчиков событий сокета для комнаты');
    
    const handleGameUpdate = (state) => {
      console.log('Получено обновление игры:', state);
      setGameState(state);
      setGamePhase(state.gamePhase);
      setError('');
      setBetStatus('idle');
      
      if (betTimeoutRef.current) {
        clearTimeout(betTimeoutRef.current);
        betTimeoutRef.current = null;
      }
    };
    
    const handleRoomCreated = (id) => {
      console.log('Комната создана успешно, ID:', id);
      setRoomId(id);
      setGamePhase('waiting');
      setError('');
    };
    
    const handlePlayerDisconnected = () => {
      console.log('Игрок отключился');
      setGamePhase('lobby');
      setGameState(null);
      setError('Соперник отключился. Возвращаемся в лобби.');
    };
    
    const handleSocketError = (message) => {
      console.error('Ошибка сокета:', message);
      setError(message);
    };
    
    const handleConnect = () => {
      console.log('Подключено к серверу');
      setError('');
      
      if (user) {
        console.log('Отправка данных пользователя на сервер');
        socket.emit('user_login', user);
      }
    };
    
    const handleConnected = (data) => {
      console.log('Получено подтверждение от сервера:', data);
      setError('');
    };
    
    const handleDisconnect = () => {
      console.log('Отключено от сервера');
      setError('Отключено от сервера. Попытка переподключения...');
    };

    const handlePong = () => {
      console.log('Сервер активен');
    };
    
    const handleBetResult = (result) => {
      console.log('Результат ставки:', result);
      if (result.success) {
        setBetStatus('success');
      } else {
        setBetStatus('error');
        setError(result.message || 'Ошибка при размещении ставки');
      }
    };

    const handleLoginSuccess = (userData) => {
      console.log('Успешный вход пользователя:', userData);
      // Сервер может изменить данные пользователя, но мы не обновляем состояние,
      // так как это должно обрабатываться в компоненте App
    };
    
    // Назначаем обработчики событий
    socket.on('connect', handleConnect);
    socket.on('connected', handleConnected);
    socket.on('disconnect', handleDisconnect);
    socket.on('game_update', handleGameUpdate);
    socket.on('room_created', handleRoomCreated);
    socket.on('player_disconnected', handlePlayerDisconnected);
    socket.on('error', handleSocketError);
    socket.on('pong', handlePong);
    socket.on('bet_result', handleBetResult);
    socket.on('login_success', handleLoginSuccess);
    
    // Инициализируем подключение
    if (socket.disconnected) {
      socket.connect();
    }
    
    // Очистка обработчиков при размонтировании
    return () => {
      console.log('Очистка обработчиков событий');
      socket.off('connect', handleConnect);
      socket.off('connected', handleConnected);
      socket.off('disconnect', handleDisconnect);
      socket.off('game_update', handleGameUpdate);
      socket.off('room_created', handleRoomCreated);
      socket.off('player_disconnected', handlePlayerDisconnected);
      socket.off('error', handleSocketError);
      socket.off('pong', handlePong);
      socket.off('bet_result', handleBetResult);
      socket.off('login_success', handleLoginSuccess);
    };
  }, [socket, user]);
  
  // Размещение ставки с таймаутом
  useEffect(() => {
    if (gamePhase === 'betting' && socket && socket.connected && betStatus === 'idle') {
      setBetStatus('placing');
      const fixedBetAmount = 10;
      console.log('Автоматическое размещение ставки:', fixedBetAmount, 'монет');
      
      socket.emit('place_bet', { roomId, amount: fixedBetAmount });
      
      betTimeoutRef.current = setTimeout(() => {
        console.log('Таймаут ставки - продолжаем игру');
        setBetStatus('success');
        
        setTimeout(() => {
          if (gamePhase === 'betting') {
            console.log('Принудительный переход от фазы ставок');
            socket.emit('force_continue', { roomId });
          }
        }, 1000);
      }, 5000);
    }
    
    return () => {
      if (betTimeoutRef.current) {
        clearTimeout(betTimeoutRef.current);
        betTimeoutRef.current = null;
      }
    };
  }, [gamePhase, roomId, socket, betStatus]);

  // Принудительное продолжение игры при застревании
  const forceContinueGame = useCallback(() => {
    if (socket && socket.connected) {
      console.log('Принудительное продолжение игры');
      socket.emit('force_continue', { roomId });
      setBetStatus('success');
    }
  }, [socket, roomId]);

  // Создание комнаты
  const createRoom = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    console.log('Отправка запроса на создание комнаты...');
    socket.emit('create_room');
  };

  // Подключение к комнате
  const joinRoom = () => {
    if (!roomId) {
      setError('Введите ID комнаты');
      return;
    }
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    console.log('Присоединение к комнате:', roomId);
    socket.emit('join_room', roomId);
  };

  // Атака
  const attack = () => {
    if (!selectedCard) {
      setError('Выберите карту для атаки');
      return;
    }
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    socket.emit('attack', { roomId, card: selectedCard });
    setSelectedCard(null);
  };

  // Защита
  const defend = () => {
    if (!selectedCard) {
      setError('Выберите карту для защиты');
      return;
    }
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    socket.emit('defend', { roomId, card: selectedCard });
    setSelectedCard(null);
  };

  // Взять карты
  const takeCards = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    socket.emit('take_cards', roomId);
  };

  // Пас
  const pass = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    socket.emit('pass', roomId);
  };

  // Рендер карт игрока
  const renderPlayerCards = useCallback(() => {
    if (!gameState) return null;
    
    const playerIndex = gameState.players.findIndex(p => p.id === user.id);
    if (playerIndex === -1) return null;
    
    return gameState.players[playerIndex].cards.map((card, index) => (
      <Card
        key={`${card.value}-${card.suit}-${index}`}
        value={card.value}
        suit={card.suit}
        onClick={() => {
          if (gameState.gamePhase === 'attacking' && gameState.currentPlayer === playerIndex) {
            setSelectedCard(card);
          } else if (gameState.gamePhase === 'defending' && gameState.currentPlayer === playerIndex) {
            setSelectedCard(card);
          }
        }}
        style={{
          opacity: selectedCard && selectedCard.value === card.value && selectedCard.suit === card.suit ? 0.7 : 1,
          border: selectedCard && selectedCard.value === card.value && selectedCard.suit === card.suit ? '2px solid yellow' : 'none'
        }}
      />
    ));
  }, [gameState, selectedCard, user.id]);

  // Рендер карт оппонента
  const renderOpponentCards = useCallback(() => {
    if (!gameState) return null;
    
    const playerIndex = gameState.players.findIndex(p => p.id === user.id);
    if (playerIndex === -1) return null;
    
    const opponentIndex = (playerIndex + 1) % 2;
    
    return Array.from({ length: gameState.players[opponentIndex].cards.length }).map((_, index) => (
      <div
        key={index}
        style={{
          ...styles.card,
          background: 'linear-gradient(45deg, #d40000, #1c8c68)',
          color: '#fff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '20px'
        }}
      >
        ♠
      </div>
    ));
  }, [gameState, user.id]);

  // Рендер карт на столе
  const renderTableCards = useCallback(() => {
    if (!gameState || gameState.table.length === 0) return null;
    
    return gameState.table.map((item, index) => (
      <Card
        key={`table-${index}-${item.card.value}-${item.card.suit}`}
        value={item.card.value}
        suit={item.card.suit}
      />
    ));
  }, [gameState]);

  // Рендер козырной карта
  const renderTrumpCard = useCallback(() => {
    if (!gameState || !gameState.trumpCard) return null;
    
    return (
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <h3>Козырь: {gameState.trumpCard.suit}</h3>
        <Card value={gameState.trumpCard.value} suit={gameState.trumpCard.suit} />
      </div>
    );
  }, [gameState]);

  // Если нет подключения
  if (connectionStatus === 'disconnected') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Дурак онлайн</h1>
          <p>Нет подключения к серверу</p>
        </div>
        <div style={styles.lobby}>
          <div style={styles.error}>
            {error || 'Сервер недоступен. Попытка переподключения...'}
          </div>
          <button 
            style={styles.reconnectButton}
            onClick={onReconnect}
          >
            Переподключиться
          </button>
        </div>
      </div>
    );
  }

  // Лобби игры
  if (gamePhase === 'lobby') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Дурак онлайн</h1>
          <p>Играйте с реальными соперниками</p>
          {connectionStatus === 'connecting' && <p>Подключение к серверу...</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
        
        <div style={styles.lobby}>
          <button 
            style={{
              ...styles.button,
              ...(connectionStatus !== 'connected' ? styles.buttonDisabled : {})
            }}
            onClick={createRoom} 
            disabled={connectionStatus !== 'connected'}
          >
            Создать комнату
          </button>
          
          <div style={{ margin: '20px 0' }}>
            <h3>Или присоединиться к комнате:</h3>
            <input
              type="text"
              placeholder="ID комнаты"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: 'none',
                fontSize: '16px',
                marginRight: '10px'
              }}
            />
            <button 
              style={{
                ...styles.button,
                ...(connectionStatus !== 'connected' ? styles.buttonDisabled : {})
              }}
              onClick={joinRoom} 
              disabled={connectionStatus !== 'connected'}
            >
              Присоединиться
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ожидание второго игрока
  if (gamePhase === 'waiting') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Ожидание соперника</h1>
          <p>Пригласите друга, отправив ему ID комнаты</p>
          {error && <p style={styles.error}>{error}</p>}
        </div>
        
        <div style={styles.lobby}>
          <div style={styles.roomId}>ID комнаты: {roomId}</div>
          <p>Ожидаем второго игрока...</p>
        </div>
      </div>
    );
  }

  // Фаза ставок
  if (gamePhase === 'betting') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Размещение ставки</h1>
          {error && <p style={styles.error}>{error}</p>}
        </div>
        
        <div style={styles.bettingPanel}>
          <h3 style={styles.bettingTitle}>
            {betStatus === 'placing' && 'Размещаем ставку 10 монет...'}
            {betStatus === 'success' && 'Ставка размещена! Продолжаем игру...'}
            {betStatus === 'error' && 'Ошибка ставки'}
          </h3>
          
          <div style={styles.betControls}>
            <div style={styles.betAmount}>10 монет</div>
            
            {betStatus === 'placing' && (
              <div style={{ marginTop: '15px' }}>
                <div style={styles.loading}>Ожидаем подтверждения...</div>
                <div style={{ fontSize: '14px', marginTop: '10px', color: '#ccc' }}>
                  Если игра зависла, нажмите "Продолжить"
                </div>
              </div>
            )}
            
            {betStatus === 'error' && (
              <button 
                style={styles.button}
                onClick={() => {
                  setBetStatus('idle');
                  setError('');
                }}
              >
                Попробовать снова
              </button>
            )}
          </div>
          
          {(betStatus === 'placing' || betStatus === 'error') && (
            <div style={{ marginTop: '20px' }}>
              <button 
                style={styles.reconnectButton}
                onClick={forceContinueGame}
              >
                Продолжить игру
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Основной игровой интерфейс
  if (!gameState) return <div style={styles.loading}>Загрузка игры...</div>;

  const playerIndex = gameState.players.findIndex(p => p.id === user.id);
  if (playerIndex === -1) return <div>Ошибка: игрок не найден</div>;

  const isPlayerTurn = gameState.currentPlayer === playerIndex;
  const opponentIndex = (playerIndex + 1) % 2;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Дурак онлайн - Комната: {roomId}</h1>
        <p>{isPlayerTurn ? 'Ваш ход' : 'Ход соперника'}</p>
        {error && <p style={styles.error}>{error}</p>}
      </div>
      
      <div style={styles.gameArea}>
        <div style={styles.playersContainer}>
          {/* Панель оппонента */}
          <div style={styles.playerPanel}>
            <div style={styles.playerHeader}>
              <h2 style={styles.playerName}>{gameState.players[opponentIndex].name}</h2>
              <div style={styles.playerStats}>
                <div style={styles.stat}>монеты: {gameState.players[opponentIndex].mafs}</div>
                <div style={styles.stat}>Карты: {gameState.players[opponentIndex].cards.length}</div>
              </div>
            </div>
            <div style={styles.cardsContainer}>
              {renderOpponentCards()}
            </div>
          </div>
          
          {/* Панель текущего пользователя */}
          <div style={styles.playerPanel}>
            <div style={styles.playerHeader}>
              <h2 style={styles.playerName}>{gameState.players[playerIndex].name}</h2>
              <div style={styles.playerStats}>
                <div style={styles.stat}>монеты: {gameState.players[playerIndex].mafs}</div>
                <div style={styles.stat}>Карты: {gameState.players[playerIndex].cards.length}</div>
              </div>
            </div>
            <div style={styles.cardsContainer}>
              {renderPlayerCards()}
            </div>
          </div>
        </div>
        
        {/* Игровой стол */}
        <div style={styles.table}>
          <h3 style={styles.tableTitle}>Игровой стол</h3>
          <div style={styles.tableCards}>
            {renderTableCards()}
          </div>
        </div>
        
        {renderTrumpCard()}
        
        {/* Элементы управления */}
        <div style={styles.controls}>
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'attacking' && isPlayerTurn) ? styles.buttonDisabled : {})
            }}
            onClick={attack}
            disabled={!(gameState.gamePhase === 'attacking' && isPlayerTurn)}
          >
            Атаковать
          </button>
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'defending' && isPlayerTurn) ? styles.buttonDisabled : {})
            }}
            onClick={defend}
            disabled={!(gameState.gamePhase === 'defending' && isPlayerTurn)}
          >
            Защищаться
          </button>
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'defending' && isPlayerTurn) ? styles.buttonDisabled : {})
            }}
            onClick={takeCards}
            disabled={!(gameState.gamePhase === 'defending' && isPlayerTurn)}
          >
            Взять
          </button>
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'attacking' && isPlayerTurn) ? styles.buttonDisabled : {})
            }}
            onClick={pass}
            disabled={!(gameState.gamePhase === 'attacking' && isPlayerTurn)}
          >
            Пас
          </button>
        </div>
        
        {/* Сообщения игры */}
        <div style={styles.message}>
          {gameState.gamePhase === 'attacking' && isPlayerTurn && 'Ваш ход. Выберите карту для атаки'}
          {gameState.gamePhase === 'attacking' && !isPlayerTurn && 'Ожидание хода соперника...'}
          {gameState.gamePhase === 'defending' && isPlayerTurn && 'Ваша очередь защищаться'}
          {gameState.gamePhase === 'defending' && !isPlayerTurn && 'Соперник защищается...'}
        </div>
      </div>
    </div>
  );
};

// Компонент аутентификации
const LoginForm = ({ onLogin, connectionStatus }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Введите имя пользователя');
      return;
    }
    
    if (connectionStatus !== 'connected') {
      setError('Нет подключения к серверу');
      return;
    }
    
    onLogin({
      name: username,
      mafs: 1500
    });
  };
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#1a5f7a'
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        padding: '30px',
        borderRadius: '15px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        width: '300px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#fff' }}>Вход в игру</h2>
        
        {error && <div style={styles.error}>{error}</div>}
        
        <div style={{ 
          marginBottom: '15px',
          padding: '10px',
          backgroundColor: connectionStatus === 'connected' ? '#4caf50' : 
                         connectionStatus === 'connecting' ? '#ff9800' : '#f44336',
          borderRadius: '5px',
          color: 'white',
          fontSize: '14px'
        }}>
          Статус: {connectionStatus === 'connected' ? 'Подключено' : 
                  connectionStatus === 'connecting' ? 'Подключение...' : 'Отключено'}
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: 'none',
              fontSize: '16px'
            }}
            required
            disabled={connectionStatus !== 'connected'}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: 'none',
              fontSize: '16px'
            }}
            required
            disabled={connectionStatus !== 'connected'}
          />
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: '5px',
            background: connectionStatus === 'connected' ? 
                       'linear-gradient(to right, #ffcc00, #ff9900)' : '#666',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: connectionStatus === 'connected' ? 'pointer' : 'not-allowed'
          }}
          disabled={connectionStatus !== 'connected'}
        >
          {connectionStatus === 'connected' ? 'Войти' : 'Ожидание подключения...'}
        </button>
      </form>
    </div>
  );
};

// Главный компонент приложения
function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [key, setKey] = useState(0);

  const createSocketConnection = useCallback(() => {
    if (socket) {
      socket.disconnect();
      console.log('Закрыто предыдущее соединение');
    }

    const serverUrl = process.env.REACT_APP_SERVER_URL || 'https://fool-game-bte4.onrender.com';
    console.log('Создание нового подключения к серверу:', serverUrl);
    
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 15000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      forceNew: true
    });
    
    newSocket.on('connect', () => {
      console.log('Сокет подключен к серверу');
      setConnectionStatus('connected');
    });
    
    newSocket.on('connected', (data) => {
      console.log('Получено подтверждение от сервера:', data);
      setConnectionStatus('connected');
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Ошибка подключения к серверу:', error);
      setConnectionStatus('disconnected');
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('Отключились от сервера:', reason);
      setConnectionStatus('disconnected');
    });

    newSocket.on('error', (error) => {
      console.error('Ошибка сокета:', error);
      setConnectionStatus('disconnected');
    });
    
    setSocket(newSocket);
    setKey(prev => prev + 1);
  }, [socket]);

  useEffect(() => {
    createSocketConnection();
    
    return () => {
      if (socket) {
        console.log('Очистка сокета при размонтировании');
        socket.disconnect();
      }
    };
  }, []);

  const handleLogin = (userData) => {
    console.log('Пользователь вошел:', userData);
    // Генерируем ID на клиенте, но сервер перезапишет его на socket.id
    const userWithId = {
      ...userData,
      id: Math.random().toString(36).substring(2, 9) // временный ID
    };
    setUser(userWithId);
    
    if (socket && socket.connected) {
      console.log('Отправка данных пользователя на сервер...');
      socket.emit('user_login', userWithId);
    } else {
      console.error('Сокет не подключен, невозможно отправить данные');
      // setError ('Нет подключения к серверу');
    }
  };

  const handleReconnect = () => {
    console.log('Принудительное переподключение');
    setConnectionStatus('connecting');
    createSocketConnection();
  };

  return (
    <ErrorBoundary>
      <div style={{
        ...styles.connectionStatus,
        backgroundColor: connectionStatus === 'connected' ? '#4caf50' : 
                        connectionStatus === 'connecting' ? '#ff9800' : '#f44336'
      }}>
        {connectionStatus === 'connected' ? 'Подключено' : 
         connectionStatus === 'connecting' ? 'Подключение...' : 'Отключено'}
      </div>
      
      {user ? (
        <FoolGame 
          key={key}
          user={user} 
          socket={socket} 
          onReconnect={handleReconnect}
          connectionStatus={connectionStatus}
        />
      ) : (
        <LoginForm onLogin={handleLogin} connectionStatus={connectionStatus} />
      )}
    </ErrorBoundary>
  );
}

export default App;
