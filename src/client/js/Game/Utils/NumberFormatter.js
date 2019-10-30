(function(beerplop) {
    'use strict';

    NumberFormatter.prototype.intlFormatter      = null;
    NumberFormatter.prototype.intlFormatterInt   = null;
    NumberFormatter.prototype.labelIntlFormatter = null;

    NumberFormatter.prototype._instance = null;

    NumberFormatter.prototype.language   = null;
    NumberFormatter.prototype.scientific = false;

    NumberFormatter.prototype.numberMapping = {};

    /**
     * Initialize the plop main controller
     *
     * @constructor
     */
    function NumberFormatter() {
        if (NumberFormatter.prototype._instance) {
            return NumberFormatter.prototype._instance;
        }

        this.scientific = typeof Storage !== 'undefined' && localStorage.getItem('scientificNotation') === 'true';

        if (this.scientific) {
            (new Beerplop.GameEventBus()).on(EVENTS.SAVE.LOAD.FINISHED, () => window.setTimeout(() => {
                const achievementController = new Beerplop.AchievementController();
                achievementController.checkAchievement(
                    achievementController.getAchievementStorage().achievements.special.scientist
                );
            }, 0));
        }

        this.language = (navigator.languages != undefined ? navigator.languages[0] : (navigator.language || 'en'));

        this.intlFormatter = new Intl.NumberFormat(
            this.language,
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        );

        this.intlFormatterInt = new Intl.NumberFormat(
            this.language,
            {
                maximumFractionDigits: 0
            }
        );
        this.labelIntlFormatter = new Intl.NumberFormat(
            this.language,
            {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            }
        );

        this._initNumberMapping();
        NumberFormatter.prototype._instance = this;
    }

    NumberFormatter.prototype._initNumberMapping = function () {
        this.numberMapping = {
            1e6: translator.translate('numbers.1e6'),
            1e9: translator.translate('numbers.1e9'),
            1e12: translator.translate('numbers.1e12'),
            1e15: translator.translate('numbers.1e15'),
            1e18: translator.translate('numbers.1e18'),
            1e21: translator.translate('numbers.1e21'),
            1e24: translator.translate('numbers.1e24'),
            1e27: translator.translate('numbers.1e27'),
            1e30: translator.translate('numbers.1e30'),
            1e33: translator.translate('numbers.1e33'),
            1e36: translator.translate('numbers.1e36'),
            1e39: translator.translate('numbers.1e39'),
            1e42: translator.translate('numbers.1e42'),
            1e45: translator.translate('numbers.1e45'),
            1e48: translator.translate('numbers.1e48'),
            1e51: translator.translate('numbers.1e51'),
            1e54: translator.translate('numbers.1e54'),
            1e57: translator.translate('numbers.1e57'),
            1e60: translator.translate('numbers.1e60'),
            1e63: translator.translate('numbers.1e63'),
            1e66: translator.translate('numbers.1e66'),
            1e69: translator.translate('numbers.1e69'),
            1e72: translator.translate('numbers.1e72'),
            1e75: translator.translate('numbers.1e75'),
            1e78: translator.translate('numbers.1e78'),
            1e81: translator.translate('numbers.1e81'),
            1e84: translator.translate('numbers.1e84'),
            1e87: translator.translate('numbers.1e87'),
            1e90: translator.translate('numbers.1e90'),
            1e93: translator.translate('numbers.1e93'),
            1e96: translator.translate('numbers.1e96'),
            1e99: translator.translate('numbers.1e99'),
            1e102: translator.translate('numbers.1e102'),
        };
    };

    NumberFormatter.prototype.getBalanceClass = function (balance) {
        if (balance < 0) {
            return 'balance-negative';
        }
        if (balance > 0) {
            return 'balance-positive';
        }

        return 'balance-0';
    };

    /**
     * Format a float number
     *
     * @param {Number} numberValue
     *
     * @returns {String}
     */
    NumberFormatter.prototype.format = function (numberValue) {
        if (this.showScientific(numberValue)) {
            return numberValue.toExponential(3);
        }

        let [number, label] = this._getNumberLabel(numberValue);

        return label !== null
            ? this.labelIntlFormatter.format(number) + ' ' + label
            : this.intlFormatter.format(number);
    };

    /**
     * Format a float number
     *
     * @param {Number} numberValue
     * @param {int}    fraction
     *
     * @returns {String}
     */
    NumberFormatter.prototype.formatFraction = function (numberValue, fraction) {
        if (numberValue >= 1e3) {
            return this.format(numberValue);
        }

        const formatter = new Intl.NumberFormat(
            this.language,
            {
                minimumFractionDigits: fraction,
                maximumFractionDigits: fraction
            }
        );

        return formatter.format(numberValue);
    };

    /**
     * Format an integer number
     *
     * @param {Number} numberValue
     *
     * @returns {string}
     */
    NumberFormatter.prototype.formatInt = function (numberValue) {
        if (this.showScientific(numberValue)) {
            return numberValue.toExponential(3);
        }

        let [number, label] = this._getNumberLabel(numberValue);

        return label !== null
            ? this.labelIntlFormatter.format(number) + ' ' + label
            : this.intlFormatterInt.format(number);
    };

    NumberFormatter.prototype.showScientific = function (numberValue) {
        return (this.scientific && Math.abs(numberValue) >= 1e6) || Math.abs(numberValue) >= 1e105;
    };

    /**
     * TODO: add years
     *
     * Format a time span
     *
     * @param {Number}  timeSpan The time span in miliseconds
     * @param {boolean} detailed Show a detailed timespan with two units
     *
     * @returns {string}
     */
    NumberFormatter.prototype.formatTimeSpan = function (timeSpan, detailed = false) {
        const days      = Math.floor(timeSpan / (1000 * 60 * 60 * 24)),
              hours     = Math.floor(timeSpan / (1000 * 60 * 60)) - days * 24,
              minutes   = Math.floor(timeSpan / (1000 * 60)) - hours * 60,
              seconds   = Math.floor(timeSpan / 1000) - minutes * 60,
              connector = ` ${translator.translate('time.connector')} `;

        let output = '';

        if (days > 0) {
            output = [this.formatInt(days), translator.translate('time.day', null, '', days)].join(' ');
            if (!detailed) {
                return output;
            }
        }

        if (hours > 0 || output !== '') {
            let hoursOutput = [hours, translator.translate('time.hour', null, '', hours)].join(' ');
            if (detailed) {
                if (days > 0) {
                    return output + connector + hoursOutput;
                } else {
                    output = hoursOutput;
                }
            } else {
                return hoursOutput;
            }
        }

        if (minutes > 0 || output !== '') {
            let minutesOutput = [minutes, translator.translate('time.minute', null, '', minutes)].join(' ');
            if (detailed) {
                if (hours > 0) {
                    return output + connector + minutesOutput;
                } else {
                    output = minutesOutput;
                }
            } else {
                return minutesOutput;
            }
        }

        let secondOutput = [seconds, translator.translate('time.second', null, '', seconds)].join(' ');

        if (detailed && minutes > 0) {
            return output + connector + secondOutput;
        }
        return secondOutput;
    };

    /**
     * Get the mapping for a large number
     *
     * @param {Number} numberValue
     *
     * @returns {*[]}
     *
     * @private
     */
    NumberFormatter.prototype._getNumberLabel = function (numberValue) {
        let label   = null,
            divisor = 0;

        $.each(this.numberMapping, function (numberSize, numberLabel) {
            if (numberValue >= numberSize || numberValue <= -numberSize) {
                divisor = numberSize;
                label   = numberLabel;
            }
        });

        if (divisor !== 0) {
            numberValue = numberValue / divisor;
        }

        return [numberValue, label];
    };

    /**
     * Romanize a number
     *
     * @param {Number} numberValue
     *
     * @returns {string}
     */
    NumberFormatter.prototype.romanize = function (numberValue) {
        if (numberValue <= 0) {
            return '-';
        }

        const lookup = {
            M:  1000,
            CM: 900,
            D:  500,
            CD: 400,
            C:  100,
            XC: 90,
            L:  50,
            XL: 40,
            X:  10,
            IX: 9,
            V:  5,
            IV: 4,
            I:  1
        };

        let roman  = '';

        for (const i in lookup) {
            while (numberValue >= lookup[i]) {
                roman       += i;
                numberValue -= lookup[i];
            }
        }
        return roman;
    };

    beerplop.NumberFormatter = NumberFormatter;
})(Beerplop);
