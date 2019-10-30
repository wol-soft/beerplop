/**
 * @constructor
 */
function Translator(languageLoadedCallback, application = 'user', resolve = null) {

    this.language = {};

    this.url = 'language/' + application;

    if (typeof applicationLanguage !== 'undefined') {
        this.url += '/' + applicationLanguage;
    }

    this.updateLanguage = function () {
        $.get(this.url).done((function (response) {
            this.language = response;

            if (languageLoadedCallback) {
                this.language = languageLoadedCallback(this.language);
            }

            if (resolve) {
                resolve();
            }
        }).bind(this));
    };

    this.updateLanguage();

    /**
     * Translate a given key
     *
     * @param {string} key          The key to translate
     * @param {Object} data         A key value object with data to replace inside the translated string
     *                              (eg. for inserting variables like names, amounts etc.)
     * @param {string} defaultLabel A default label to use if no translation is available
     * @param {int}    amount       The amount to decide whether to take a singular or a plural translation
     *
     * @return string
     */
    this.translate = function(key, data = null, defaultLabel = '', amount = 1) {
        defaultLabel = defaultLabel || 'undefined';

        let label = (this.language != null && this.language[key] != null) ? this.language[key] : defaultLabel;

        // try to find a plural translation
        if ((amount > 1 || amount === 0) && this.language != null && this.language[key + '.plural'] != null) {
            label = this.language[key + '.plural'];
        }

        if (data) {
            $.each(data, function(key, value) {
                label = label.replace(new RegExp(key, 'g'), value);
            });
        }

        return label;
    };
}
