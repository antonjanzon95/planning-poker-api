const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const mongodb = require('mongodb');
const mongoose = require('mongoose');
require('dotenv').config();

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const superadminRouter = require('./routes/superadmin');
const sessionsRouter = require('./routes/sessions');
const SessionModel = require('./models/SessionModel');
const { stringify } = require('querystring');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CLIENT_URI,

    methods: ['GET', 'POST'],
  },
});

const options = {
  useUnifiedTopology: true,
};

mongoose
  .connect(process.env.DATABASE_URI, options)
  .then(() => console.log('Connected to Database'))
  .catch((err) => console.error('Error connecting to database: ', err));

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/superadmin', superadminRouter);
app.use('/sessions', sessionsRouter);

// const ROOMS = [
//   {
//     admin: { name: 'Joe' },
//     users: [
//       {
//         name: 'Doe',
//         socketId: 1,
//       },
//       {
//         name: 'Foe',
//         socketId: 2,
//       },
//     ],
//     usersWhoLeft: ['Donny'],
//     upcomingTopics: [
//       {
//         title: 'Skapa frontend',
//       },
//       {
//         title: 'Skapa backend',
//       },
//     ],
//     currentTopic: {
//       title: 'Bygga Youtube klon',
//       votes: [
//         { user: { name: 'gregory' }, score: 3 },
//         { user: { name: 'Barry' }, score: 3 },
//       ],
//       score: 0, // Avg score
//     },
//     previousTopics: [
//       { title: 'skapa admin-vy', score: 5 },
//       { title: 'random topic', score: 3 },
//     ],
//   },
//   {
//     admin: { name: 'Troy' },
//     users: [
//       {
//         name: 'Lory',
//         socketId: 1,
//       },
//       {
//         name: 'Barry',
//         socketId: 2,
//       },
//     ],
//     usersWhoLeft: ['Donny'],
//     upcomingTopics: [
//       {
//         title: 'Skapa frontend',
//       },
//       {
//         title: 'Skapa backend',
//       },
//     ],
//     currentTopic: {
//       title: 'Bygga Spotify klon',
//       votes: [{ user: 'gregory', score: 3 }],
//     },
//     previousTopics: [
//       { title: 'skapa admin-vy', score: 5 },
//       { title: 'random topic', score: 3 },
//     ],
//   },
// ];
const FIBONACCI = [0, 1, 3, 5, 8];
const ROOMS = [];

