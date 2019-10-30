module.exports = function(io, $, uuid, request) {

    let lobbies = {},
        inLobby = {};

    io.sockets.on('connection', function (socket) {

        /**
         * A new lobby is created
         */
        socket.on('beerplop.createLobby', function (req) {
            console.log('beerplop.createLobby');
            const lobbyId = uuid.v4();
            lobbies[lobbyId] = {
                connectedUser: {},
                adminId:       req.adminId
            };

            lobbies[lobbyId].connectedUser[req.userId] = {
                nickName: req.nickName,
                socketId: socket.id,
                isAdmin:  true
            };
            inLobby[socket.id] = lobbyId;

            io.to(socket.id).emit('beerplop.createdLobby', lobbyId);
            io.to(socket.id).emit(
                'beerplop.connectedPlayersList',
                JSON.stringify([{userId: req.userId, nickName: req.nickName}])
            );
        });

        /**
         * Start a lobby
         */
        socket.on('beerplop.startLobby', function (req) {
            console.log('beerplop.startLobby');

            // catch non existing lobbies or requests with an invalid admin ID
            if (!(req.lobbyId in lobbies || lobbies[req.lobbyId].adminId !== req.adminId)) {
                return;
            }

            request.post(
                {
                    url:  'http://localhost/apps/beerplop/lobby/' + req.lobbyId + '/save',
                    data: {
                        players: Object.keys(lobbies[req.lobbyId].connectedUser),
                        title:   req.title
                    }
                },
                function (error, response, data) {
                    lobbies[req.lobbyId].started = true;

                    if (!data) {
                        io.to(socket.id).emit('beerplop.startLobbyFailed');
                        console.log(error);
                    }

                    data = JSON.parse(data);
                    $.each(lobbies[req.lobbyId].connectedUser, function (userId, userData) {
                        io.to(userData.socketId).emit('beerplop.startMatch', data.data[userId]);
                    });
                }
            );
        });

        /**
         * A new player joins a lobby
         */
        socket.on('beerplop.joinLobby', function(req) {
            console.log('beerplop.joinLobby');

            // The requested lobby doesn't exist
            if (!(req.lobbyId in lobbies) || req.userId in lobbies[req.lobbyId].connectedUser) {
                console.log('Block invalid lobby access');
                return;
            }

            // emit a user joined message to each player in the lobby
            $.each(lobbies[req.lobbyId].connectedUser, function () {
                console.log('emit player joined ' + this.socketId);
                io.to(this.socketId).emit(
                    'beerplop.userJoined',
                    JSON.stringify({
                        nickName: req.nickName,
                        userId:   req.userId
                    })
                );
            });

            // add the player to the chat room
            lobbies[req.lobbyId].connectedUser[req.userId] = {
                nickName: req.nickName,
                socketId: socket.id
            };
            inLobby[socket.id] = req.lobbyId;

            // send a list of the currently conencted players to the new connected client
            let players = [];
            $.each(lobbies[req.lobbyId].connectedUser, function (userId, player) {
                players.push({
                    nickName: player.nickName,
                    userId:   userId
                });
            });

            io.to(socket.id).emit('beerplop.connectedPlayersList', JSON.stringify(players));
        });

        /**
         * A player leaves a lobby
         */
        socket.on('disconnect', function() {
            if (!(socket.id in inLobby)) {
                return;
            }

            var lobbyId     = inLobby[socket.id],
                lobby       = lobbies[lobbyId],
                leavingUser = null;

            if (lobby.started) {
                return;
            }

            console.log('leave beerplop lobby');

            $.each(lobby.connectedUser, function (id, user) {
                if (user.socketId == socket.id) {
                    leavingUser = user;
                    delete lobby.connectedUser[id];
                    delete inLobby[socket.id];
                    return false;
                }
            });

            if (leavingUser) {
                let connectedUser = 0;
                $.each(lobby.connectedUser, function () {
                    connectedUser++;
                    // emit user left message
                    io.to(this.socketId).emit(
                        leavingUser.isAdmin ? 'beerplop.lobbyClosed' : 'beerplop.userLeft',
                        leavingUser.userId
                    );
                });

                if (connectedUser === 0) {
                    delete lobbies[lobbyId];
                }
            }

            console.log('Client disconnected from beerplop lobby');
        });
    });
};
