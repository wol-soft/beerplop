(function(beerplop) {
    'use strict';

    SaveStateController.prototype.saveState = {
        id: null,
        autoSaveKey: null,
        lobbyId: null
    };

    SaveStateController.prototype.updateSaveStateFunctionEnabled = false;

    SaveStateController.prototype.gameState               = null;
    SaveStateController.prototype.lastRemoteSaveStateSync = null;

    SaveStateController.prototype._disableSave = false;

    /**
     * Initialize the save state controller
     *
     * @constructor
     */
    function SaveStateController(gameState, gameEventBus) {
        this.gameState = gameState;

        (new Beerplop.GamePersistor()).registerModule(
            'SaveStateController',
            (function () {
                return this.saveState;
            }.bind(this)),
            (function (loadedData) {
                if (loadedData) {
                    this.saveState                      = $.extend(true, this.saveState, loadedData);
                    this.updateSaveStateFunctionEnabled = this.saveState.id !== null;

                    gameEventBus.on(EVENTS.CORE.INITIALIZED.INDEXED_DB, (function () {
                        (new Beerplop.IndexedDB()).setSaveStateId(this.saveState.id || 0);
                    }).bind(this));

                    if (this.saveState.lobbyId) {
                        $.get({
                            url: '/apps/beerplop/lobby/' + this.saveState.lobbyId + '/ranking',
                        }).done((function (response) {
                            this._updateRankingTable(response.data.ranking);
                        }).bind(this));
                    }
                }
            }.bind(this))
        );

        window.setInterval(
            (function () {
                if (this.updateSaveStateFunctionEnabled) {
                    this._updateSaveState();
                }
            }.bind(this)),
            10 * 60 * 1000
        );

        assetPromises['modals'].then(() => {
            this._initWipeGameEventListener();
            this._initSaveStateEventListener();
        });

        $('#start-lobby').on('click', function () {
            window.location.href = '/apps/beerplop/lobby';
        })
    }

    SaveStateController.prototype._initWipeGameEventListener = function () {
        $('#wipe-game').on('click', function () {
            const achievementController = new Beerplop.AchievementController();
            achievementController.checkAchievement(
                achievementController.getAchievementStorage().achievements.special.theRiskySide
            );

            $('#wipe-warn-modal').modal('show');
        });

        $('#wipe').on('click', function () {
            (new beerplop.GamePersistor()).resetLocalSaveState();
            window.location.reload();
        });
    };

    SaveStateController.prototype._initSaveStateEventListener = function () {
        $('#save-current-state').on('click', (function () {
            (new beerplop.GamePersistor()).setLocalSaveState();
            if (this.updateSaveStateFunctionEnabled) {
                this._updateSaveState();
            }
        }).bind(this));

        $('#save-states').on('click', (function () {
            this._updateSaveStateTable();
        }).bind(this));

        $('#show-create-save-state-modal').on('click', function () {
            $('#save-states-modal').modal('hide');

            if ($('#save-state-table-container').find('table').data('saveStateAmount') >= 5) {
                $('#max-save-states-reached-modal').modal('show');
                return;
            }
            $('#new-save-state-modal').modal('show');
        });

        $('#form-new-save-state').on(
            'submit',
            (function(event) {
                $.post({
                    url:         '/apps/beerplop/save',
                    contentType: 'application/json',
                    data:        JSON.stringify({
                        'title':      $('#save-state-name').val(),
                        'saveState' : (new Beerplop.GamePersistor()).getSaveState()
                    })
                }).fail(function () {
                    $('#create-save-state-messages').html(
                        '<div class="alert alert-danger" role="alert">' +
                            translator.translate('error.createSaveState') +
                        '</div>'
                    );
                }).done((function (response) {
                    $('#save-states-modal').modal('show');
                    $('#new-save-state-modal').modal('hide');
                    $('#save-state-name').val('');
                    this._updateSaveStateTable();

                    const achievementController = new Beerplop.AchievementController();
                    achievementController.checkAchievement(
                        achievementController.getAchievementStorage().achievements.special.saveSide
                    );

                    this.saveState.id                   = response.data.id;
                    this.saveState.autoSaveKey          = response.data.autoSaveKey;
                    this.updateSaveStateFunctionEnabled = true;

                    (new Beerplop.GamePersistor()).setLocalSaveState();
                    this._updateSaveState();
                }).bind(this));
                event.preventDefault();
            }).bind(this)
        );

        $('#delete-save-state').on('click', (function (event) {
            const saveStateId = $(event.target).data('saveStateId');
            $.ajax({
                method: 'DELETE',
                url:    '/apps/beerplop/save/' + saveStateId
            }).done((function () {
                $('#save-states-modal').modal('show');

                this._updateSaveStateTable();
                if (saveStateId === this.saveState.id) {
                    this._switchToLocalSaveState();
                }
            }).bind(this));
        }).bind(this));

        $('#update-save-state-persistence, #load-save-state').on('click', (function (event) {
            this.loadSaveState($(event.target).data('saveStateId'));
        }).bind(this));

        $('#switch-to-local-save-state').on('click', (function () {
            this._switchToLocalSaveState();
        }).bind(this));

        $('#cancel-load-save-state, #cancel-delete-save-state, #cancel-create-save-state, #cancel-update-save-state-persistence, #max-save-states-reached-ok')
            .on('click', function () {
                $('#save-states-modal').modal('show');
            });
    };

    SaveStateController.prototype._switchToLocalSaveState = function () {
        this.saveState.id                   = null;
        this.saveState.autoSaveKey          = null;
        this.saveState.lobbyId              = null;
        this.updateSaveStateFunctionEnabled = false;

        $('#current-save-state-title').text(translator.translate('save.localSave'));
        $('#switch-to-local-save-state').addClass('d-none');
        $('#ranking-container').empty();
    };

    SaveStateController.prototype._updateSaveStateTable = function () {
        this._copyAuthTokenCookieIntoLocalStorage();

        $.get({
            url: '/apps/beerplop/save'
        }).done(
            (function (response) {
                // TODO: TypeError: Cannot read property 'length' of null possible
                if (response.data.length > 0) {
                    if (this.saveState.id !== null) {
                        $.each(response.data, (function (index, saveState) {
                            if (this.saveState.id === saveState.id) {
                                $('#current-save-state-title').text(saveState.title);
                                return false;
                            }
                        }).bind(this));

                        $('#switch-to-local-save-state').removeClass('d-none');
                    } else {
                        $('#switch-to-local-save-state').addClass('d-none');
                    }

                    response.data.map(function (saveState) {
                        saveState.modified = (new Date(saveState.modified)).toLocaleString();
                        return saveState;
                    });

                    $('#save-state-table-container').html(
                        Mustache.render(
                            TemplateStorage.get('save-state-table-template'),
                            {
                                saveStates:      response.data,
                                saveStateAmount: response.data.length
                            }
                        )
                    );
                    this._hideSaveStateTableEmptyState(true);
                    this._initSaveStateTableEventListener();
                } else {
                    this._hideSaveStateTableEmptyState(false);
                }

                const modal = $('#save-states-modal');
                if (!modal.hasClass('show')) {
                    modal.modal('show');
                }
            }).bind(this)
        ).fail(
            (function (response) {
                // The user is not logged in any longer
                if (response.status === 403) {
                    $('#login-modal').modal('show');
                }
            }).bind(this)
        );
    };

    SaveStateController.prototype._initSaveStateTableEventListener = function () {
        $('.btn-delete-save-state').on('click', (function (event) {
            $('#delete-save-state-name').text($(event.target).closest('tr').find('td')[0].innerHTML);
            $('#delete-save-state-warn-modal').modal('show');
            $('#save-states-modal').modal('hide');

            $('#delete-save-state').data(
                'saveStateId',
                $(event.target).closest('tr').data('saveStateId')
            );
        }).bind(this));

        $('.btn-load-save-state').on('click', (function (event) {
            if (this.updateSaveStateFunctionEnabled) {
                this._updateSaveState();
                this.loadSaveState($(event.target).closest('tr').data('saveStateId'));
                return;
            }

            $('#load-save-state-name').text($(event.target).closest('tr').find('td')[0].innerHTML);
            $('#load-save-state-warn-modal').modal('show');
            $('#save-states-modal').modal('hide');
            $('#load-save-state').data(
                'saveStateId',
                $(event.target).closest('tr').data('saveStateId')
            );
        }).bind(this));
    };

    SaveStateController.prototype._hideSaveStateTableEmptyState = function (hideEmptyState) {
        const containerHasClass = $('#save-state-table-container').hasClass('d-none');
        if ((hideEmptyState && containerHasClass) || (!hideEmptyState && !containerHasClass)) {
            $('.available-save-state-toggle').toggleClass('d-none');
        }
    };

    /**
     * Update a remote save state
     *
     * @private
     */
    SaveStateController.prototype._updateSaveState = function () {
        if (this._disableSave) {
            return;
        }

        this._copyAuthTokenCookieIntoLocalStorage();

        if (this.lastRemoteSaveStateSync !== null &&
            Math.floor(((new Date()) - this.lastRemoteSaveStateSync) / 1000) < 30
        ) {
            return;
        }

        this.lastRemoteSaveStateSync = new Date();

        $.ajax({
            method:      'PUT',
            url:         '/apps/beerplop/save/' + this.saveState.id,
            contentType: 'application/json',
            data:        JSON.stringify({
                'saveState':   (new Beerplop.GamePersistor()).getSaveState(),
                'autoSaveKey': this.saveState.autoSaveKey,
                'plops':       this.gameState.getAllTimePlops()
            })
        }).done((function (response) {
            (new Beerplop.Notification()).notify({
                content: translator.translate('success.saveStateSaved'),
                style:   'snackbar-success',
                timeout: 2000,
                channel: 'system',
            });

            if (response.data && response.data.ranking) {
                this._updateRankingTable(response.data.ranking);
            }

            const achievementController = new Beerplop.AchievementController();
            achievementController.checkAchievement(
                achievementController.getAchievementStorage().achievements.special.saveSide
            );
        }).bind(this)).fail((function (response) {
            // the persistence lead was taken by another device loading the save state
            if (response.status === 409) {
                $('#update-save-state-persistence').data('saveStateId', this.saveState.id);
                $('#save-state-persistence-lead-warn-modal').modal('show');
                $('#save-states-modal').modal('hide');

                this.saveState.id                   = null;
                this.saveState.autoSaveKey          = null;
                this.saveState.lobbyId              = null;
                this.updateSaveStateFunctionEnabled = false;
            }

            // The user is not logged in any more
            if (response.status === 403) {
                if ($('.login-form').length === 0) {
                    window.location.reload();
                }

                (new Beerplop.Notification()).notify({
                    content: translator.translate('error.saveStateSaved'),
                    style:   'snackbar-error',
                    timeout: 2000,
                    channel: 'system',
                });
            }
        }).bind(this));
    };

    SaveStateController.prototype.loadSaveState = function (saveStateId, delayReload = 0) {
        $.get({
            url: '/apps/beerplop/save/' + saveStateId
        })
        .done((function (response) {
            const gamePersistor = new Beerplop.GamePersistor();
            let   saveTime      = new Date();

            // set the loaded save state. There may be no save state present if a lobby match was just started.
            if (response.data.saveState) {
                gamePersistor.setLocalSaveState(response.data.saveState);
                gamePersistor.loadLocalSaveState(true);

                saveTime = new Date(gamePersistor.fetchLocalSaveState().created);
            }

            // update the auto save key for taking the persistence lead
            this.saveState = {
                id:          response.data.demoSaveState ? null : saveStateId,
                autoSaveKey: response.data.demoSaveState ? null : response.data.autosaveHash,
                lobbyId:     response.data.demoSaveState ? null : response.data.lobbyId
            };

            // update the localStorage entry with the updated key
            gamePersistor.setLocalSaveState(null, saveTime);
            if (!response.data.saveState) {
                this._updateSaveState();
            }

            window.setTimeout(
                () => window.location.href = '/apps/beerplop/plop',
                delayReload
            );
        }).bind(this))
        .fail(function () {
            alert(translator.translate('error.loadSaveState'));
        });
    };

    /**
     * Make the auth token cookie available from localStorage
     *
     * @private
     */
    SaveStateController.prototype._copyAuthTokenCookieIntoLocalStorage = function () {
        const authToken = (new Cookie()).get('authToken');
        if (authToken && (!localStorage.getItem('authToken') || localStorage.getItem('authToken') !== authToken)) {
            localStorage.setItem('authToken', authToken);
        }

        if (localStorage.getItem('authToken')) {
            (new Cookie()).set('authToken', localStorage.getItem('authToken'), 30);
        }
    };

    /**
     * Update the ranking table of a multiplayer match
     *
     * @param {Array} rankingData
     * @private
     */
    SaveStateController.prototype._updateRankingTable = function (rankingData) {
        const numberFormatter = new Beerplop.NumberFormatter();

        $('#ranking-container').html(
            Mustache.render(
                TemplateStorage.get('ranking-template'),
                {
                    ranking: rankingData.map(function (rankingEntry) {
                        const plops = Number(rankingEntry.plops);

                        return {
                            nickName:     rankingEntry.name,
                            plops:        numberFormatter.format(plops),
                            plopsNumeric: plops,
                            active:       !!+rankingEntry.active,
                        }
                    }).sort(function (a, b) {
                        return b.plopsNumeric - a.plopsNumeric;
                    })
                }
            )
        );
    };

    SaveStateController.prototype.disableSave = function () {
        this._disableSave = true;
    };

    beerplop.SaveStateController = SaveStateController;
})(Beerplop);
