import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

// Стилизация компонентов (остаются без изменений, как в вашем исходном коде)
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
  },
  loading: {
    textAlign: 'center',
    fontSize: '20px',
    padding: '20px'
  },
  reconnectButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    background: '#ff9900',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
    margin: '10px'
  },
  roomList: {
    maxHeight: '300px',
    overflowY: 'auto',
    margin: '20px 0'
  },
  roomItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: '10px',
    margin: '5px 0',
    borderRadius: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
 };

// Error Boundary (остается без изменений)
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
  } }

// Компонент карты (остается без изменений)
const Card = React.memo(({ value, suit, onClick, style = {} }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const isRed = suit === '♥' || suit === '♦';
  const cardStyle = {
    ...styles.card,
    ...(isRed ? styles.cardRed : {}),
    ...(isHovered ? { ...styles.cardHover, transform: 'translateY(-5px)' } : {}),
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
  );});

// Основной компонент игры
const FoolGame = ({ user, socket, onReconnect, connectionStatus }) => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [gamePhase, setGamePhase] = useState('lobby');
  const [error, setError] = useState('');
  const [betStatus, setBetStatus] = useState('idle');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [roomsList, setRoomsList] = useState([]);
  const [roomName, setRoomName] = useState('');

  // Функция для визуализации колоды и козыря
  const renderDeckAndTrump = useCallback(() => {
    if (!gameState || !gameState.trumpCard) return null;
    
    return (
      <div style={{ 
        marginTop: '20px', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <h3>Колода и козырь</h3>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '10px',
          marginTop: '10px'
        }}>
          {/* Колода */}
          <div style={{ 
            position: 'relative',
            width: '70px',
            height: '100px'
          }}>
            {/* Основная колода - стопка карт */}
            {gameState.deck.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '70px',
                height: '100px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                background: 'linear-gradient(45deg, #d40000, #1c8c68)',
                boxShadow: '0 3px 6px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                {gameState.deck.length}
              </div>
            )}
            
            {/* Верхние карты колоды для эффекта стопки */}
            {gameState.deck.length > 1 && (
              <div style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: '66px',
                height: '96px',
                backgroundColor: '#fff',
                borderRadius: '6px',
                background: 'linear-gradient(45deg, #d40000, #1c8c68)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }} />
            )}
            
            {gameState.deck.length > 2 && (
              <div style={{
                position: 'absolute',
                top: 4,
                left: 4,
                width: '62px',
                height: '92px',
                backgroundColor: '#fff',
                borderRadius: '4px',
                background: 'linear-gradient(45deg, #d40000, #1c8c68)',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
              }} />
            )}
          </div>
          
          {/* Козырь - повернутая карта под колодой */}
          <div style={{ 
            position: 'relative',
            marginLeft: '-35px' // Наложение на колоду
          }}>
            <div style={{
              transform: 'rotate(90deg)',
              transformOrigin: 'center'
            }}>
              <Card 
                value={gameState.trumpCard.value} 
                suit={gameState.trumpCard.suit} 
                style={{
                  border: '2px solid gold',
                  boxShadow: '0 0 10px gold'
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ 
          fontSize: '14px', 
          color: '#ffcc00',
          marginTop: '5px'
        }}>
          Осталось карт: {gameState.deck.length}
        </div>
      </div>
    );
  }, [gameState]);

  // Обработка сообщений от сервера
  useEffect(() => {
    if (!socket) {
      setError('Нет подключения к серверу');
      return;
    }
    
    const handleGameUpdate = (state) => {
      console.log('Получено обновление игры:', state);
      setGameState(state);
      setGamePhase(state.gamePhase);
      setError('');
    };
    
    const handleRoomCreated = (data) => {
      console.log('Комната создана успешно, ID:', data.roomId);
      setRoomId(data.roomId);
      setGamePhase('waiting');
      setError('');
    };
    
    const handlePlayerDisconnected = (data) => {
      console.log('Игрок отключился');
      setGamePhase('lobby');
      setGameState(null);
      setError(data.message || 'Соперник отключился. Возвращаемся в лобби.');
    };
    
    const handleSocketError = (data) => {
      console.error('Ошибка сокета:', data.message);
      setError(data.message);
    };
    
    const handleGameFinished = (data) => {
      console.log('Игра завершена, победитель:', data.winnerName);
      setError(`Игра завершена! Победитель: ${data.winnerName}`);
      // Можно добавить дополнительную логику для отображения результатов игры
    };
    
    const handleConnect = () => {
      console.log('Подключено к серверу');
      setError('');
    };
    
    const handleConnected = (data) => {
      console.log('Получено подтверждение от сервера:', data);
      setError('');
    };
    
    const handleDisconnect = () => {
      console.log('Отключено от сервера');
      setError('Отключено от сервера. Попытка переподключения...');
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

    const handleLoginSuccess = (data) => {
      console.log('Успешный вход пользователя:', data.user);
      setIsLoggedIn(true);
    };

    const handleLoginError = (data) => {
      console.error('Ошибка входа:', data.message);
      setError(data.message);
      setIsLoggedIn(false);
    };
    
    const handleRoomsList = (rooms) => {
      console.log('Получен список комнат:', rooms);
      setRoomsList(rooms);
    };
    
    // Назначаем обработчики событий
    socket.on('connect', handleConnect);
    socket.on('connected', handleConnected);
    socket.on('disconnect', handleDisconnect);
    socket.on('game_update', handleGameUpdate);
    socket.on('room_created', handleRoomCreated);
    socket.on('player_disconnected', handlePlayerDisconnected);
    socket.on('error', handleSocketError);
    socket.on('bet_result', handleBetResult);
    socket.on('login_success', handleLoginSuccess);
    socket.on('login_error', handleLoginError);
    socket.on('rooms_list', handleRoomsList);
    socket.on('game_finished', handleGameFinished);
    
    // Инициализируем подключение
    if (socket.disconnected) {
      socket.connect();
    }
    
    // Очистка обработчиков при размонтировании
    return () => {
      socket.off('connect', handleConnect);
      socket.off('connected', handleConnected);
      socket.off('disconnect', handleDisconnect);
      socket.off('game_update', handleGameUpdate);
      socket.off('room_created', handleRoomCreated);
      socket.off('player_disconnected', handlePlayerDisconnected);
      socket.off('error', handleSocketError);
      socket.off('bet_result', handleBetResult);
      socket.off('login_success', handleLoginSuccess);
      socket.off('login_error', handleLoginError);
      socket.off('rooms_list', handleRoomsList);
      socket.off('game_finished', handleGameFinished);
    };
  }, [socket, user, isLoggedIn]);
  
  // Автоматическое размещение ставки
  useEffect(() => {
    if (gamePhase === 'betting' && socket && socket.connected && betStatus === 'idle') {
      setBetStatus('placing');
      const fixedBetAmount = 10;
      
      socket.emit('place_bet', { roomId, amount: fixedBetAmount });
    }
  }, [gamePhase, roomId, socket, betStatus]);

  // Создание комнаты
  const createRoom = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }

    if (!isLoggedIn) {
      setError('Сначала необходимо войти в систему');
      return;
    }

    socket.emit('create_room', { roomName: roomName || `Комната ${Date.now()}` });
  };

  // Подключение к комнате
  const joinRoom = (joinRoomId = roomId) => {
    if (!joinRoomId) {
      setError('Введите ID комнаты');
      return;
    }
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }

    if (!isLoggedIn) {
      setError('Сначала необходимо войти в систему');
      return;
    }

    socket.emit('join_room', joinRoomId);
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

  // Подкинуть карту
  const addAttack = () => {
    if (!selectedCard) {
      setError('Выберите карту для подкидывания');
      return;
    }
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    socket.emit('add_attack', { roomId, card: selectedCard });
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

  // Завершение раунда (Бито)
  const bito = () => {
    if (!socket || socket.disconnected) {
      setError('Нет подключения к серверу');
      return;
    }
    socket.emit('bito', roomId);
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
    
    const isCurrentAttacker = gameState.currentPlayer === playerIndex;
    const isCurrentDefender = gameState.defenderIndex === playerIndex;
    
    return gameState.players[playerIndex].cards.map((card, index) => (
      <Card
        key={`${card.value}-${card.suit}-${index}`}
        value={card.value}
        suit={card.suit}
        onClick={() => {
          // В фазе атаки и ход игрока - можно атаковать
          if (gameState.gamePhase === 'attacking' && isCurrentAttacker) {
            setSelectedCard(card);
          } 
          // В фазе защиты и игрок защищается - можно защищаться
          else if (gameState.gamePhase === 'defending' && isCurrentDefender) {
            setSelectedCard(card);
          }
          // В фазе защиты и игрок атакующий - можно подкидывать
          else if (gameState.gamePhase === 'defending' && isCurrentAttacker) {
            // Проверяем, можно ли подкинуть эту карту
            const canAddToAttack = gameState.table.some(item => 
              item.card.value === card.value
            );
            
            if (canAddToAttack) {
              setSelectedCard(card);
            } else {
              setError('Можно подкидывать только карты того же достоинства, что уже есть на столе');
            }
          } else {
            setError('Сейчас не ваша очередь ходить');
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
      <div key={`table-${index}`} style={{ position: 'relative' }}>
        <Card
          value={item.card.value}
          suit={item.card.suit}
          style={{
            marginBottom: item.type === 'defense' ? '-80px' : '0px',
            zIndex: index
          }}
        />
      </div>
    ));
  }, [gameState]);

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
          {/* Интерфейс лобби остается без изменений */}
          {/* ... (ваш существующий код лобби) ... */}
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
        </div>
      </div>
    );
  }

  // Основной игровой интерфейс
  if (!gameState) return <div style={styles.loading}>Загрузка игры...</div>;

  const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
  if (playerIndex === -1) return <div>Ошибка: игрок не найден</div>;

  const isPlayerTurn = gameState.currentPlayer === playerIndex;
  const isPlayerDefender = gameState.defenderIndex === playerIndex;
  const opponentIndex = (playerIndex + 1) % 2;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Дурак онлайн - Комната: {roomId}</h1>
        <p>
          {isPlayerTurn && gameState.gamePhase === 'attacking' && 'Ваш ход: атакуйте!'}
          {isPlayerTurn && gameState.gamePhase === 'defending' && 'Ваш ход: защищайтесь!'}
          {!isPlayerTurn && 'Ход соперника'}
        </p>
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
        
        {renderDeckAndTrump()}
        
        {/* Элементы управления */}
        <div style={styles.controls}>
          {/* Кнопка Атаковать/Подкинуть */}
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'attacking' && isPlayerTurn) && 
                  !(gameState.gamePhase === 'defending' && isPlayerTurn && gameState.table.length > 0) ? styles.buttonDisabled : {})
            }}
            onClick={gameState.gamePhase === 'attacking' ? attack : addAttack}
            disabled={!(gameState.gamePhase === 'attacking' && isPlayerTurn) && 
                     !(gameState.gamePhase === 'defending' && isPlayerTurn && gameState.table.length > 0)}
          >
            {gameState.gamePhase === 'attacking' ? 'Атаковать' : 'Подкинуть'}
          </button>
          
          {/* Кнопка Защищаться */}
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'defending' && isPlayerDefender) ? styles.buttonDisabled : {})
            }}
            onClick={defend}
            disabled={!(gameState.gamePhase === 'defending' && isPlayerDefender)}
          >
            Защищаться
          </button>
          
          {/* Кнопка Взять */}
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'defending' && isPlayerDefender) ? styles.buttonDisabled : {})
            }}
            onClick={takeCards}
            disabled={!(gameState.gamePhase === 'defending' && isPlayerDefender)}
          >
            Взять
          </button>
          
          {/* Кнопка Бито */}
          <button 
            style={{
              ...styles.button,
              ...(!(gameState.gamePhase === 'defending' && isPlayerTurn && gameState.table.length > 0) ? styles.buttonDisabled : {})
            }}
            onClick={bito}
            disabled={!(gameState.gamePhase === 'defending' && isPlayerTurn && gameState.table.length > 0)}
          >
            Бито
          </button>
        </div>
        
        {/* Сообщения игры */}
        <div style={styles.message}>
          {gameState.gamePhase === 'attacking' && isPlayerTurn && 'Ваш ход. Выберите карту для атаки'}
          {gameState.gamePhase === 'attacking' && !isPlayerTurn && 'Ожидание хода соперника...'}
          {gameState.gamePhase === 'defending' && isPlayerDefender && 'Ваша очередь защищаться. Выберите карту для защиты или возьмите карты.'}
          {gameState.gamePhase === 'defending' && isPlayerTurn && !isPlayerDefender && 'Вы можете подкидывать карты или завершить раунд (Бито)'}
          {gameState.gamePhase === 'round_end' && 'Раунд завершен. Добираем карты...'}
        </div>
      </div>
    </div>
  );
};

// Компонент аутентификации и главный компонент App остаются без изменений
// ... (ваш существующий код LoginForm и App) ...

export default App;
