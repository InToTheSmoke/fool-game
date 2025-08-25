import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

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
  sliderContainer: {
    width: '100%',
    maxWidth: '400px'
  },
  slider: {
    width: '100%',
    height: '10px'
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
  }
};

// Компонент карты
const Card = ({ value, suit, onClick, style = {} }) => {
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
};

// Основной компонент игры
const FoolGame = ({ user, socket }) => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [betAmount, setBetAmount] = useState(100);
  const [gamePhase, setGamePhase] = useState('lobby'); // lobby, waiting, betting, playing

  // Обработка сообщений от сервера
  useEffect(() => {
    socket.on('game_update', (state) => {
      setGameState(state);
      setGamePhase(state.gamePhase);
    });
    
    socket.on('room_created', (id) => {
      setRoomId(id);
      setGamePhase('waiting');
    });
    
    socket.on('player_disconnected', () => {
      setGamePhase('lobby');
      setGameState(null);
      alert('Соперник disconnected. Возвращаемся в лобби.');
    });
    
    socket.on('error', (message) => {
      alert(`Ошибка: ${message}`);
    });
    
    return () => {
      socket.off('game_update');
      socket.off('room_created');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [socket]);

  // Создание комнаты
  const createRoom = () => {
    socket.emit('create_room');
  };

  // Подключение к комнате
  const joinRoom = () => {
    if (!roomId) {
      alert('Введите ID комнаты');
      return;
    }
    socket.emit('join_room', roomId);
  };

  // Размещение ставки
  const placeBet = () => {
    socket.emit('place_bet', { roomId, amount: betAmount });
  };

  // Атака
  const attack = () => {
    if (!selectedCard) {
      alert('Выберите карту для атаки');
      return;
    }
    socket.emit('attack', { roomId, card: selectedCard });
    setSelectedCard(null);
  };

  // Защита
  const defend = () => {
    if (!selectedCard) {
      alert('Выберите карту для защиты');
      return;
    }
    socket.emit('defend', { roomId, card: selectedCard });
    setSelectedCard(null);
  };

  // Взять карты
  const takeCards = () => {
    socket.emit('take_cards', roomId);
  };

  // Пас
  const pass = () => {
    socket.emit('pass', roomId);
  };

  // Рендер карт игрока
  const renderPlayerCards = () => {
    if (!gameState) return null;
    
    const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return null;
    
    return gameState.players[playerIndex].cards.map((card, index) => (
      <Card
        key={index}
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
  };

  // Рендер карт оппонента
  const renderOpponentCards = () => {
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
  };

  // Рендер карт на столе
  const renderTableCards = () => {
    if (!gameState || gameState.table.length === 0) return null;
    
    return gameState.table.map((item, index) => (
      <Card
        key={index}
        value={item.card.value}
        suit={item.card.suit}
      />
    ));
  };

  // Рендер козырной карты
  const renderTrumpCard = () => {
    if (!gameState || !gameState.trumpCard) return null;
    
    return (
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <h3>Козырь: {gameState.trumpCard.suit}</h3>
        <Card value={gameState.trumpCard.value} suit={gameState.trumpCard.suit} />
      </div>
    );
  };

  // Лобби игры
  if (gamePhase === 'lobby') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Дурак онлайн</h1>
          <p>Играйте с реальными соперниками</p>
        </div>
        
        <div style={styles.lobby}>
          <button style={styles.button} onClick={createRoom}>
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
            <button style={styles.button} onClick={joinRoom}>
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
            <div style={styles.betAmount}>{betAmount} маф</div>
            <button 
              style={styles.button}
              onClick={placeBet}
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
      </div>
      
      <div style={styles.gameArea}>
        <div style={styles.playersContainer}>
          {/* Панель оппонента */}
          <div style={styles.playerPanel}>
            <div style={styles.playerHeader}>
              <h2 style={styles.playerName}>{gameState.players[opponentIndex].name}</h2>
              <div style={styles.playerStats}>
                <div style={styles.stat}>Мафы: {gameState.players[opponentIndex].mafs}</div>
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
                <div style={styles.stat}>Мафы: {gameState.players[playerIndex].mafs}</div>
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
              ...(gameState.gamePhase === 'attacking' && isPlayerTurn ? styles.buttonHover : {}),
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
              ...(gameState.gamePhase === 'defending' && isPlayerTurn ? styles.buttonHover : {}),
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
              ...(gameState.gamePhase === 'defending' && isPlayerTurn ? styles.buttonHover : {}),
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
              ...(gameState.gamePhase === 'attacking' && isPlayerTurn ? styles.buttonHover : {}),
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
const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
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
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
  const socketRef = useRef(null);

  useEffect(() => {
    // Подключаемся к серверу
    const socketRef = io(process.env.REACT_APP_SERVER_URL || 'https://fool-game-bte4.onrender.com');
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    socketRef.current.emit('user_login', userData);
  };

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return <FoolGame user={user} socket={socketRef.current} />;
}

export default App;
