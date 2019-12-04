(function(beerplop) {
    'use strict';

    const STORAGE_KEYS = {
        plop: 'beerplop',
        beerfactory: 'beerfactory',
        bar: 'bar',
        test: 'test',
    };

    GamePersistor.prototype._registeredElements = {};

    GamePersistor.prototype._instance = null;

    GamePersistor.prototype.base64Encoder = null;

    GamePersistor.prototype.gameEventBus = null;

    GamePersistor.prototype.localStorageKey = '';

    GamePersistor.prototype.saveSemaphore = false;
    GamePersistor.prototype._disableSave  = false;

    GamePersistor.prototype.saveStateVersion = null;

    /**
     * Initialize the game persistor
     *
     * @constructor
     */
    function GamePersistor() {
        if (GamePersistor.prototype._instance) {
            return GamePersistor.prototype._instance;
        }

        this.localStorageKey =
            STORAGE_KEYS[location.href.substring(location.href.lastIndexOf("/") + 1).split('?')[0]] || 'beerplop';

        if (typeof(Storage) !== 'undefined') {
            window.setInterval(
                (function () {
                    if (this.saveSemaphore || this._disableSave) {
                        return;
                    }

                    this.setLocalSaveState();

                    if (this.gameEventBus) {
                        this.gameEventBus.emit(EVENTS.SAVE.AUTOSAVE);
                    }
                }).bind(this),
                30000
            );
        }

        this.base64Encoder = new beerplop.Base64Encoder();

        GamePersistor.prototype._instance = this;
    }

    /**
     * Register a new element to be considered by a save state
     *
     * @param {string}   key          The key the element has inside the save state
     * @param {Function} saveCallback The callback which returns the data to be stored
     * @param {Function} loadCallback The callback to update the object. Called with the data which was returned by the
     *                                saveCallback function during the creation of the save state
     */
    GamePersistor.prototype.registerModule = function (key, saveCallback, loadCallback) {
        if (this._registeredElements[key]) {
            throw key + ' already registered in GamePersistor';
        }

        this._registeredElements[key] = {
            saveCallback: saveCallback,
            loadCallback: loadCallback
        }
    };

    /**
     * Get a new save state string
     *
     * @return {string}
     */
    GamePersistor.prototype.getSaveState = function (saveTime = null) {
        var saveState = {
            version: beerplop.version,
            created: saveTime || Date.now()
        };

        $.each(this._registeredElements, function (key, callbacks) {
            saveState[key] = callbacks.saveCallback();
        });

        return this.base64Encoder.b64EncodeUnicode(JSON.stringify(saveState));
    };

    /**
     * Load a save state and call all registered elements to update their data structure
     *
     * @param {string} saveState
     */
    GamePersistor.prototype.loadSaveState = function (saveState) {
        this.saveStateVersion = saveState.version;

        // apply all updates which must be applied before the save state is loaded
        if (compareVersions(beerplop.version, saveState.version) === 1) {
            $.each((new Beerplop.Updates()).getPreSaveStateApplyUpdates(), function (version, updateCallback) {
                if (compareVersions(version, saveState.version) === 1) {
                    console.log('Execute pre apply update for version ' + version);
                    saveState = updateCallback(saveState);
                }
            });
        }

        $.each(saveState, (function (key, data) {
            if (this._registeredElements[key]) {
                this._registeredElements[key].loadCallback(data);
            }
        }).bind(this));

        // apply all updates which require an applied save state
        if (compareVersions(beerplop.version, saveState.version) === 1) {
            $.each((new Beerplop.Updates()).getPostSaveStateApplyUpdates(), function (version, updateCallback) {
                if (compareVersions(version, saveState.version) === 1) {
                    console.log('Execute post apply update for version ' + version);
                    updateCallback();
                }
            });
        }
    };

    GamePersistor.prototype.disableSave = function () {
        this._disableSave = true;
    };

    /**
     * Try to load a save state from the local storage of the browser
     */
    GamePersistor.prototype.loadLocalSaveState = function (skipInterpolation = false) {
        if (typeof(Storage) !== 'undefined') {
            let saveState = this.fetchLocalSaveState();

            if (saveState) {
                if (this.gameEventBus) {
                    this.gameEventBus.emit(EVENTS.SAVE.LOAD.STARTED);
                }

                this.loadSaveState(saveState);

                if (this.gameEventBus) {
                    // emit interpolate seconds so the game break can be compensated if longer than a minute
                    let interpolateDuration = Math.floor((new Date() - new Date(saveState.created)) / 1000);
                    if (skipInterpolation || interpolateDuration < 60) {
                        interpolateDuration = 0;
                    }

                    this.gameEventBus.emit(EVENTS.SAVE.LOAD.FINISHED, interpolateDuration);
                }
            } else {
                this.saveSemaphore = true;
                $('#select-game-speed-overlay').removeClass('d-none');
            }
        }
    };

    /**
     * Fetch the local save state
     *
     * @returns {null|Object}
     */
    GamePersistor.prototype.fetchLocalSaveState = function () {
        let saveState        = null,
            encodedSaveState = localStorage.getItem(this.localStorageKey);

        if (encodedSaveState) {
            saveState = JSON.parse(this.base64Encoder.b64DecodeUnicode(encodedSaveState));
        }

        return saveState;
    };

    /**
     * Set the save semaphore
     *
     * @param {boolean} saveSemaphore
     */
    GamePersistor.prototype.setSaveSemaphore = function (saveSemaphore) {
        this.saveSemaphore = saveSemaphore;
    };

    /**
     * Reset the local save state
     */
    GamePersistor.prototype.resetLocalSaveState = function () {
        if (typeof(Storage) !== 'undefined') {
            localStorage.removeItem(this.localStorageKey);
            localStorage.removeItem('scientificNotation');
        }
    };

    /**
     * Set the event bus
     *
     * @param gameEventBus
     *
     * @returns {GamePersistor}
     */
    GamePersistor.prototype.setEventBus = function (gameEventBus) {
        this.gameEventBus = gameEventBus;

        return this;
    };

    /**
     * Update or init the local save state
     *
     * @returns {string}
     */
    GamePersistor.prototype.setLocalSaveState = function (givenSaveState = null, saveTime = null) {
        const saveState = givenSaveState || this.getSaveState(saveTime);

        try {
            localStorage.setItem(this.localStorageKey, saveState);
        } catch (e) {
            console.log(e);

            (new Beerplop.Notification()).notify({
                content: translator.translate('error.localSave'),
                style:   'snackbar-error',
                timeout: 3000,
                channel: 'system',
            })
        }

        return saveState;
    };

    beerplop.GamePersistor = GamePersistor;
})(Beerplop);
