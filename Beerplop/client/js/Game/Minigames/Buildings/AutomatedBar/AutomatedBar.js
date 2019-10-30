const TYPE_BAR            = 0;
const TYPE_SINGLE_TABLE   = 1;
const TYPE_PIPE           = 2;
const TYPE_COOLING_ENGINE = 3;

(function(buildingMinigames) {
    'use strict';

    const INITIAL_GRID_SIZE = 6;

    const ITEM_MAP = {
        0: 'bar',
        1: 'table',
        2: 'pipe',
        3: 'coolingEngine',
    };

    const SACRIFICE_BOOST__AUTO_PLOPS  = 0;
    const SACRIFICE_BOOST__BOTTLE_CAPS = 1;
    const SACRIFICE_BOOST__DISPENSER   = 2;

    AutomatedBar.prototype._instance = null;

    AutomatedBar.prototype.gameEventBus          = null;
    AutomatedBar.prototype.achievementController = null;
    AutomatedBar.prototype.numberFormatter       = null;

    AutomatedBar.prototype.upgradeStorage = null;

    AutomatedBar.enabled = false;

    AutomatedBar.prototype.state = {
        grid: [],
        totalConsumedBeer: 0,
        ownedBeer: 300,
        name: 'Piddys Pat',
        tutorial: 0,
        level: 0,
        sacrificeBoost: [],
        notifiedComplete: false,
    };

    AutomatedBar.prototype.availableItems = [0, 1, 2];

    // store the current load state of the grid
    AutomatedBar.prototype.gridLoadState        = [];
    // store the current load state for a selected item
    AutomatedBar.prototype.affectedDeliveryGrid = [];
    // the current amount of beers consumed per iteration
    AutomatedBar.prototype.consumedBeer         = 0;
    // store the coordinates of the item which is currently selected for management
    AutomatedBar.prototype.managedItem          = null;
    // store the coordinates of the item which is currently moved
    AutomatedBar.prototype.moveItem             = null;
    // is the automated bar overlay visible?
    AutomatedBar.prototype.overlayVisible       = false;

    // store which map is currently activated
    AutomatedBar.prototype.maps = {
        loadMap:  false,
        levelMap: false,
    };

    AutomatedBar.prototype.initialState = null;

    AutomatedBar.prototype.cache = {
        globalCapacityBoost: null,
    };

    /**
     * @param gameEventBus
     * @param achievementController
     *
     * @constructor
     */
    function AutomatedBar (gameEventBus, achievementController) {
        if (AutomatedBar.prototype._instance) {
            return AutomatedBar.prototype._instance;
        }

        this.gameEventBus          = gameEventBus;
        this.achievementController = achievementController;
        this.numberFormatter       = new Beerplop.NumberFormatter();

        this.upgradeStorage = new BuildingMinigames.AutomatedBarUpgradeStorage(this, gameEventBus);

        this.initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'BMG_AutomatedBar',
            (function getAutomatedBarData() {
                return $.extend(
                    true,
                    {
                        reachedUpgrades:  this.upgradeStorage.reachedUpgrades,
                        unlockedUpgrades: this.upgradeStorage.unlockedUpgrades,
                    },
                    this.state
                );
            }.bind(this)),
            (function setAutomatedBarData(loadedData) {
                this.upgradeStorage.setReachedUpgrades(loadedData.reachedUpgrades);
                this.upgradeStorage.unlockedUpgrades = loadedData.unlockedUpgrades || [];

                delete loadedData.reachedUpgrades;
                delete loadedData.unlockedUpgrades;

                this.state = $.extend(true, {}, this.initialState, loadedData);

                this.upgradeStorage.checkUnlockedUpgrades();
                this.recalculateConsumedBeers();
            }.bind(this))
        );

        AutomatedBar.prototype._instance = this;

        this.gameEventBus.on(EVENTS.AUTOMATED_BAR.UPGRADE_PURCHASED, (function (event, upgradeKey) {
            if (upgradeKey.indexOf('level.capacity') !== -1) {
                delete this.cache.globalCapacityBoost;
                this._updateGrid();
            }

            if (upgradeKey.indexOf('level.price') !== -1) {
                delete this.cache.globalPriceReduction;
            }
        }).bind(this));

        this.gameEventBus.on(EVENTS.SAVE.LOAD.FINISHED, () => this._updateCurrentEffects());

        ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).addModifier(
            'AutomatedBar',
            this.getBottleCapBoost.bind(this)
        );
    }

    AutomatedBar.prototype.unlock = function () {
        if (this.enabled) {
            return;
        }

        this.gameEventBus.on(EVENTS.CORE.ITERATION, this._iterate.bind(this));

        const overlayController = new Beerplop.OverlayController(),
              container         = $('#building-container-automatedBar').parent();

        container.append(Mustache.render(TemplateStorage.get('automated-bar__barkeeper-template'), {}));

        if (this.state.notifiedComplete) {
            $('#building-container-automatedBar')
                .closest('.building-container')
                .find('.toggle-minigame')
                .addClass('minigame-cta');
        }

        container.find('.toggle-minigame').removeClass('d-none');
        this._updateCurrentEffects();

        overlayController.addCallback(
            'automated-bar',
            this._renderBarManagementOverlayContent.bind(this),
            () => {
                this.overlayVisible = false;

                const container = $('#automated-bar__overlay__container');

                container.find('.automated-bar__grid-cell__popover').popover('dispose');
                container.find('.upgrade-item .automated-bar__tooltip').tooltip('dispose');

                container.html('');
            },
        );

        overlayController.initContainer(container);

        this.enabled = true;

        window.setTimeout(this._initGrid.bind(this), 0);

        assetPromises['modals'].then(() => {
            const sacrificeButton = $('#sacrifice');

            sacrificeButton.on('click', (function () {
                const selectedBoost = $("input:radio[name='automated-bar__sacrifice-boost']:checked").val();

                if (selectedBoost === undefined ||
                    sacrificeButton.data('role') !== 'automatedBar' ||
                    this.state.totalConsumedBeer < this._getBeersForNextSacrifice()
                ) {
                    return;
                }

                sacrificeButton.data('role', '');
                this.state.sacrificeBoost.push(parseInt(selectedBoost));
                this._sacrifice();
                this._updateCurrentEffects();
            }).bind(this));

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.buildingMG.automatedBar.enabled
            );
        });
    };

    AutomatedBar.prototype._iterate = function () {
        this.state.totalConsumedBeer += this.consumedBeer;
        this.state.ownedBeer         += this.consumedBeer;

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.buildingMG.automatedBar.soldBeer,
            this.state.totalConsumedBeer
        );

        // skip udating the UI if the overlay isn't visible
        if (!this.overlayVisible) {
            return;
        }

        const progress = Math.min(100, this.state.totalConsumedBeer / this._getBeersForNextSacrifice() * 100);

        $('#automated-bar__owned').text(this.numberFormatter.formatInt(this.state.ownedBeer));
        $('#automated-bar__total').text(this.numberFormatter.formatInt(this.state.totalConsumedBeer));
        $('#automated-bar__progress').text(this.numberFormatter.format(progress));

        if (progress === 100 && !this.state.notifiedComplete) {
            $('#automated-bar__sacrifice').removeClass('d-none');
            $('#building-container-automatedBar')
                .closest('.building-container')
                .find('.toggle-minigame')
                .addClass('minigame-cta');

            (new Beerplop.Notification()).notify({
                content: translator.translate('automatedBar.sacrificeNotification'),
                style:   'snackbar-success',
                timeout: 5000,
                channel: 'buildingMinigame',
            });

            this.state.notifiedComplete = true;
        }

        $.each($('#automated-bar__available-upgrades-container').find('.upgrade-item'), (function (index, element) {
            element = $(element);

            const costs = this.upgradeStorage.getUpgradeByPath(element.data('upgrade')).costs;

            if (this.state.ownedBeer >= costs && !element.hasClass('available-upgrade')) {
                element.addClass('available-upgrade');
            } else if (this.state.ownedBeer < costs && element.hasClass('available-upgrade')) {
                element.removeClass('available-upgrade');
            }
        }).bind(this));

        if (this.managedItem && !this.moveItem) {
            this._updateItemUpgradeAvailability();
        }
    };

    /**
     * Update the availability of the upgrade button for the currently managed item
     *
     * @private
     */
    AutomatedBar.prototype._updateItemUpgradeAvailability = function () {
        const itemUpgradeButton = $('#automated-bar__item-upgrade'),
              upgrade           = itemUpgradeButton.data('upgrade');

        if (upgrade) {
            itemUpgradeButton.closest('fieldset').prop(
                'disabled',
                this.upgradeStorage.getUpgradeCosts(upgrade) > this.state.ownedBeer
            );
        }
    };

    /**
     * Update the current boosting effects of the Automated Bars affecting the main game in the miniame starting area
     *
     * @private
     */
    AutomatedBar.prototype._updateCurrentEffects = function () {
        $('#building-container-automatedBar').parent().find('.automated-bar__boosts-list').html(
            Mustache.render(
                TemplateStorage.get('automated-bar__boosts-template'),
                {
                    boosts: [SACRIFICE_BOOST__AUTO_PLOPS, SACRIFICE_BOOST__BOTTLE_CAPS, SACRIFICE_BOOST__DISPENSER].map(
                        (boostKey) => {
                            return {
                                key :  boostKey,
                                boost: this.numberFormatter.formatInt((this._getBoostByKey(boostKey) - 1) * 100),
                                level: this.numberFormatter.romanize(this._getSacrificeBoost(boostKey)),
                            };
                        }
                    )
                }
            )
        );
    };

    AutomatedBar.prototype._getBoostByKey = function (boostKey) {
        switch (boostKey) {
            case SACRIFICE_BOOST__AUTO_PLOPS:  return this.getAutoPlopBoost();
            case SACRIFICE_BOOST__BOTTLE_CAPS: return this.getBottleCapBoost();
            case SACRIFICE_BOOST__DISPENSER:   return this.getDispenserBoost();
            default:                           return 0;
        }
    };

    /**
     * Calculate the bottle cap boost depending on the selected sacrifice-boosts
     *
     * @return {number}
     */
    AutomatedBar.prototype.getBottleCapBoost = function () {
        return this._getConsumedBeerBoost(SACRIFICE_BOOST__BOTTLE_CAPS);
    };

    /**
     * Calculate the auto plop boost depending on the selected sacrifice-boosts
     *
     * @return {number}
     */
    AutomatedBar.prototype.getAutoPlopBoost = function () {
        return this._getConsumedBeerBoost(SACRIFICE_BOOST__AUTO_PLOPS);
    };

    AutomatedBar.prototype._getConsumedBeerBoost = function (sacrificeBoost) {
        return Math.pow(
            Math.sqrt(Math.sqrt(Math.sqrt(this.consumedBeer))),
            Math.sqrt(this._getSacrificeBoost(sacrificeBoost))
        );
    };

    /**
     * Calculate how often the given sacrifice boost was selected
     *
     * @param {Number} sacrificeBoost use SACRIFICE_BOOST__* constants
     *
     * @returns {Number}
     */
    AutomatedBar.prototype._getSacrificeBoost = function (sacrificeBoost) {
        return this.state.sacrificeBoost.reduce((prev, cur) => prev + (cur === sacrificeBoost), 0);
    };

    /**
     * Calculate the dispenser boost depending on the selected sacrifice-boosts
     *
     * @return {number}
     */
    AutomatedBar.prototype.getDispenserBoost = function () {
        return Math.pow(
            Math.pow(1.1, this._getAmountOfType(TYPE_BAR)),
            this._getSacrificeBoost(SACRIFICE_BOOST__DISPENSER)
        );
    };

    AutomatedBar.prototype._getBeersForNextSacrifice = function () {
        return Math.pow(10, this.state.level) * 1e5;
    };

    AutomatedBar.prototype._renderGrid = function () {
        return Mustache.render(
            TemplateStorage.get('automated-bar__grid-table-template'),
            {
                grid: this.state.grid,
            }
        );
    };

    AutomatedBar.prototype._updateGrid = function () {
        this._disposePopover();
        $('#grid-table__container').html(this._renderGrid());

        this.recalculateConsumedBeers();
        this._initGridEventListener();
    };

    AutomatedBar.prototype._disposePopover = function () {
        const container = $('#automated-bar__overlay__container');

        container.find('.automated-bar__grid-cell__popover').popover('dispose');
        container.find('.automated-bar__tooltip').tooltip('dispose');
    };

    AutomatedBar.prototype._renderBarManagementOverlayContent = function () {
        const progress = Math.min(100, this.state.totalConsumedBeer / this._getBeersForNextSacrifice() * 100);

        this.overlayVisible = true;

        this._disposePopover();

        $('#automated-bar__overlay__container').html(
            Mustache.render(
                TemplateStorage.get('automated-bar__overlay-content-template'),
                {
                    grid:           this._renderGrid(),
                    name:           this.state.name,
                    owned:          this.numberFormatter.formatInt(this.state.ownedBeer),
                    total:          this.numberFormatter.formatInt(this.state.totalConsumedBeer),
                    perSecond:      this.numberFormatter.formatInt(this.consumedBeer),
                    progress:       this.numberFormatter.format(progress),
                    showSacrifice:  progress === 100,
                    tutorial:       this.state.tutorial < 4,
                    tutorialStep:   this.state.tutorial,
                    loadMapActive:  this.maps.loadMap,
                    levelMapActive: this.maps.levelMap,
                    level:          this.numberFormatter.romanize(this.state.level),
                }
            )
        );

        this.upgradeStorage.renderAvailableUpgrades();
        this._initGridEventListener();

        $('#automated-bar__show-load-map').on(
            'change',
            () => {
                this._disableActiveMap('loadMap');
                this._toggleLoadMapOverlay();
                this.maps.loadMap = !this.maps.loadMap;
            }
        );

        $('#automated-bar__show-level-map').on(
            'change',
            () => {
                this._disableActiveMap('levelMap');
                this._toggleLevelMapOverlay();
                this.maps.levelMap = !this.maps.levelMap;
            }
        );

        $('#automated-bar__view-upgrades').on(
            'click',
            () => (new Beerplop.OverlayController()).openOverlay('upgrades-overlay', 'automatedBar-upgrades')
        );

        $('#automated-bar__sacrifice').on('click', (function () {
            if (this.moveItem) {
                return;
            }

            const modal = $('#sacrifice-hint-modal'),
                  body  = modal.find('.modal-body');

            body.html(
                Mustache.render(
                    TemplateStorage.get('automated-bar__sacrifice-template'),
                    {
                        boost: [SACRIFICE_BOOST__AUTO_PLOPS, SACRIFICE_BOOST__BOTTLE_CAPS, SACRIFICE_BOOST__DISPENSER]
                            .map((boost) => {
                                return {
                                    boost: boost,
                                    level: this.numberFormatter.romanize(this._getSacrificeBoost(boost)),
                                };
                            })
                    }
                )
            );
            body.find('.sacrifice-boost-options').bootstrapMaterialDesign();

            $('#sacrifice').data('role', 'automatedBar');
            modal.modal('show');
        }).bind(this));

        if (this.managedItem) {
            this._showItemManagement(this.managedItem[0], this.managedItem[1]);
        }
        if (this.moveItem) {
            this._disableFieldsWithItems();
            $('.btn__automated-bar__move-disabled').closest('fieldset').prop('disabled', true);
            $('#automated-bar__item-move').find('.automated-bar__item-move__label').toggleClass('d-none');
        }
    };

    AutomatedBar.prototype._initGridEventListener = function () {
        const container = $('#automated-bar__overlay__container');

        // copy the svg contents to be able to manipulate them with CSS
        $.each(
            container.find('.automated-bar__equipment-svg'),
            (index, element) => $(element).html($('#svg-bar__' + $(element).data('svgKey')).html())
        );

        let elementCounter = 0;
        const cells = container.find('.automated-bar__grid-cell');

        $.each(cells, (function (index, element) {
            $(element).attr(
                'data-grid-index',
                `${Math.floor(elementCounter / this.state.grid[0].length)}-${elementCounter++ % this.state.grid[0].length}`
            );
        }).bind(this));

        this.recalculateConsumedBeers();

        this._disableTutorialFields(container, cells);

        if (this.maps.loadMap && !this.managedItem) {
            this._toggleLoadMapOverlay();
        }
        if (this.maps.levelMap) {
            this._toggleLevelMapOverlay();
        }

        cells.on('click', (function (event) {
            const gridCell              = $(event.target).closest('.automated-bar__grid-cell'),
                  overlay               = gridCell.find('.automated-bar__grid-cell__overlay__load'),
                  [gridRow, gridColumn] = gridCell.data('gridIndex').split('-');

            if (overlay.hasClass('automated-bar__grid-cell__disabled')) {
                return;
            }

            // if an item is selected for moving move the origin cell to the selected cell
            if (this.moveItem !== null) {
                const originRow    = this.moveItem[0],
                      originColumn = this.moveItem[1];

                this.state.grid[gridRow][gridColumn]     = this.state.grid[originRow][originColumn];
                this.state.grid[originRow][originColumn] = null;

                this.managedItem = [parseInt(gridRow), parseInt(gridColumn)];
                this.moveItem    = null;

                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.buildingMG.automatedBar.move
                );

                this._updateGrid();
                this.affectedDeliveryGrid = this.recalculateConsumedBeers(gridRow, gridColumn);
                this._showItemManagement(parseInt(gridRow), parseInt(gridColumn));

                $('#automated-bar__sacrifice').closest('fieldset').prop('disabled', false);

                return;
            }

            if (this.state.grid[gridRow][gridColumn] !== null) {
                this._showItemManagement(parseInt(gridRow), parseInt(gridColumn));
                return;
            }

            this._showCellEquipDialog(parseInt(gridRow), parseInt(gridColumn));
        }).bind(this));

        const numberFormatter = this.numberFormatter,
              automatedBar    = this;

        container.find('.automated-bar__grid-cell__popover').popover({
            content: function() {
                let [gridRow, gridColumn] = $(this).data('gridIndex').split('-'),
                    cell                  = automatedBar.state.grid[gridRow][gridColumn],
                    affectedLoadActive    = automatedBar.managedItem !== null &&
                        automatedBar.maps.loadMap &&
                        cell.item !== TYPE_COOLING_ENGINE &&
                        automatedBar.state.grid[automatedBar.managedItem[0]][automatedBar.managedItem[1]].item !== TYPE_COOLING_ENGINE,
                    affectedCell          = affectedLoadActive ? automatedBar.affectedDeliveryGrid[gridRow][gridColumn] : null,
                    affectedLoad          = affectedLoadActive && affectedCell.node
                                                ? affectedCell.node.affectedDelivered / affectedCell.node.available
                                                : 0;

                if (cell.item === TYPE_COOLING_ENGINE) {
                    return translator.translate('automatedBar.itemLevel') + ': ' +
                        numberFormatter.romanize(cell.level || 0) + '<br />' +
                        translator.translate('automatedBar.item.3.title');
                }

                return Mustache.render(
                    TemplateStorage.get('automated-bar__cell-status'),
                    {
                        level:     numberFormatter.romanize(cell.level || 0),
                        base:      numberFormatter.formatInt(automatedBar._getBaseCapacity(cell)),
                        available: numberFormatter.formatInt($(this).data('available')),
                        delivered: numberFormatter.formatInt($(this).data('delivered')),
                        load:      numberFormatter.formatInt(
                            (cell.item === TYPE_SINGLE_TABLE ? 1 - $(this).data('load') : $(this).data('load')) * 100
                        ),
                        showAffectedLoad:  affectedLoadActive,
                        affectedLoad:      numberFormatter.formatInt(affectedLoadActive ? affectedLoad * 100 : 0),
                        affectedDelivered: numberFormatter.formatInt(
                            affectedLoadActive && affectedCell.node ? affectedCell.node.affectedDelivered : 0
                        ),
                    }
                );
            }
        });
    };

    /**
     * Loop over all available maps and disable all active maps.
     *
     * @param {string} skipMap The map which must not be disabled
     *
     * @private
     */
    AutomatedBar.prototype._disableActiveMap = function (skipMap) {
        $.each(this.maps, (function (map, active) {
            if (map !== skipMap && active) {
                this.maps[map] = false;

                switch (map) {
                    case 'loadMap':
                        this._toggleLoadMapOverlay();
                        break;
                    case 'levelMap':
                        this._toggleLevelMapOverlay();
                        break;
                }

                const toggleInput = $('#automated-bar__show-' +
                    (map.charAt(0).toUpperCase() + map.slice(1)).match(/[A-Z][a-z]+/g).join('-').toLowerCase()
                );

                toggleInput.prop('checked', false);
            }
        }).bind(this));
    };

    AutomatedBar.prototype._sacrifice = function () {
        this.pushColumn();
        this.pushRow();

        this.state.ownedBeer         = 0;
        this.state.totalConsumedBeer = 0;
        this.state.notifiedComplete  = false;
        this.state.level++;

        delete this.cache.globalCapacityBoost;

        this.upgradeStorage.checkUnlockedUpgrades();

        this._renderBarManagementOverlayContent();

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.buildingMG.automatedBar.gameLevel,
            this.state.level
        );

        this.gameEventBus.emit(EVENTS.AUTOMATED_BAR.SACRIFICE, this.state.level);

        $('#building-container-automatedBar')
            .closest('.building-container')
            .find('.toggle-minigame')
            .removeClass('minigame-cta');
    };

    AutomatedBar.prototype._toggleLoadMapOverlay = function () {
        $('#automated-bar__overlay__container')
            .find(
                `.automated-bar__grid-cell__overlay__${
                    this.managedItem ? 'distribution' : 'load'
                }:not(.automated-bar__grid-cell__disabled)`
            ).toggleClass('d-none');

        if (this.managedItem) {
            $('.automated-bar__grid-cell__overlay__distribution')
                .removeClassRegex(/automated-bar__grid-cell__overlay__load-\d+/);
            this._addItemLoadClasses(this.managedItem[0], this.managedItem[1]);
        }
    };

    AutomatedBar.prototype._toggleLevelMapOverlay = function () {
        $('#automated-bar__overlay__container')
            .find('.automated-bar__grid-cell__overlay__level:not(.automated-bar__grid-cell__disabled)')
            .toggleClass('d-none');
    };

    /**
     * Get the refund value for an item if the item is sold.
     * TODO: levels must increase the refund
     *
     * @param {Number} gridRow    The row of the item to refund on the grid
     * @param {Number} gridColumn The column of the item to refund on the grid
     *
     * @returns {number}
     *
     * @private
     */
    AutomatedBar.prototype._getItemRefund = function (gridRow, gridColumn) {
        if (!this.state.grid[gridRow][gridColumn]) {
            return 0;
        }

        return Math.floor(
            this._getCostNext(this.state.grid[gridRow][gridColumn].item, -1) /
                // check if more than one building of the given type exists to avoid deadlock deleting
                // (having not enough beers to set up a production)
                (this._getAmountOfType(this.state.grid[gridRow][gridColumn].item) > 1 ? 2 : 1)
        );
    };

    /**
     * Try to remove the given amount of beers
     *
     * @param {Number} amount
     *
     * @returns {boolean}
     */
    AutomatedBar.prototype.removeBeers = function (amount) {
        if (this.state.ownedBeer < amount) {
            return false;
        }

        this.state.ownedBeer -= amount;

        $('#automated-bar__owned').text(this.numberFormatter.formatInt(this.state.ownedBeer));

        return true;
    };

    /**
     * Check if the user is currently solving the tutorial. In this case disable fields he should not use.
     *
     * @param {jQuery} container
     * @param {Array}  cells
     *
     * @private
     */
    AutomatedBar.prototype._disableTutorialFields = function (container, cells) {
        switch (this.state.tutorial) {
            case 1:
                cells
                    .find('.automated-bar__grid-cell__overlay')
                    .addClass('automated-bar__grid-cell__disabled');

                $.each([
                    [this.state.tutorialBar[0] - 2, this.state.tutorialBar[1]],
                    [this.state.tutorialBar[0] + 2, this.state.tutorialBar[1]],
                    [this.state.tutorialBar[0], this.state.tutorialBar[1] - 2],
                    [this.state.tutorialBar[0], this.state.tutorialBar[1] + 2],
                ], (function (index, cellCoordinates) {
                    // try to access the requested cell. If the cell is not available or empty return the parsing process.
                    try {
                        if (this.state.grid[cellCoordinates[0]][cellCoordinates[1]] !== null) {
                            return;
                        }
                    } catch (e) {
                        return;
                    }

                    container
                        .find(`.automated-bar__grid-cell[data-grid-index="${cellCoordinates[0]}-${cellCoordinates[1]}"]`)
                        .find('.automated-bar__grid-cell__overlay')
                        .removeClass('automated-bar__grid-cell__disabled');
                }).bind(this));

                container.find('.automated-bar__grid-cell__disabled').removeClass('d-none');
                break;
            case 2:
                cells
                    .find('.automated-bar__grid-cell__overlay')
                    .addClass('automated-bar__grid-cell__disabled');

                // only enable the field between the bar and the table
                container
                    .find(`.automated-bar__grid-cell[data-grid-index="${
                            (this.state.tutorialBar[0] + this.state.tutorialTable[0]) / 2
                        }-${
                            (this.state.tutorialBar[1] + this.state.tutorialTable[1]) / 2
                        }"]`)
                    .find('.automated-bar__grid-cell__overlay')
                    .removeClass('automated-bar__grid-cell__disabled');

                container.find('.automated-bar__grid-cell__disabled').removeClass('d-none');
                break;
            case 3:
                cells
                    .find('.automated-bar__grid-cell__overlay')
                    .addClass('automated-bar__grid-cell__disabled');

                $.each([
                    [this.state.tutorialBar[0], this.state.tutorialBar[1]],
                    [this.state.tutorialTable[0], this.state.tutorialTable[1]],
                    [(this.state.tutorialBar[0] + this.state.tutorialTable[0]) / 2, (this.state.tutorialBar[1] + this.state.tutorialTable[1]) / 2],
                ], function (index, cellCoordinates) {
                    container
                        .find(`.automated-bar__grid-cell[data-grid-index="${cellCoordinates[0]}-${cellCoordinates[1]}"]`)
                        .find('.automated-bar__grid-cell__overlay')
                        .removeClass('automated-bar__grid-cell__disabled');
                });

                container.find('.automated-bar__grid-cell__disabled').removeClass('d-none');
                break;
            default:
                delete this.state.tutorialBar;
                delete this.state.tutorialTable;
        }
    };

    /**
     * Render the management for a single item
     *
     * @param {Number} gridRow
     * @param {Number} gridColumn
     *
     * @private
     */
    AutomatedBar.prototype._showItemManagement = function (gridRow, gridColumn) {
        if (this.state.tutorial === 3) {
            this.state.tutorial++;
            $('.automated-bar__grid-cell__disabled').removeClass('automated-bar__grid-cell__disabled');
            $('#automated-bar__tutorial').remove();
        }

        $('#automated-bar__overlay__container').find('.automated-bar__grid-cell__popover').popover('hide');

        const container   = $('#automated-bar__item-management-container'),
              itemType    = ITEM_MAP[this.state.grid[gridRow][gridColumn].item],
              itemLevel   = this.state.grid[gridRow][gridColumn].level || 0,
              upgrade     = this.upgradeStorage.getAvailableUpgrade(itemType, itemLevel),
              upgradePath = upgrade ? `level.${itemType}.${itemLevel + 1}` : null;

        container.html(
            Mustache.render(
                TemplateStorage.get('automated-bar__item-management-template'),
                {
                    upgradePath:      upgradePath,
                    upgradeAvailable: upgrade
                                         ? this.upgradeStorage.getUpgradeCosts(upgradePath) <= this.state.ownedBeer
                                         : false,
                    level:            this.state.grid[gridRow][gridColumn].level
                                         ? this.numberFormatter.romanize(this.state.grid[gridRow][gridColumn].level)
                                         : '-',
                    item:             this.state.grid[gridRow][gridColumn].item,
                    value:            this.numberFormatter.formatInt(this._getItemRefund(gridRow, gridColumn)),
                    load:             `${
                                        this.numberFormatter.formatInt(this.gridLoadState[gridRow][gridColumn].delivered)
                                      }/${
                                        this.numberFormatter.formatInt(this.gridLoadState[gridRow][gridColumn].available)
                                      }`,
                }
            )
        );

        container.data('grid-row', gridRow);
        container.data('grid-column', gridColumn);

        container.removeClass('d-none');

        this.managedItem = [gridRow, gridColumn];
        this._initItemManagementEventListener(gridRow, gridColumn);

        $('.automated-bar__grid-cell__selected')
            .removeClass('automated-bar__grid-cell__selected');
        $(`.automated-bar__grid-cell[data-grid-index="${gridRow}-${gridColumn}"]`)
            .addClass('automated-bar__grid-cell__selected');

        if (this.maps.loadMap) {
            $('.automated-bar__grid-cell__overlay__load').addClass('d-none');
            $('.automated-bar__grid-cell__overlay__distribution')
                .removeClassRegex(/(automated-bar__grid-cell__overlay__load-\d+|d-none)/);

            this._addItemLoadClasses(gridRow, gridColumn);
        }
    };

    /**
     * Add event listeners to the management of a single item
     *
     * @param {Number} gridRow
     * @param {Number} gridColumn
     *
     * @private
     */
    AutomatedBar.prototype._initItemManagementEventListener = function (gridRow, gridColumn) {
        const upgradeStorage = this.upgradeStorage,
              upgradeButton  = $('#automated-bar__item-upgrade');

        upgradeButton.closest('.automated-bar__item-level-up-tooltip').tooltip({
            title: function () {
                const upgrade = $(this).data('upgrade');

                return Mustache.render(
                    TemplateStorage.get('upgrade-tooltip-template__costs'),
                    {
                        costsLabel: translator.translate('automatedBar.beersLabel'),
                        path:       'automatedBar.upgrade.' + upgrade,
                        costs:      (new Beerplop.NumberFormatter()).formatInt(
                            upgradeStorage.getUpgradeByPath(upgrade).costs / 2
                        )
                    }
                );
            }
        });

        upgradeButton.on('click', (function (event) {
            if (this.moveItem || !this.removeBeers(upgradeStorage.getUpgradeCosts($(event.target).data('upgrade')))) {
                return;
            }

            if (!this.state.grid[gridRow][gridColumn].level) {
                this.state.grid[gridRow][gridColumn].level = 0;
            }

            this.state.grid[gridRow][gridColumn].level++;

            $(event.target).closest('.automated-bar__tooltip').tooltip('dispose');
            this._updateGrid();

            if (this.managedItem) {
                this._showItemManagement(this.managedItem[0], this.managedItem[1]);
            }
        }).bind(this));

        $('#automated-bar__item-close').on(
            'click',
            () => {
                if (this.moveItem) {
                    return;
                }

                $('#automated-bar__item-management-container').addClass('d-none');
                $('.automated-bar__grid-cell__selected').removeClass('automated-bar__grid-cell__selected');

                this.managedItem = null;
                this._switchToGlobalLoadMap();
            }
        );

        $('#automated-bar__item-sell').on(
            'click',
            () => {
                if (this.moveItem) {
                    return;
                }

                this.state.ownedBeer += this._getItemRefund(gridRow, gridColumn);
                this.state.grid[gridRow][gridColumn] = null;

                $('#automated-bar__item-management-container').addClass('d-none');
                this.managedItem = null;

                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.buildingMG.automatedBar.sell
                );

                this._switchToGlobalLoadMap();
                this._updateGrid();
            }
        );

        $('#automated-bar__item-move').on(
            'click',
            () => {
                $('#automated-bar__item-move').find('.automated-bar__item-move__label').toggleClass('d-none');

                if (this.moveItem) {
                    const container = $('#automated-bar__overlay__container');

                    container.find('.automated-bar__grid-cell__disabled').addClass('d-none');
                    $('.btn__automated-bar__move-disabled:not(#automated-bar__item-upgrade)')
                        .closest('fieldset')
                        .prop('disabled', false);
                    this._updateItemUpgradeAvailability();

                    container
                        .find('.automated-bar__grid-cell__disabled')
                        .removeClass('automated-bar__grid-cell__disabled');

                    this.moveItem = null;

                    return;
                }

                this.moveItem = [gridRow, gridColumn];
                this._disableFieldsWithItems();

                // disable buttons to force finishing the move process before doing something else
                $('.btn__automated-bar__move-disabled').closest('fieldset').prop('disabled', true);
            }
        );
    };

    /**
     * Disable all fields which contain an item
     *
     * @private
     */
    AutomatedBar.prototype._disableFieldsWithItems = function () {
        const container = $('#automated-bar__overlay__container');

        // all cells which already contain an item have a popover. Disable those fields for moving
        container
            .find('.automated-bar__grid-cell__popover')
            .find('.automated-bar__grid-cell__overlay')
            .addClass('automated-bar__grid-cell__disabled');

        container.find('.automated-bar__grid-cell__disabled').removeClass('d-none');
    };

    /**
     * Check if the loadmap is active. If it is active switch to the global load map and hide the load map for a
     * specific item
     *
     * @private
     */
    AutomatedBar.prototype._switchToGlobalLoadMap = function () {
        if (this.maps.loadMap) {
            const container = $('#automated-bar__overlay__container');

            container.find('.automated-bar__grid-cell__overlay__load').removeClass('d-none');
            container.find('.automated-bar__grid-cell__overlay__distribution').addClass('d-none');
        }
    };

    /**
     * Add classes to show the load of a specific item
     *
     * @param {Number} gridRow
     * @param {Number} gridColumn
     *
     * @private
     */
    AutomatedBar.prototype._addItemLoadClasses = function (gridRow, gridColumn) {
        const container = $('#automated-bar__overlay__container');

        if (this.state.grid[gridRow][gridColumn].item === TYPE_COOLING_ENGINE) {
            const range    = this._getCoolingEngineRange(this.state.grid[gridRow][gridColumn]),
                  affected = (row, column) => container
                .find(`.automated-bar__grid-cell[data-grid-index="${row}-${column}"]`)
                .find('.automated-bar__grid-cell__overlay__distribution')
                .addClass('automated-bar__grid-cell__overlay__load-0');

            for (let rangeCounter = 1; rangeCounter <= range; rangeCounter++) {
                for (let spread = -(range - rangeCounter); spread <= (range - rangeCounter); spread++) {
                    affected(gridRow - rangeCounter, gridColumn + spread);
                    affected(gridRow + rangeCounter, gridColumn + spread);
                }

                affected(gridRow, gridColumn - rangeCounter);
                affected(gridRow, gridColumn + rangeCounter);
            }

            return;
        }

        this.affectedDeliveryGrid = this.recalculateConsumedBeers(gridRow, gridColumn);
        $.each(this.affectedDeliveryGrid, (function (rowIndex, row) {
            $.each(row, (function (columnIndex, cell) {
                if (!cell || !cell.node || !cell.node.affectedDelivered) {
                    return;
                }

                const load    = cell.node.affectedDelivered / cell.node.available,
                      element = container
                          .find(`.automated-bar__grid-cell[data-grid-index="${rowIndex}-${columnIndex}"]`)
                          .find('.automated-bar__grid-cell__overlay__distribution');

                element.addClass(this._getLoadClass(cell.item === TYPE_SINGLE_TABLE ? 1 - load : load));
            }).bind(this));
        }).bind(this));
    };

    /**
     * Show the dialog to equip a cell on the grid
     *
     * @param {int} gridRow    The row inside the grid to equip
     * @param {int} gridColumn The column inside the grid to equip
     */
    AutomatedBar.prototype._showCellEquipDialog = function (gridRow, gridColumn) {
        const modal     = $('#equip-modal'),
              modalBody = $('#equip-modal__body');

        let items = this.availableItems;
        switch (this.state.tutorial) {
            case 0:
                items = [0];
                this.state.tutorialBar = [gridRow, gridColumn];
                break;
            case 1:
                items = [1];
                this.state.tutorialTable = [gridRow, gridColumn];
                break;
            case 2:
                items = [2];
                break;
        }

        modalBody.html(
            Mustache.render(
                TemplateStorage.get('automated-bar__equip-cell-modal__body-template'),
                {
                    availableItems: items,
                }
            )
        );

        modal.find('.modal-title').text(translator.translate('automatedBar.modal.title'));

        const availableItems = modalBody.find('.beer-factory__slot'),
              automatedBar   = this;

        availableItems.tooltip({
            title: function () {
                const type     = $(this).data('item'),
                      costNext = automatedBar._getCostNext(type);

                return Mustache.render(
                    TemplateStorage.get('automated-bar__available-item-tooltip-template'),
                    {
                        index:     type,
                        available: costNext <= automatedBar.state.ownedBeer,
                        cost:      translator.translate(
                            'automatedBar.beers',
                            {
                                __AMOUNT__: automatedBar.numberFormatter.formatInt(costNext),
                            }
                        ),
                    }
                );
            }
        });

        availableItems.on('click', (function (event) {
            const item = $(event.target).closest('.beer-factory__slot').data('item'),
                  cost = this._getCostNext(item);

            if (!this.removeBeers(cost)) {
                return;
            }

            if (this.state.tutorial < 3) {
                this.state.tutorial++;
            }

            this.state.grid[gridRow][gridColumn] = {
                item: item,
            };

            this._checkItemAmountAchievements();
            modal.modal('hide');
            this._updateGrid();
        }).bind(this));

        modal.modal('show');
    };

    AutomatedBar.prototype._checkItemAmountAchievements = function () {
        let itemList = [...Object.keys(ITEM_MAP)].map(() => 0);

        $.each(this.state.grid, function (rowIndex, row) {
            $.each(row, function (columnIndex, cell) {
                if (cell) {
                    itemList[cell.item]++;
                }
            });
        });

        $.each(itemList, (itemIndex, amount) => this.achievementController.checkAmountAchievement(
            this.achievementController
                .getAchievementStorage()
                .achievements
                .buildingMG
                .automatedBar
                .items[ITEM_MAP[itemIndex]],
            amount
        ));
    };

    AutomatedBar.prototype._getCostNext = function (type, shift = 0) {
        let baseCost = {};

        baseCost[TYPE_BAR]            = [200, 4];
        baseCost[TYPE_SINGLE_TABLE]   = [25,  1.35];
        baseCost[TYPE_PIPE]           = [75,  1.55];
        baseCost[TYPE_COOLING_ENGINE] = [2e6, 1.75];

        return Math.floor(
            baseCost[type][0]
                * Math.pow(baseCost[type][1], this._getAmountOfType(type) + shift)
                * this._getGlobalPriceReduction()
        );
    };

    /**
     * Calculate the amount of cells which are equipped with the requested item type on the current grid
     *
     * @param {Number} type
     *
     * @returns {Number}
     *
     * @private
     */
    AutomatedBar.prototype._getAmountOfType = function (type) {
        return this.state.grid.reduce(
            (prev, current) => prev + current.reduce(
                (prev, current) => prev + (current && current.item === type ? 1 : 0),
                0
            ),
            0
        );
    };

    /**
     * Initialize an empty grid
     *
     * @private
     */
    AutomatedBar.prototype._initGrid = function () {
        if (this.state.grid.length > 0) {
            return;
        }

        for (let i = 0; i < INITIAL_GRID_SIZE; i++) {
            this.pushRow();
            this.pushColumn();
        }
    };

    /**
     * Adds a new row to the grid
     */
    AutomatedBar.prototype.pushRow = function () {
        this.state.grid.push([...Array(this.state.grid[0] ? this.state.grid[0].length : 0)].map(() => null));
    };

    /**
     * Adds a new column to the grid
     */
    AutomatedBar.prototype.pushColumn = function () {
        $.each(this.state.grid, (index) => this.state.grid[index].push(null));
    };

    AutomatedBar.prototype._getBarCapacity = function (cell, base = false) {
        return Math.ceil(
            (50 + (cell.level || 0) * 25)
                * (base ? 1 : (cell.boost.capacity || 1))
                * this._getGlobalCapacityBoost()
        );
    };

    AutomatedBar.prototype._getTableCapacity = function (cell, base = false) {
        return Math.ceil(
            (8 + (cell.level || 0) * 2)
                * (base ? 1 : (cell.boost.capacity || 1))
                * this._getGlobalCapacityBoost()
        );
    };

    AutomatedBar.prototype._getPipeCapacity = function (cell, base = false) {
        const level = (cell.level || 0);

        return Math.ceil(
            (25 + level * (7 + level))
                * (base ? 1 : (cell.boost.capacity || 1))
                * this._getGlobalCapacityBoost()
        );
    };

    AutomatedBar.prototype._getCoolingEngineRange = function (cell) {
        return (cell.level || 0) + 1;
    };

    AutomatedBar.prototype._getGlobalCapacityBoost = function () {
        if (!this.cache.globalCapacityBoost) {
            this.cache.globalCapacityBoost = Math.pow(2, this.state.level);

            $.each(this.upgradeStorage.upgrades.level.capacity, (function (level, upgrade) {
                if (!upgrade.reached) {
                    return false;
                }

                this.cache.globalCapacityBoost *= 1.25;
            }).bind(this));
        }

        return this.cache.globalCapacityBoost;
    };

    AutomatedBar.prototype._getGlobalPriceReduction = function () {
        if (!this.cache.globalPriceReduction) {
            this.cache.globalPriceReduction = 1;

            $.each(this.upgradeStorage.upgrades.level.price, (function (level, upgrade) {
                if (!upgrade.reached) {
                    return false;
                }

                this.cache.globalPriceReduction *= 0.75;
            }).bind(this));
        }

        return this.cache.globalPriceReduction;
    };

    AutomatedBar.prototype._getBaseCapacity = function (cell) {
        if (!cell) {
            return 0;
        }

        switch (cell.item) {
            case TYPE_BAR:          return this._getBarCapacity(cell, true);
            case TYPE_PIPE:         return this._getPipeCapacity(cell, true);
            case TYPE_SINGLE_TABLE: return this._getTableCapacity(cell, true);
        }
    };

    /**
     * Recalculate the consumed beers based on the currently constructed grid by setting up a node graph representing
     * the bar and afterwards delivering the beer through the graph
     */
    AutomatedBar.prototype.recalculateConsumedBeers = function (gridRow = null, gridColumn = null) {
        this._recalculateBoostData();

        let grid     = JSON.parse(JSON.stringify(this.state.grid)),
            barNodes = this._parseGrid(grid);

        $.each(barNodes, (function deliverBeerFromBar(index, bar) {
            bar.available         = this._getBarCapacity(bar.cell);
            bar.delivered         = 0;
            bar.affectedDelivered = 0;

            $.each(bar.connectedTables, (function deliverBeerToTableConnectedToBar(index, table) {
                // if the consumption for a specific cell is requested skip all other direct connections
                const affected = (gridRow !== null && gridColumn !== null) &&
                    (
                        (gridRow === bar.row && gridColumn === bar.col) ||
                        (gridRow === table.row && gridColumn === table.col)
                    );

                if (!table.available) {
                    table.available         = this._getTableCapacity(table.cell);
                    table.delivered         = 0;
                    table.affectedDelivered = 0;
                }

                const delivered = Math.min(
                    table.available - table.delivered,
                    bar.available - bar.delivered,
                );

                //console.log("delivering from bar [" + bar.row + ", " + bar.col + "] " + delivered + " beer to table [" + table.row + ", " + table.col + "]");
                table.delivered += delivered;
                bar.delivered   += delivered;

                if (affected) {
                    table.affectedDelivered += delivered;
                    bar.affectedDelivered   += delivered;
                }
            }).bind(this));

            // serve via pipe
            this._serveConnectedNodes(bar, bar, gridRow, gridColumn);
        }).bind(this));

        // if it's a global recalculation transfer the state into the DOM and the internal calculation cache
        if (gridRow === null && gridColumn === null) {
            this._transferGridState(grid);
        }

        return grid;
    };

    AutomatedBar.prototype._recalculateBoostData = function () {
        $.each(this.state.grid, function (rowIndex, row) {
            $.each(row, function (columnIndex, cell) {
                if (cell) {
                    cell.boost = {};
                }
            });
        });

        $.each(this.state.grid, (function (rowIndex, row) {
            $.each(row, (function (columnIndex, cell) {
                if (!cell) {
                    return;
                }

                switch (cell.item) {
                    case TYPE_COOLING_ENGINE:
                        this._addBoostToSurroundingCells(
                            rowIndex,
                            columnIndex,
                            (boost) => {
                                if (!boost.capacity) {
                                    boost.capacity = 1;
                                }

                                boost.capacity *= 2;

                                return boost;
                            },
                            this._getCoolingEngineRange(cell),
                        );

                        break;
                }
            }).bind(this));
        }).bind(this));
    };

    /**
     * Apply a boost modifying callback to all cells surrounding the given cell
     *
     * @param {number}   rowIndex    Row of the given cell
     * @param {number}   columnIndex Column of the given cell
     * @param {function} callback    The function which shall be applied to the boost
     * @param {number}   range       [optional] the range of the boost
     *
     * @private
     */
    AutomatedBar.prototype._addBoostToSurroundingCells = function (rowIndex, columnIndex, callback, range = 1) {
        for (let rangeCounter = 1; rangeCounter <= range; rangeCounter++) {
            for (let spread = -(range - rangeCounter); spread <= (range - rangeCounter); spread++) {
                this._modifyBoost(rowIndex - rangeCounter, columnIndex + spread, callback);
                this._modifyBoost(rowIndex + rangeCounter, columnIndex + spread, callback);
            }

            this._modifyBoost(rowIndex, columnIndex - rangeCounter, callback);
            this._modifyBoost(rowIndex, columnIndex + rangeCounter, callback);
        }
    };

    /**
     * Apply a boost modifying callback function to the boost of a cell. Returns true if the callback was applied.
     * False on error (cell doesn't exist or cell is empty)
     *
     * @param {number}   rowIndex
     * @param {number}   columnIndex
     * @param {function} callback
     *
     * @return {boolean}
     *
     * @private
     */
    AutomatedBar.prototype._modifyBoost = function (rowIndex, columnIndex, callback) {
        let cell;

        try {
            cell = this.state.grid[rowIndex][columnIndex];

            if (!cell) {
                return false;
            }
        } catch (e) {
            return false;
        }

        cell.boost = callback(cell.boost);
        return true;
    };

    /**
     * Transfer the state of the given grid into the current load grid
     *
     * @param {Array} grid
     *
     * @private
     */
    AutomatedBar.prototype._transferGridState = function (grid) {
        const container = $('#automated-bar__overlay__container');

        // set up an empty grid to store the current load
        this.gridLoadState = [...Array(this.state.grid.length)].map(
            () => [...Array(this.state.grid[0].length)].map(() => null)
        );
        this.consumedBeer = 0;

        $.each(grid, (function (rowIndex, row) {
            $.each(row, (function (columnIndex, cell) {
                if (!cell) {
                    return;
                }

                const element = container.find(`.automated-bar__grid-cell[data-grid-index="${rowIndex}-${columnIndex}"]`),
                      overlay = element.find('.automated-bar__grid-cell__overlay');

                overlay.removeClassRegex(/automated-bar__grid-cell__(load|level)-\d+/);

                // handle a not connected node
                if (!cell.node) {
                    this.gridLoadState[rowIndex][columnIndex] = {
                        available: cell.item === TYPE_SINGLE_TABLE
                                       ? this._getTableCapacity(cell)
                                       : this._getPipeCapacity(cell),
                        delivered: 0,
                        load:      cell.item === TYPE_SINGLE_TABLE ? 1 : 0
                    };
                } else {
                    const load = cell.node.delivered / cell.node.available;

                    this.gridLoadState[rowIndex][columnIndex] = {
                        available: cell.node.available,
                        delivered: cell.node.delivered,
                        load:      cell.item === TYPE_SINGLE_TABLE ? 1 - load : load,
                    };

                    if (cell.item === TYPE_SINGLE_TABLE) {
                        this.consumedBeer += cell.node.delivered;
                    }
                }

                element.data('available', this.gridLoadState[rowIndex][columnIndex].available);
                element.data('delivered', this.gridLoadState[rowIndex][columnIndex].delivered);
                element.data('load', this.gridLoadState[rowIndex][columnIndex].load);

                element
                    .find('.automated-bar__grid-cell__overlay__load')
                    .addClass(this._getLoadClass(this.gridLoadState[rowIndex][columnIndex].load));

                element
                    .find('.automated-bar__grid-cell__overlay__level')
                    .addClass('automated-bar__grid-cell__overlay__level-' + (cell.level || 0));
            }).bind(this));
        }).bind(this));

        $('#automated-bar__per-second').text(this.numberFormatter.formatInt(this.consumedBeer));
        this._updateCurrentEffects();

        this.gameEventBus.emit(EVENTS.AUTOMATED_BAR.UPDATE, this.consumedBeer);
        ComposedValueRegistry.getComposedValue(CV_BOTTLE_CAP).triggerModifierChange('AutomatedBar');
    };

    AutomatedBar.prototype._getLoadClass = function (load) {
        if (load === 1) {
            return 'automated-bar__grid-cell__overlay__load-100';
        } else if (load >= 0.9) {
            return 'automated-bar__grid-cell__overlay__load-90';
        } else if (load >= 0.75) {
            return 'automated-bar__grid-cell__overlay__load-75';
        }

        return 'automated-bar__grid-cell__overlay__load-0'
    };

    /**
     * Serve connected nodes recursive
     *
     * @param {Object} servingBar    The bar which currently serves the nodes
     * @param {Object} node          The node whose connected nodes shall be checked
     * @param {Number} gridRow       Row coordinates if delivery data for a specific cell is requested
     * @param {Number} gridColumn    Column coordinates if delivery data for a specific cell is requested
     * @param {Array}  deliveryChain The delivery chain to track served beer through the pipes
     *
     * @private
     */
    AutomatedBar.prototype._serveConnectedNodes = function (
        servingBar,
        node,
        gridRow = null,
        gridColumn = null,
        deliveryChain = []
    ) {
        //console.log("_serveConnectedNodes delivering from bar [" + servingBar.row + ", " + servingBar.col + "]");

        $.each(node.connectedNodes, (function deliverBeerToConnectedPipe(index, pipe) {
            //console.log("deliverBeerToConnectedPipe delivering from bar [" + servingBar.row + ", " + servingBar.col + "] to pipe [" + pipe.row + ", " + pipe.col + "]");

            // this bar already has served through this pipe
            if (pipe.servingBars) {
                let alreadyServed = false;
                $.each(pipe.servingBars, function (index, alreadyServedBar) {
                    if (alreadyServedBar.row === servingBar.row && alreadyServedBar.col === servingBar.col) {
                        alreadyServed = true;
                        return false;
                    }
                });

                if (alreadyServed) {
                    return;
                }
            }

            // initialize the pipe
            if (!pipe.available) {
                pipe.available         = this._getPipeCapacity(pipe.cell);
                pipe.delivered         = 0;
                pipe.affectedDelivered = 0;
                pipe.servingBars       = [servingBar];
            } else {
                pipe.servingBars.push(servingBar);
            }

            // if a specific cell is requested check if the current pipe is affected by the requested cell. Either the
            // requested cell is the current pipe, a parent pipe or the current serving bar
            const specificCellDataAffected = (gridRow !== null && gridColumn !== null) &&
                (
                    (pipe.row === gridRow && pipe.col === gridColumn) ||
                    (servingBar.row === gridRow && servingBar.col === gridColumn) ||
                    deliveryChain.reduce(
                        (affected, parentPipe) => affected || (parentPipe.row === gridRow && parentPipe.col === gridColumn),
                        false
                    )
                );

            // serve connected tables
            $.each(pipe.connectedTables, (function deliverBeerToTableConnectedToPipe(index, table) {
                // if the consumption for a specific cell is requested skip all not affected cells
                const affected = (gridRow !== null && gridColumn !== null) &&
                    (
                        specificCellDataAffected ||
                        (table.row === gridRow && table.col === gridColumn)
                    );

                if (!table.available) {
                    table.available         = this._getTableCapacity(table.cell);
                    table.delivered         = 0;
                    table.affectedDelivered = 0;
                }

                let delivered = Math.min(
                    table.available - table.delivered,
                    servingBar.available - servingBar.delivered,
                    pipe.available - pipe.delivered,
                    ...deliveryChain.map(parentPipe => parentPipe.available - parentPipe.delivered),
                );

                table.delivered      += delivered;
                servingBar.delivered += delivered;
                pipe.delivered       += delivered;

                if (affected) {
                    table.affectedDelivered      += delivered;
                    servingBar.affectedDelivered += delivered;
                    pipe.affectedDelivered       += delivered;
                }

                //console.log("delivering from bar [" + servingBar.row + ", " + servingBar.col + "] " + delivered + " beer to table [" + table.row + ", " + table.col + "]");

                deliveryChain.forEach(parentPipe => {
                    parentPipe.delivered += delivered;

                    if (affected) {
                        parentPipe.affectedDelivered += delivered;
                    }
                });
            }).bind(this));

            // serve further connected nodes
            this._serveConnectedNodes(servingBar, pipe, gridRow, gridColumn, [...deliveryChain, pipe]);
        }).bind(this));
    };

    /**
     * Parse a grid and set up the nodes with all internal connections. Returns an array containing all bar nodes
     *
     * @param {Array} grid
     *
     * @returns {Array}
     *
     * @private
     */
    AutomatedBar.prototype._parseGrid = function (grid) {
        let rootNodes = [];

        $.each(grid, (function (rowIndex, row) {
            $.each(row, (function (columnIndex, cell) {
                if (!cell) {
                    return;
                }

                if (cell.item === TYPE_BAR) {
                    if (!cell.node) {
                        cell.node = {
                            cell:            cell,
                            col:             columnIndex,
                            row:             rowIndex,
                            connectedNodes:  [],
                            connectedTables: [],
                        };

                        this._parseEnvironment(grid, cell.node);
                    }

                    rootNodes.push(cell.node);
                }
            }).bind(this));
        }).bind(this));

        return rootNodes;
    };

    /**
     * Parse the environment of a given node and insert links into the grid
     *
     * @param {Array}  grid
     * @param {Object} node
     *
     * @private
     */
    AutomatedBar.prototype._parseEnvironment = function (grid, node) {
        $.each([
            [node.row - 1, node.col, 'top'],
            [node.row + 1, node.col, 'bottom'],
            [node.row, node.col - 1, 'left'],
            [node.row, node.col + 1, 'right'],
        ], (function (index, cellCoordinates) {
            let cell = null;

            // try to access the requested cell. If the cell is not available or empty return the parsing process.
            try {
                cell = grid[cellCoordinates[0]][cellCoordinates[1]];

                if (!cell) {
                    return;
                }
            } catch (e) {
                return;
            }

            // attach the classes to display a correctly connected pipe
            if (node.cell.item === TYPE_PIPE) {
                $('#automated-bar__overlay__container')
                    .find(`.automated-bar__grid-cell[data-grid-index="${node.row}-${node.col}"]`)
                    .addClass('pipe-connected__' + cellCoordinates[2]);
            }

            switch (cell.item) {
                case TYPE_PIPE:
                    // if the cell wasn't parsed yet create a new node, else backlink to an existing node and break
                    // the parsing process
                    if (!cell.node) {
                        cell.node = {
                            cell:            cell,
                            col:             cellCoordinates[1],
                            row:             cellCoordinates[0],
                            connectedNodes:  [],
                            connectedTables: [],
                        };

                        this._parseEnvironment(grid, cell.node);
                    }

                    node.connectedNodes.push(cell.node);
                    break;
                case TYPE_SINGLE_TABLE:
                    if (!cell.node) {
                        cell.node = {
                            cell: cell,
                            col:  cellCoordinates[1],
                            row:  cellCoordinates[0],
                        };
                    }

                    node.connectedTables.push(cell.node);

                    break;
            }
        }).bind(this));
    };

    AutomatedBar.prototype.unlockItem = function (item) {
        this.availableItems.push(item);
    };

    AutomatedBar.prototype.getItems = function () {
        return Object.values(ITEM_MAP);
    };

    buildingMinigames.AutomatedBar = AutomatedBar;
})(BuildingMinigames);
