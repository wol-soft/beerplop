(function(beerplop) {
    'use strict';

    Notification.prototype._instance       = null;
    Notification.prototype.iftttAuthorized = null;

    Notification.prototype.messageQueue    = [];
    Notification.prototype.pendingMessages = [];

    Notification.prototype.gameOptions = null;

    Notification.prototype.notifyInterval = null;

    /**
     * @constructor
     */
    function Notification() {
        if (Notification.prototype._instance) {
            return Notification.prototype._instance;
        }

        this.gameOptions = new Beerplop.GameOptions();
        this.updateAuthorized();

        Notification.prototype._instance = this;
    }

    Notification.prototype.notify = function (message) {
        $.snackbar(message);

        if (this.iftttAuthorized === false || !this.gameOptions.isIFTTTChannelActive(message.channel)) {
            return;
        }

        this.messageQueue.push($.extend({time: new Date()}, message));
    };

    Notification.prototype.isAuthorized = function () {
        return this.iftttAuthorized;
    };

    Notification.prototype.updateAuthorized = function (callback) {
        $.get({
            url: 'ifttt/authorized',
        }).done((function (response, statusText, xhr) {
            if (xhr.status !== 200) {
                console.log('no session');
                this.iftttAuthorized = false;

                return;
            }
            this.iftttAuthorized = response.status;

            if (callback) {
                callback(this.iftttAuthorized);
            }

            if (this.iftttAuthorized && !this.notifyInterval) {
                this._sendNotifications();
                this.notifyInterval = window.setInterval(this._sendNotifications.bind(this), 1000 * 5);
            }
        }).bind(this));
    };

    Notification.prototype._sendNotifications = function () {
        if (this.messageQueue.length > 0) {
            this.pendingMessages.push(...this.messageQueue.splice(0, this.messageQueue.length));
        }

        if (this.pendingMessages.length === 0) {
            return;
        }

        $.post({
            url:         'messages',
            contentType: 'application/json',
            data:        JSON.stringify({
                'timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
                'messages': this.pendingMessages.map((message) => {
                    return {
                        channel: translator.translate(`options.ifttt_${message.channel}`),
                        message: message.content,
                        time:    message.time,
                    };
                }),
            })
        }).fail(function () {
            console.log('failed to send messages');
        }).done((function () {
            this.pendingMessages = [];
        }).bind(this));
    };

    beerplop.Notification = Notification;
})(Beerplop);
