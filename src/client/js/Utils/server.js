
var MSG_WARNING = 'Warning';
var MSG_SUCCESS = 'Success';
var MSG_HINT    = 'Hint';
var MSG_INFO    = 'Info';
var MSG_ERROR   = 'Error';

/**
 * Handle the communication with the server
 * @param {App}      app
 * @param {Storage}  storage
 * @param {function} appContainerCallback
 */
function WOLSoftServer(app, storage, appContainerCallback) {

    /**
     * Create a server ajax request
     * @param {string}        route            Service route to call
     * @param {string}        method           The HTTP Method
     * @param {function}      callbackFunction Callback function to execute when the response
     *                                         is fetched (with a optional parameter 'data')
     * @param {string|Object} data             The data for the request
     * @param {boolean}       async            Should the request be async
     * @param {boolean}       json             Send a JSON or an x-www-form-urlencoded request
     * @returns {boolean}
     */
    this.request = function(route, method, callbackFunction, data, async, json) {
        if (route.charAt(0) !== '/') {
            route = location.pathname.split('/').slice(0, 3).join('/') + '/' + route;
        }
        if (callbackFunction == null) {
            callbackFunction = function () {};
        }

        if ($('#loadIcon').length) {
            $('#loadIcon').css('display', 'block');
        }

        $.ajax({
            url: (method == 'GET' && typeof  data !== 'undefined') ? route + '?' + data : route,
            method: method,
            contentType: (json ? 'application/json' : 'application/x-www-form-urlencoded') + '; charset=UTF-8',
            data: method == 'GET' ? null : (json ? JSON.stringify(data) : data)
        }).done(function(response) {
            app.server.fetchResponse(callbackFunction, response);
        }).fail(function(response) {
            if (response.responseJSON && response.responseJSON.userMessages) {
                app.getMessages().showMessages(response.responseJSON.userMessages);
            }
        });
    };

    /**
     * Fetch a server response
     *
     * @param {Function} callbackFunction The callback function for the fetched requestger
     * @param {Object}   response         The parsed JSON response body
     */
    this.fetchResponse = function (callbackFunction, response) {
        response.invalidateCaches.forEach(function(cache){
            storage.clearCache(cache);
        });
        app.getMessages().showMessages(response.userMessages);

        if (response.data && response.data.authToken) {
            (new Cookie()).set('authToken', response.data.authToken, 30);
        }

        if (typeof appContainerCallback !== 'undefined' && response.appContainer !== null) {
            appContainerCallback(response.appContainer);
        }

        if (response.status) {
            if (response.redirect != null) {
                if (!response.redirectBeforeCallback) {
                    callbackFunction(response.data, response.userMessages);
                }
                window.location.href = response.redirect;
            }
            callbackFunction(response.data, response.userMessages);
        } else {
            if (response.redirect != null) {
                window.location.href = response.redirect;
            }
        }
        if ($('#loadIcon').length) {
            $('#loadIcon').css('display', 'none');
        }
    };
}
