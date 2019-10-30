(function(beerplop) {
    'use strict';

    IndexedDB.prototype._instance = null;

    IndexedDB.prototype.state      = false;
    IndexedDB.prototype.connection = null;

    /**
     * Initialize the IndexedDB abstraction
     *
     * @constructor
     */
    function IndexedDB(gameState, gameEventBus) {
        if (IndexedDB.prototype._instance) {
            return IndexedDB.prototype._instance;
        }

        let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

        if (!indexedDB) {
            return;
        }

        let openRequest = window.indexedDB.open('beerplop', 3);

        openRequest.onupgradeneeded = (function (event) {
            let upgradeDb = event.target.result;

            $.each(['bottleCapFactory', 'total', ...gameState.getBuildings()], function (index, building) {
                const buildingStorageKey = `buildingProduction-${building}`;
                if (!upgradeDb.objectStoreNames.contains(buildingStorageKey)) {
                    console.log('createObjectStore', buildingStorageKey);
                    let buildingStorage = upgradeDb.createObjectStore(
                        buildingStorageKey,
                        {
                            keyPath: 'timestamp',
                        }
                    );

                    buildingStorage.createIndex('timestamp', 'timestamp');
                }
            });

            if (!upgradeDb.objectStoreNames.contains('keyValueStorage')) {
                upgradeDb.createObjectStore('keyValueStorage', {keyPath: 'key', unique: true});
                this.setKeyValue('saveStateId', 0);
            }
        }).bind(this);

        openRequest.onsuccess = (function (event) {
            this.connection = event.target.result;
            this.state      = true;

            gameEventBus.emit(EVENTS.CORE.INITIALIZED.INDEXED_DB);

            window.setTimeout(() =>
                $.each(['bottleCapFactory', 'total', ...gameState.getBuildings()], (function (index, building) {
                    const buildingStorageKey = `buildingProduction-${building}`;
                    let transaction = this.connection.transaction(buildingStorageKey, 'readwrite'),
                        storage     = transaction.objectStore(buildingStorageKey);

                    console.log('clearObjectStore', buildingStorageKey);
                    storage.clear();
                }).bind(this))
            , 0);
        }).bind(this);

        openRequest.onerror = (function (event) {
            console.log(event);
            this.state = false;
        }).bind(this);

        IndexedDB.prototype._instance = this;
    }

    IndexedDB.prototype.addToStorage = function (storageName, item) {
        if (!this.state) {
            return false;
        }

        let transaction = this.connection.transaction(storageName, 'readwrite'),
            storage     = transaction.objectStore(storageName);

        return storage.add(item);
    };

    IndexedDB.prototype.setKeyValue = function (key, value) {
        if (!this.state) {
            return false;
        }

        let transaction = this.connection.transaction('keyValueStorage', 'readwrite'),
            storage     = transaction.objectStore('keyValueStorage'),
            request     = storage.openCursor(key),
            object      = {
                key:   key,
                value: value,
            };

        request.onsuccess = function(response) {
            let cursor = response.target.target;

            if (cursor) {
                cursor.update(object);
            } else {
                storage.add(object)
            }
        };
    };

    IndexedDB.prototype.getKeyValue = function (key) {
        let transaction = this.connection.transaction('keyValueStorage', 'readonly'),
            storage     = transaction.objectStore('keyValueStorage');

        return storage.get(key);
    };

    /**
     * Fetch all items from a given storage
     *
     * @param {string} storageName
     *
     * @returns {*}
     */
    IndexedDB.prototype.fetchAll = function (storageName) {
        if (!this.state) {
            return false;
        }

        let transaction = this.connection.transaction(storageName, 'readwrite'),
            storage     = transaction.objectStore(storageName);

        return storage.getAll();
    };

    /**
     * Check if the indexedDB is in a successfully connected state
     *
     * @returns {boolean}
     */
    IndexedDB.prototype.getState = function () {
        return this.state;
    };

    /**
     * Check if the current save state ID of the local storage matches the loaded save state ID. If a difference is
     * detected the object storage must be cleared to not store mixed data from different save states
     *
     * @param {int} saveStateId
     */
    IndexedDB.prototype.setSaveStateId = function (saveStateId) {
        if (!this.state) {
            return;
        }

        let request = this.getKeyValue('saveStateId');

        request.onsuccess = (function (response) {
            let currentSaveStateId = response.target.result ? response.target.result.value : undefined;

            if (currentSaveStateId === saveStateId) {
                return;
            }

            $.each(this.connection.objectStoreNames, (function (index, storageName) {
                let transaction = this.connection.transaction(storageName, 'readwrite'),
                    storage     = transaction.objectStore(storageName);

                storage.clear();
            }).bind(this));

            this.setKeyValue('saveStateId', saveStateId);
        }).bind(this);
    };

    beerplop.IndexedDB = IndexedDB;
})(Beerplop);
