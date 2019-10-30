(function(beerplop) {
    'use strict';

    Base64Encoder.prototype._instance = null;

    /**
     * Initialize the plop main controller
     *
     * @constructor
     */
    function Base64Encoder() {
        if (Base64Encoder.prototype._instance) {
            return Base64Encoder.prototype._instance;
        }

        Base64Encoder.prototype._instance = this;
    }

    Base64Encoder.prototype.b64EncodeUnicode = function (str) {
        return btoa(
            encodeURIComponent(str).replace(
                /%([0-9A-F]{2})/g,
                function toSolidBytes(match, p1) {
                    return String.fromCharCode('0x' + p1);
                }
            )
        );
    };

    Base64Encoder.prototype.b64DecodeUnicode = function (str) {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    };

    beerplop.Base64Encoder = Base64Encoder;
})(Beerplop);
