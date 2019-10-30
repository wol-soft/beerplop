(function(beerplop) {
    'use strict';

    LobbyController.prototype.options = {
        socket:     null,
        lobbyId:    null,
        nickName:   null,
        isAdmin:    false,
        userId:     null,
        nodeServer: null,
        nodePort:   null,
    };

    function LobbyController (options) {
        this.options = $.extend(this.options, options);

        $('#leave-lobby, #close-lobby').on('click', function () {
            window.location.href = '/plop';
        });

        this._initSocketConnection();
    }

    LobbyController.prototype._initSocketConnection = function () {
        $.getScript(this.options.nodeServer + ':' + this.options.nodePort + '/socket.io/socket.io.js')
            .done((function() {
                this.options.socket = io.connect(this.options.nodeServer + ':' + this.options.nodePort);

                if (this.options.lobbyId) {
                    this.options.socket.emit(
                        'beerplop.joinLobby',
                        {
                            'userId':   this.options.userId,
                            'nickName': this.options.nickName,
                            'lobbyId':  this.options.lobbyId
                        }
                    );
                }
                if (this.options.isAdmin) {
                    const adminId = Math.random().toString(36).substr(2);

                    this.options.socket.emit(
                        'beerplop.createLobby',
                        {
                            'userId':   this.options.userId,
                            'nickName': this.options.nickName,
                            'adminId':  adminId
                        }
                    );

                    $('#start-match').on('click', (function () {
                        this.options.socket.emit(
                            'beerplop.startLobby',
                            {
                                'adminId': adminId,
                                'lobbyId': this.options.lobbyId,
                                'title':   $('#lobby-title').val()
                            }
                        );
                    }).bind(this));
                }

                /**
                 * Update the join link
                 */
                this.options.socket.on('beerplop.createdLobby', (function(generatedLobbyId) {
                    this.options.lobbyId = generatedLobbyId;
                    $('#join-link').val(window.location.origin + '/lobby/' + this.options.lobbyId);
                }).bind(this));

                /**
                 * Redirect if the match was started
                 */
                this.options.socket.on('beerplop.startMatch', (function(saveStateId) {
                    window.location.href = '/plop/' + saveStateId;
                }).bind(this));

                /**
                 * Handle the player joined event. Add the player to the player table
                 */
                this.options.socket.on('beerplop.userJoined', (function(player) {
                    var playerObject = JSON.parse(player);

                    $('.players-list').find('tbody').append(
                        '<tr data-userId="' + playerObject.userId + '"><td><span>' +
                        playerObject.nickName + '</span></td></tr>'
                    );
                }).bind(this));

                /**
                 * Fill and show the table of players in the lobby
                 */
                this.options.socket.on('beerplop.connectedPlayersList', (function(connectedPlayersList) {
                    var playersList  = JSON.parse(connectedPlayersList),
                        playersTable = $('.players-list');
                    $.each(playersList, function () {
                        playersTable.find('tbody').append(
                            '<tr data-userId="' + this.userId + '"><td><span>' +
                            this.nickName + '</span></td></tr>'
                        );
                    });

                    $('tr[data-userId="' + this.options.userId + '"]').addClass('self');

                    playersTable.show();
                }).bind(this));

                /**
                 * Handle the player left event. Remove the player from the table
                 */
                this.options.socket.on('beerplop.userLeft', (function(userId) {
                    $('tr[data-userId="' + userId + '"]').remove();
                }).bind(this));

                /**
                 * Show a warning if the admin of the lobby closed the lobby
                 */
                this.options.socket.on('beerplop.lobbyClosed', (function() {
                    alert('Lobby closed');
                }).bind(this));
            }).bind(this)).fail((function() {
                alert('Failed to create socket connection');
            }).bind(this));
    };

    beerplop.LobbyController = LobbyController;
})(Beerplop);