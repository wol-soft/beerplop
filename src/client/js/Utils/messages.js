/**
 * @constructor
 */
function Messages(containerId) {

    this.containerId = containerId || '#messageContainer';

    /**
     * Trigger the display of messages to the user
     * @param {Array}  messages
     * @returns null
     */
    this.showMessages = function(messages) {
        if (messages.length > 0) {
            storage.messages = storage.messages.concat(messages);
            if(!storage.messagesTriggered) {
                storage.messagesTriggered = true;
                this.showMessage();
            }
        }
    };

    /**
     * Render a message to the user.
     * @returns {null}
     */
    this.showMessage = function() {
        if (storage.messages.length == 0) {
            storage.messagesTriggered = false;
            return null;
        }
        var message   = storage.messages.shift();
        var container = $(this.containerId);
        var html      = container.html();
        var time      = Date.now();
        var label     = [message.app, 'messages', message.type.toLowerCase(), message.message];
        label         = app.translate(label.join('.'), message.data, 'undefined', message.amount);

        html += '<div id="MSG' + time + '" style="display: none;" class="message' + message.type + '">' +
            label + '<span onclick="$(\'#MSG' + time + '\').remove();">X</span></div>';
        container.html(html);

        $('#MSG' + time).fadeIn(400, function() {
            setTimeout(function(){
                $('#MSG' + time).fadeOut(400, function() {
                    $(this).remove();
                });
            },3000);
        });
        setTimeout((function() {
            this.showMessage();
        }).bind(this), 400);
    };
}