app.get('/rooms', (req, res) => {
  res.json(ROOMS);
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    const roomWithUser = ROOMS.find((room) =>
      room.users.find((user) => user.socketId === socket.id)
    );

    if (!roomWithUser) {
      return console.log('User without room left');
    }

    const user = roomWithUser.users.find((user) => user.socketId == socket.id);
    const indexOfUser = roomWithUser.users.indexOf(user);

    roomWithUser.users.splice(indexOfUser, 1);

    roomWithUser.usersWhoLeft.push(user);

    roomWithUser.users.forEach((user) =>
      io.to(user.socketId).emit('userLeft', roomWithUser)
    );
    io.to(roomWithUser.admin.socketId).emit('userLeftAdmin', roomWithUser);
  });

  socket.on('monitorRooms', () => {
    io.emit('monitorRooms');
  });

  socket.on('createRoom', (room) => {
    ROOMS.push(room);

    io.emit('monitorRooms');
    io.to(socket.id).emit('createRoomAdmin', room);
  });

  socket.on('joinRoom', (userAndRoomIndex) => {
    const roomIndex = userAndRoomIndex.roomIndex;
    const room = ROOMS[roomIndex];

    // let userAlreadyInRoom = false;

    // room.users.forEach((user) => {
    //   if (user.name === userAndRoomIndex.name) {
    //     console.log('User that name is already in the room.');
    //     userAlreadyInRoom = true;
    //     return;
    //   }
    // });

    // if (userAlreadyInRoom) {
    //   io.to(socket.id).emit('userAlreadyInRoom', room);
    //   return;
    // }

    const user = { ...userAndRoomIndex.user, socketId: socket.id };

    room.users.push(user);

    room.users.forEach((user) => io.to(user.socketId).emit('joinRoom', room));
    io.to(room.admin.socketId).emit('renderRoomAdmin', room);
  });

  socket.on('reJoinRoom', (user) => {
    const room = ROOMS.find((room) =>
      room.usersWhoLeft.find((userToFind) => userToFind.id == user.id)
    );

    const userInRoom = room.usersWhoLeft.find(
      (userToFind) => userToFind.id == user.id
    );

    const userIndex = room.usersWhoLeft.indexOf(userInRoom);
    room.usersWhoLeft.splice(userIndex, 1);

    const updatedUser = { ...userInRoom, socketId: socket.id };
    room.users.push(updatedUser);

    room.users.forEach((user) =>
      io.to(user.socketId).emit('renderRoomUser', room)
    );
    io.to(room.admin.socketId).emit('renderRoomAdmin', room);
  });

  socket.on('leaveRoom', () => {
    const room = ROOMS.find((room) =>
      room.users.find((userToFind) => userToFind.socketId == socket.id)
    );
    console.log(socket.id);
    console.log(room);

    const user = room.users.find((user) => user.socketId == socket.id);

    const indexOfUser = room.users.indexOf(user);
    room.users.splice(indexOfUser, 1);

    room.usersWhoLeft.push(user);

    io.to(socket.id).emit('monitorRooms');
    room.users.forEach((user) => io.to(user.socketId).emit('userLeft', room));
    io.to(room.admin.socketId).emit('userLeftAdmin', room);
  });

  socket.on('deleteRoom', (roomIndex) => {
    const room = ROOMS[roomIndex];
    const usersInRoom = room.users.map((user) => user);

    ROOMS.splice(roomIndex, 1);

    usersInRoom.forEach((user) => io.to(user.socketId).emit('roomDeleted'));
  });

  socket.on('vote', (voteValue) => {
    const room = ROOMS.find((room) =>
      room.users.find((user) => user.socketId === socket.id)
    );
    let = userAlreadyVoted = false;

    room.currentTopic.votes.forEach((vote, index) => {
      if (vote.user.socketId === socket.id) {
        if (vote.score === voteValue) {
          room.currentTopic.votes.splice(index, 1);
        } else {
          vote.score = voteValue;
        }
        userAlreadyVoted = true;
      }
    });

    if (userAlreadyVoted) {
      room.users.forEach((user) => io.to(user.socketId).emit('vote', room));
      return;
    }

    const user = room.users.find((user) => user.socketId === socket.id);
    const userAndScore = {
      user: user,
      score: voteValue,
    };
    room.currentTopic.votes.push(userAndScore);

    if (room.users.length === room.currentTopic.votes.length) {
      const scoresAdded = room.currentTopic.votes.reduce(
        (sum, vote) => sum + vote.score,
        0
      );
      const averageValue = scoresAdded / room.currentTopic.votes.length;
      const fibonacciValue = roundToNearestFibonacci(averageValue);

      room.currentTopic.score = fibonacciValue;

      room.users.forEach((user) => io.to(user.socketId).emit('allVoted', room));
      return io.to(room.admin.socketId).emit('allVoted', room);
    }

    room.users.forEach((user) => io.to(user.socketId).emit('vote', room));
  });

  socket.on('changeTopicOrder', (topicIndexAndDirection) => {
    const room = ROOMS.find((room) => room.admin.socketId == socket.id);
    const direction = topicIndexAndDirection.direction;
    const topicIndex = topicIndexAndDirection.topicIndex;
    const topicToChange = room.upcomingTopics[topicIndex];

    if (direction == 'ner') {
      // handle swap down
      room.upcomingTopics[topicIndex] = room.upcomingTopics[topicIndex + 1];
      room.upcomingTopics[topicIndex + 1] = topicToChange;
    } else {
      // handle swap up
      room.upcomingTopics[topicIndex] = room.upcomingTopics[topicIndex - 1];
      room.upcomingTopics[topicIndex - 1] = topicToChange;
    }

    room.users.forEach((user) =>
      io.to(user.socketId).emit('changeTopicOrder', room)
    );
    io.to(room.admin.socketId).emit('changeTopicOrderAdmin', room);
  });

  socket.on('startGame', () => {
    const room = ROOMS.find((room) => room.admin.socketId == socket.id);

    if (room.upcomingTopics.length < 1) {
      return io.to(socket.id).emit('noTopics');
    }

    room.currentTopic = { title: room.upcomingTopics[0].title, votes: [] };

    room.upcomingTopics.shift();

    room.users.forEach((user) => io.to(user.socketId).emit('nextTopic', room));
    io.to(socket.id).emit('nextTopicAdmin', room);
  });

  socket.on('nextTopic', () => {
    const room = ROOMS.find((room) => room.admin.socketId == socket.id);

    if (room.currentTopic.votes.length < room.users.length) {
      return io.to(socket.id).emit('missingVotes');
    }

    room.previousTopics.push(room.currentTopic);

    if (room.upcomingTopics.length == 0) {
      room.users.forEach((user) =>
        io.to(user.socketId).emit('endSession', room)
      );
      io.to(socket.id).emit('endSession', room);

      saveSessionToDatabase(room);

      const roomIndex = ROOMS.indexOf(room);
      return ROOMS.splice(roomIndex, 1);
    }

    if (room.upcomingTopics.length > 0) {
      room.currentTopic = { title: room.upcomingTopics[0].title, votes: [] };
    }

    room.upcomingTopics.shift();

    room.users.forEach((user) => io.to(user.socketId).emit('nextTopic', room));
    io.to(socket.id).emit('nextTopicAdmin', room);
  });

  socket.on('removeTopic', (topicIndex) => {
    const room = ROOMS.find((room) => room.admin.socketId == socket.id);

    room.upcomingTopics.splice(topicIndex, 1);

    room.users.forEach((user) =>
      io.to(user.socketId).emit('removeTopic', room)
    );
    io.to(socket.id).emit('removeTopicAdmin', room);
  });

  socket.on('addTopic', (topicTitle) => {
    const room = ROOMS.find((room) => room.admin.socketId == socket.id);

    room.upcomingTopics.push({ title: topicTitle });

    room.users.forEach((user) => io.to(user.socketId).emit('addTopic', room));
    io.to(socket.id).emit('addTopicAdmin', room);
  });

  socket.on('endSession', () => {
    const room = ROOMS.find((room) => room.admin.socketId == socket.id);
    const roomIndex = ROOMS.indexOf(room);
    const users = room.users;
    const admin = room?.admin;

    saveSessionToDatabase(room);

    ROOMS.splice(roomIndex, 1);

    users.forEach((user) => io.to(user.socketId).emit('endSession', room));
    io.to(admin.socketId).emit('endSession', room);
  });
});

function roundToNearestFibonacci(number) {
  let nearestFib = FIBONACCI[0];
  let minDifference = Math.abs(number - nearestFib);

  for (let i = 1; i < FIBONACCI.length; i++) {
    const difference = Math.abs(number - FIBONACCI[i]);
    if (difference < minDifference) {
      minDifference = difference;
      nearestFib = FIBONACCI[i];
    }
  }

  return nearestFib;
}

async function saveSessionToDatabase(room) {
  const topicData = room.previousTopics.map((topic) => ({
    title: topic.title,
    averageScore: topic.score,
  }));
  const userNames = room.users.map((user) => user.name);
  const sessionData = {
    adminName: room.admin.name,
    userNames,
    topics: topicData,
  };
  const session = await new SessionModel(sessionData);
  await session.save();
}

module.exports = { app: app, server: server };
