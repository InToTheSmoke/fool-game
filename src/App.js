import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

// Стилизация компонентов
const styles = {
  container: {
    fontFamily: '"Arial", sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#1a5f7a',
    minHeight: '100vh',
    color: '#fff'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '36px',
    marginBottom: '10px',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)'
  },
  gameArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  playersContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px'
  },
  playerPanel: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '15px',
    padding: '20px',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)'
  },
  playerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  playerName: {
    fontSize: '24px',
    color: '#ffcc00'
  },
  playerStats: {
    display: 'flex',
    gap: '15px'
  },
  stat: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '8px 15px',
    borderRadius: '10px'
  },
  cardsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    minHeight: '150px',
    justifyContent: 'center'
  },
  table: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '15px',
    padding: '20px',
    minHeight: '200px',
    boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.2)'
  },
  tableTitle: {
    textAlign: 'center',
    marginBottom: '15px',
    fontSize: '20px'
  },
  tableCards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    justifyContent: 'center',
    minHeight: '150px'
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  button: {
    padding: '12px 25px',
    border: 'none',
    borderRadius: '10px',
    background: 'linear-gradient(to right, #ffcc00, #ff9900)',
    color: '#000',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)'
  },
  buttonHover: {
    transform: 'translateY(-3px)',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)'
  },
  buttonDisabled: {
    background: '#666',
    cursor: 'not-allowed'
  },
  bettingPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '15px',
    padding: '20px',
    textAlign: 'center'
  },
  bettingTitle: {
    marginBottom: '15px',
    color: '#ffcc00'
  },
  betControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  betAmount: {
    fontSize: '20px',
    fontWeight: 'bold',
    minWidth: '100px'
  },
  message: {
    textAlign: 'center',
    fontSize: '20px',
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '10px',
    color: '#ffcc00'
  },
  card: {
    width: '70px',
    height: '100px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '5px',
    color: '#000',
    fontWeight: 'bold',
    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.3)',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  cardHover: {
    transform: 'translateY(-5px)'
  },
  cardRed: {
    color: '#e00'
  },
  cardTop: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    fontSize: '16px'
  },
  cardBottom: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    transform: 'rotate(180deg)',
    fontSize: '16px'
  },
  cardCenter: {
    alignSelf: 'center',
    fontSize: '24px'
  },
  lobby: {
    textAlign: 'center',
    padding: '20px'
  },
  roomId: {
    fontSize: '24px',
    margin: '20px 0',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '10px',
    borderRadius: '10px',
    display: 'inline-block'
  },
  error: {
    color: '#ff6b6b',
    textAlign: 'center',
    padding: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '5px',
    margin: '10px 0'
  },
  connectionStatus: {
    position: 'fixed',
    top: '10px',
    right: '10px',
    padding: '5px 10px',
    borderRadius: '5px',
    fontSize: '12px',
    zIndex: 1000
  }
};

// Error Boundary для отлова ошибок
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.error}>
            <h2>Что-то пошло не так.</h2>
            <details style={{ whiteSpace: 'pre-wrap', color: '#fff' }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo.componentStack}
            </details>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Компонент карты
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
  const [gamePhase, setGamePhase] = useState('lobby');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const wakeUpIntervalRef = useRef(null);

  // Функция для "пробуждения" сервера
  const wakeUpServer = useCallback(() => {
    if (socket && socket.connected) {
      // Отправляем легкий запрос для поддержания активности
      socket.emit('ping', { timestamp: Date.now() });
      console.log('Отправлен ping серверу');
    } else {
      console.log('Сервер не подключен');
    }
  }, [socket]);

  // Настройка интервала для "пробуждения" сервера
  useEffect(() => {
    // Запускаем интервал каждые 10 секунд
    wakeUpIntervalRef.current = setInterval(wakeUpServer, 10000);
    
    // Очистка интервала при размонтировании
    return () => {
      if (wakeUpIntervalRef.current) {
        clearInterval(wakeUpIntervalRef.current);
      }
    };
  }, [wakeUpServer]);

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

    const handlePong = () => {
      console.log('Сервер активен, получен pong');
    };
    
    // Назначаем обработчики событий
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game_update', handleGameUpdate);
    socket.on('room_created', handleRoomCreated);
    socket.on('player_disconnected', handlePlayerDisconnected);
    socket.on('error', handleSocketError);
    socket.on('pong', handlePong);
    
    // Очистка обработчиков при размонтировании
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game_update', handleGameUpdate);
      socket.off('room_created', handleRoomCreated);
      socket.off('player_disconnected', handlePlayerDisconnected);
      socket.off('error', handleSocketError);
      socket.off('pong', handlePong);
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

  // Размещение ставки (фиксированная ставка 10 монет)
  const placeBet = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    const fixedBetAmount = 10; // Фиксированная ставка
    console.log('Размещение ставки:', fixedBetAmount, 'монет');
    socket.emit('place_bet', { roomId, amount: fixedBetAmount });
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
          <h3 style={styles.bettingTitle}>Ставка: 10 монет</h3>
          <div style={styles.betControls}>
            <div style={styles.betAmount}>10 монет</div>
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

// Компонент аутентификации
const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Введите имя пользователя');
      return;
    }
    
    onLogin({
      id: Math.random().toString(36).substring(2, 9),
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
          />
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: '5px',
            background: 'linear-gradient(to right, #ffcc00, #ff9900)',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Войти
        </button>
      </form>
    </div>
  );
};

// Главный компонент приложения
function App() {
  const [user, setUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const socketRef = useRef(null);

  useEffect(() => {
    // Подключаемся к серверу
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'https://fool-game-bte4.onrender.com';
    console.log('Подключение к серверу:', serverUrl);
    
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    // Обработка подключения
    socketRef.current.on('connect', () => {
      console.log('Успешно подключились к серверу');
      setConnectionStatus('connected');
    });
    
    // Обработка ошибок подключения
    socketRef.current.on('connect_error', (error) => {
      console.error('Ошибка подключения к серверу:', error);
      setConnectionStatus('disconnected');
    });
    
    // Обработка отключения
    socketRef.current.on('disconnect', (reason) => {
      console.log('Отключились от сервера:', reason);
      setConnectionStatus('disconnected');
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleLogin = (userData) => {
    console.log('Пользователь вошел:', userData);
    setUser(userData);
    
    // Отправляем данные пользователя на сервер после подключения
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('user_login', userData);
    }
  };

  return (
    <ErrorBoundary>
      <div style={{
        ...styles.connectionStatus,
        backgroundColor: connectionStatus === 'connected' ? '#4caf50' : '#f44336'
      }}>
        {connectionStatus === 'connected' ? 'Подключено' : 'Отключено'}
      </div>
      
      {user ? (
        <FoolGame user={user} socket={socketRef.current} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </ErrorBoundary>
  );
}

export default App;
