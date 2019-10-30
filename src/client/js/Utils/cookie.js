/**
 * Handle cookies of the app
 *
 * @constructor
 */
function Cookie() {
    /**
     * Set a new cookie entry or overwrite an existing cookie
     *
     * @param {String} name  The name of the cookie
     * @param {String} value The value of the cookie
     * @param {int}    days  The lifetime of the cookie in days
     */
    this.set = function(name, value, days) {
        var expires;

        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toGMTString();
        } else {
            expires = "";
        }
        document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/";
    };

    /**
     * Get a cookie by it's name. If the cookie is not set, null will be returned
     *
     * @param {String} name The name of the cookie
     *
     * @returns {String|null}
     */
    this.get = function(name) {
        var nameEQ = encodeURIComponent(name) + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        return null;
    };

    /**
     * Delete a cookie
     *
     * @param {String} name The name of the cookie
     */
    this.delete = function(name) {
        this.set(name, '', -1);
    };
}
