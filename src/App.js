import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';

// ... (стили остаются такими же)

// Error Boundary (без изменений)
class ErrorBoundary extends React.Component {
  // ... (без изменений)
}

// Компонент карты с memo для оптимизации
const Card = React.memo(({ value, suit, onClick, style = {} }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const isRed = suit === '♥' || suit === '♦';
  const cardStyle = {
    ...styles.card,
    ...(isRed ? styles.cardRed : {}),
    ...(isHovered ? styles.cardHover : {}),
    ...style
  };
  
  return (
    <div 
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.cardTop}>
        <div>{value}</div>
        <div>{suit}</div>
      </div>
      <div style={styles.cardCenter}>{suit}</div>
      <div style={styles.cardBottom}>
        <div>{value}</div>
        <div>{suit}</div>
      </div>
    </div>
  );
});

// Основной компонент игры
const FoolGame = ({ user, socket }) => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [betAmount, setBetAmount] = useState(100);
  const [gamePhase, setGamePhase] = useState('lobby');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');

  // Обработка сообщений от сервера
  useEffect(() => {
    if (!socket) {
      setError('Нет подключения к серверу');
      return;
    }
    
    console.log('Настройка обработчиков событий сокета');
    
    const handleGameUpdate = (state) => {
      console.log('Получено обновление игры:', state);
      setGameState(state);
      setGamePhase(state.gamePhase);
      setError('');
    };
    
    const handleRoomCreated = (id) => {
      console.log('Комната создана:', id);
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
      setConnectionStatus('connected');
      setError('');
      
      // Отправляем данные пользователя после подключения
      if (user) {
        console.log('Отправка данных пользователя на сервер');
        socket.emit('user_login', user);
      }
    };
    
    const handleDisconnect = () => {
      console.log('Отключено от сервера');
      setConnectionStatus('disconnected');
      setError('Отключено от сервера. Попытка переподключения...');
    };
    
    // Назначаем обработчики событий
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game_update', handleGameUpdate);
    socket.on('room_created', handleRoomCreated);
    socket.on('player_disconnected', handlePlayerDisconnected);
    socket.on('error', handleSocketError);
    
    // Очистка обработчиков при размонтировании
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game_update', handleGameUpdate);
      socket.off('room_created', handleRoomCreated);
      socket.off('player_disconnected', handlePlayerDisconnected);
      socket.off('error', handleSocketError);
    };
  }, [socket, user]);
  
  // Создание комнаты
  const createRoom = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    console.log('Создание комнаты');
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

  // Размещение ставки
  const placeBet = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    socket.emit('place_bet', { roomId, amount: betAmount });
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

  // Рендер карт игрока с useCallback для оптимизации
  const renderPlayerCards = useCallback(() => {
    if (!gameState) return null;
    
    const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
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
  }, [gameState, selectedCard, socket.id]);

  // Рендер карт оппонента
  const renderOpponentCards = useCallback(() => {
    if (!gameState) return null;
    
    const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
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
  }, [gameState, socket.id]);

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

  // Рендер козырной карты
  const renderTrumpCard = useCallback(() => {
    if (!gameState || !gameState.trumpCard) return null;
    
    return (
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <h3>Козырь: {gameState.trumpCard.suit}</h3>
        <Card value={gameState.trumpCard.value} suit={gameState.trumpCard.suit} />
      </div>
    );
  }, [gameState]);

  // Лобби игры
  if (gamePhase === 'lobby') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Дурак онлайн</h1>
          <p>Играйте с реальными соперниками</p>
          {connectionStatus === 'connecting' && <p>Подключение к серверу...</p>}
          {connectionStatus === 'disconnected' && <p style={styles.error}>Нет подключения к серверу</p>}
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
            onMouseOver={(e) => {
              if (connectionStatus === 'connected') {
                e.target.style.transform = 'translateY(-3px)';
                e.target.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
            }}
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
              onMouseOver={(e) => {
                if (connectionStatus === 'connected') {
                  e.target.style.transform = 'translateY(-3px)';
                  e.target.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0px)';
                e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
              }}
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
          <h1 style={styles.title}>Сделайте ставку</h1>
          {error && <p style={styles.error}>{error}</p>}
        </div>
        
        <div style={styles.bettingPanel}>
          <h3 style={styles.bettingTitle}>Сделайте ставку</h3>
          <div style={styles.betControls}>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                min="10"
                max="1000"
                value={betAmount}
                onChange={(e) => setBetAmount(parseInt(e.target.value))}
                style={styles.slider}
              />
            </div>
            <div style={styles.betAmount}>{betAmount} монет</div>
            <button 
              style={styles.button}
              onClick={placeBet}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-3px)';
                e.target.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0px)';
                e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
              }}
            >
              Подтвердить ставку
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Основной игровой интерфейс
  if (!gameState) return <div>Загрузка...</div>;

  const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
  if (playerIndex === -1) return <div>Ошибка: игрок не найден</div>;

  const isPlayerTurn = gameState.currentPlayer === playerIndex;
  const opponentIndex = (playerIndex + 1) % 2;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Дурак онлайн - Комната: {roomId}</h1>
        <p>{isPlayerTurn ? 'Ваш ход' : 'Ход соперника'}</p>
        {error && <p style={styles.error}>{error}</p>}
        {connectionStatus === 'disconnected' && <p style={styles.error}>Нет подключения к серверу</p>}
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
            onMouseOver={(e) => {
              if (gameState.gamePhase === 'attacking' && isPlayerTurn) {
                e.target.style.transform = 'translateY(-3px)';
                e.target.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
            }}
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
            onMouseOver={(e) => {
              if (gameState.gamePhase === 'defending' && isPlayerTurn) {
                e.target.style.transform = 'translateY(-3px)';
                e.target.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
            }}
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
            onMouseOver={(e) => {
              if (gameState.gamePhase === 'defending' && isPlayerTurn) {
                e.target.style.transform = 'translateY(-3px)';
                e.target.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
            }}
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
            onMouseOver={(e) => {
              if (gameState.gamePhase === 'attacking' && isPlayerTurn) {
                e.target.style.transform = 'translateY(-3px)';
                e.target.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
            }}
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

// Компонент аутентификации (без изменений)
const LoginForm = ({ onLogin }) => {
  // ... (без изменений)
};

// Главный компонент приложения (без изменений)
function App() {
  // ... (без изменений)
}

export default App;
