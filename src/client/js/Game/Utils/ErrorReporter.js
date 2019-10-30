(function(beerplop) {
    'use strict';

    ErrorReporter.prototype.reportedErrors = [];

    /**
     * Initialize the error reporter
     *
     * @constructor
     */
    function ErrorReporter() {
    }

    ErrorReporter.prototype.bindErrorListener = function () {
        window.onerror = (function(msg, url, lineNo, columnNo, error) {
            if (error) {
                this.reportError(error.name, error.message, error.stack);
            } else {
                this.reportError(url, msg, lineNo + ':' + columnNo);
            }
        }).bind(this);
    };

    ErrorReporter.prototype.reportError = function (name, message, stack) {
        const report = JSON.stringify({
                  version: Beerplop.version,
                  name:    name,
                  message: message,
                  stack:   stack,
              }),
              reportHash = this.hash(report);

        if ($.inArray(reportHash, this.reportedErrors) !== -1) {
            return;
        }

        this.reportedErrors.push(reportHash);

        $.post({
            url:         'server/log/client/beerplop',
            contentType: 'application/json',
            data:        report,
        });
    };

    ErrorReporter.prototype.hash = function (str) {
        return str.split('').reduce(
            (prevHash, currVal) => (((prevHash << 5) - prevHash) + currVal.charCodeAt(0)) | 0,
            0
        );
    };

    beerplop.ErrorReporter = ErrorReporter;
})(Beerplop);
