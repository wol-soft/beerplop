(function(beerplop) {
    'use strict';

    HolyUpgradeStorage.prototype.reachedUpgrades = [];

    HolyUpgradeStorage.prototype.upgrades = {};

    HolyUpgradeStorage.prototype.gameState         = null;
    HolyUpgradeStorage.prototype.levelController   = null;
    HolyUpgradeStorage.prototype.upgradeController = null;
    HolyUpgradeStorage.prototype.buffController    = null;
    HolyUpgradeStorage.prototype.gameEventBus      = null;

    HolyUpgradeStorage.prototype.nightSky = null;

    // store the initial viewBox of the map to reset map zooming on reincarnation
    HolyUpgradeStorage.prototype.initialViewBox = null;

    HolyUpgradeStorage.prototype.isSacrificed = false;

    /**
     * Initialize the holy upgrade storage
     *
     * @constructor
     */
    function HolyUpgradeStorage(gameState, gameEventBus, levelController, upgradeController, buffController) {
        this.gameState         = gameState;
        this.levelController   = levelController;
        this.upgradeController = upgradeController;
        this.buffController    = buffController;
        this.gameEventBus      = gameEventBus;

        (new Beerplop.GamePersistor()).registerModule(
            'HolyUpgradeStorage',
            (function () {
                return {
                    reachedUpgrades: Object.values(this.reachedUpgrades),
                    isSacrificed:    this.isSacrificed
                };
            }.bind(this)),
            (function (loadedData) {
                this.reachedUpgrades = loadedData.reachedUpgrades || [];

                $.each(this.reachedUpgrades, (function (index, upgrade) {
                    if (!this.upgrades[upgrade]) {
                        console.log('Missing Holy Upgrade: ' + upgrade);
                        return;
                    }

                    this.upgrades[upgrade].reached = true;
                    this.upgrades[upgrade].upgrade(true);
                }).bind(this));

                if (loadedData.isSacrificed) {
                    assetPromises['svg'].then(() => {
                        this.isSacrificed = true;
                        this._showHolyBeerOverlay();
                        this.gameState.setCoreIterationLock();
                    });
                }
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function () {
            this.isSacrificed = true;
            this._showHolyBeerOverlay();
            this.gameState.setCoreIterationLock();

            window.setTimeout(
                (function () {
                    $.each(this.upgrades, function () {
                        if (this.reached) {
                            this.upgrade();
                        }
                    });
                }).bind(this),
                0
            );
        }).bind(this));

        this.gameEventBus.on(EVENTS.CORE.INFINITY_SACRIFICE, (function () {
            $.each(this.upgrades, function () {
                if (this.reached) {
                    this.reached = false;
                }
            });
        }).bind(this));

        this._initUpgrades();

        assetPromises['modals'].then(() => $('#reincarnate-button').on('click', (function () {
                this.gameState.releaseCoreIterationLock();
                this.isSacrificed = false;

                $('#sacrifice-overlay').addClass('d-none');
                $('#holy-upgrades-map-svg').attr('viewBox', this.initialViewBox);

                this.gameEventBus.emit(EVENTS.CORE.REINCARNATE);

                this.nightSky.destroy();
            }).bind(this))
        );
    }

    HolyUpgradeStorage.prototype.isUpgradeAvailable = function (upgrade) {
        // check reached state and costs
        if (this.upgrades[upgrade].reached ||
            this.upgrades[upgrade].costs > this.levelController.getAvailableBeerMats()
        ) {
            return false;
        }

        let available = true;
        // check required upgrades
        $.each(this.upgrades[upgrade].depends, (function (index, upgradeDependency) {
            if (!this.upgrades[upgradeDependency].reached) {
                available = false;
            }
        }).bind(this));

        return available;
    };

    HolyUpgradeStorage.prototype._showHolyBeerOverlay = function () {
        this.nightSky = new Beerplop.NightSky('#holy-upgrades__sky');

        const map = $('#holy-upgrades-map-svg');
        map.empty();

        const upgradeStorage  = this;

        let icons                       = {},
            skipUpgrades                = [],
            secondaryParentDependencies = {};

        $.each(this.upgrades, (function renderHolyUpgradesTree(upgradeKey, upgrade) {
            // collect all upgrades which can be skipped as they are far away from being reached
            let dependsReached         = !upgrade.depends.length,
                secondParentNotReached = false;

            // set up a list of parent-parent dependencies to examine which upgrades must be made visible after
            // purchasing a new holy upgrade
            secondaryParentDependencies[upgradeKey] = [];

            $.each(upgrade.depends, (function (index, key) {
                if (this.upgrades[key].reached || key === 'sourceOfLife') {
                    dependsReached = true;
                }

                $.each(this.upgrades[key].depends, (function (index, key) {
                    secondaryParentDependencies[upgradeKey].push(key);

                    if (this.upgrades[key].reached) {
                        dependsReached = true;
                    } else {
                        secondParentNotReached = true;
                    }
                }).bind(this));
            }).bind(this));

            // if the upgrade has invisible dependencies skip the upgrade if one of the invisible dependencies
            // is not reached
            $.each(upgrade.invisibleDepends || [], (function (index, key) {
                if (!this.upgrades[key].reached) {
                    dependsReached = false;
                }
            }).bind(this));

            // a upgrade is only visible if all second level parent upgrades are reached
            if (!dependsReached || secondParentNotReached) {
                skipUpgrades.push(upgradeKey);
            }

            const upgradeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            upgradeGroup.setAttributeNS(null, 'id', 'holy-upgrade-tree-group-' + upgradeKey);
            upgradeGroup.setAttributeNS(null, 'transform', 'translate(' + (upgrade.coordinates[0] - 40) + ', ' + (upgrade.coordinates[1] - 40) + ') scale(2)');

            icons[upgradeKey] = upgradeGroup;

            $.each(upgrade.depends, (function (index, key) {
                const dependUpgrade = this.upgrades[key];

                let connector = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                connector.setAttribute('x1', (upgrade.coordinates[0]));
                connector.setAttribute('y1', (upgrade.coordinates[1]));
                connector.setAttribute('x2', (dependUpgrade.coordinates[0]));
                connector.setAttribute('y2', (dependUpgrade.coordinates[1]));
                connector.setAttribute('class', 'holy-upgrade__dependency-line visibility-control__' + upgradeKey);
                document.getElementById("holy-upgrades-map-svg").appendChild(connector);
            }).bind(this));
        }).bind(this));

        $.each(icons, function (upgradeKey, upgradeGroup) {
            document.getElementById("holy-upgrades-map-svg").appendChild(upgradeGroup);
            const element = $('#holy-upgrade-tree-group-' + upgradeKey);
            element.html($('#svg-holy-upgrade-' + upgradeKey).html());
            const holyUpgradeItem = element.find('.holy-upgrade-item');

            holyUpgradeItem.attr('id', holyUpgradeItem.attr('id').split('-').slice(0, 3).join('-'));
            element.addClass('visibility-control__' + upgradeKey);
        });

        $.each(skipUpgrades, function (index, upgradeKey) {
            $('.visibility-control__' + upgradeKey).addClass('d-none');
        });

        $('#sacrifice-beermats').html(
            (new Beerplop.NumberFormatter()).formatInt(this.levelController.getAvailableBeerMats())
        );

        // add the correct classes for availability
        $('.holy-upgrade-not-available').removeClass('holy-upgrade-not-available');
        $.each(this.upgrades, (function (upgradeKey) {
            if (!this.upgrades[upgradeKey].reached && !this.isUpgradeAvailable(upgradeKey)) {
                $('#holy-upgrade-' + upgradeKey).addClass('holy-upgrade-not-available');
            }

            if (this.upgrades[upgradeKey].reached) {
                $('#holy-upgrade-' + upgradeKey).addClass('holy-upgrade-reached');
            }
        }).bind(this));

        $('#sacrifice-overlay').removeClass('d-none');
        $('#holy-upgrade-tree-group-sourceOfLife').get(0).scrollIntoView({
            behavior: 'auto',
            block: 'center',
            inline: 'center'
        });

        map.find('.holy-upgrade-item').tooltip({
            html: true,
            title: function () {
                const upgrade     = $(this).attr('id').split('-').slice(-1).pop(),
                      upgradeData = upgradeStorage.upgrades[upgrade];

                return Mustache.render(
                    TemplateStorage.get('upgrade-tooltip-template__costs'),
                    {
                        costsLabel: translator.translate('beermats'),
                        path:       `holyUpgrade.${upgrade}`,
                        costs:      (new Beerplop.NumberFormatter()).formatInt(upgradeData.costs)
                    }
                );
            }
        });

        map.find('.holy-upgrade-item').on('click', (function (event) {
            const upgrade = $(event.target).closest('.holy-upgrade-item').attr('id').split('-').slice(-1).pop();

            if (!this.isUpgradeAvailable(upgrade)) {
                return;
            }

            this.levelController.removeBeermats(this.upgrades[upgrade].costs);
            this.reachedUpgrades.push(upgrade);
            $('#holy-upgrade-' + upgrade).addClass('holy-upgrade-reached');

            this.upgrades[upgrade].reached = true;
            this.upgrades[upgrade].upgrade();

            // enable the upgrades which depend on the purchased upgrade
            $.each(this.upgrades, (function (upgradeKey, upgradeData) {
                if ($.inArray(upgrade, upgradeData.depends) !== -1 && this.isUpgradeAvailable(upgradeKey)) {
                    $('#holy-upgrade-' + upgradeKey).removeClass('holy-upgrade-not-available');
                }
            }).bind(this));

            // check if a currently hidden upgrade must be made visible
            $.each(skipUpgrades, (function (index, upgradeKey) {
                let secondaryParentsReached = true;

                $.each(secondaryParentDependencies[upgradeKey], (function (index, secondaryParentKey) {
                    if (!this.upgrades[secondaryParentKey].reached) {
                        secondaryParentsReached = false;
                    }
                }).bind(this));

                if (secondaryParentsReached) {
                    $('.visibility-control__' + upgradeKey).removeClass('d-none');
                }
            }).bind(this));
        }).bind(this));

        if(!this.initialViewBox) {
            this._initHolyUpgradesMapZoom();
        }
    };

    HolyUpgradeStorage.prototype._initHolyUpgradesMapZoom = function () {
        let zoomValue = 1;

        const map        = $('#holy-upgrades-map-svg'),
              zoomIn     = $('#holy-upgrades-map__zoom-in'),
              zoomOut    = $('#holy-upgrades-map__zoom-out'),
              baseWidth  = parseInt(map.attr('width')),
              baseHeight = parseInt(map.attr('height')),
              zoom       = function () {
                  const width       = baseWidth * zoomValue,
                        height      = baseHeight * zoomValue;

                  map.attr(
                      'viewBox',
                      [-(width - baseWidth) / 2, -(height - baseHeight) / 2, width, height].join(' ')
                  );
              };

        this.initialViewBox = map.attr('viewBox');

        zoomIn.on('click', function () {
            if (zoomValue === 1) {
                return;
            }

            zoomValue -= 0.5;
            zoom();

            zoomOut.removeClass('disabled');
            if (zoomValue === 1) {
                zoomIn.addClass('disabled');
            }
        });

        zoomOut.on('click', function () {
            if (zoomValue === 5) {
                return;
            }

            zoomValue += 0.5;
            zoom();

            zoomIn.removeClass('disabled');
            if (zoomValue === 5) {
                zoomOut.addClass('disabled');
            }
        });
    };

    HolyUpgradeStorage.prototype._initUpgrades = function () {
        this.upgrades = {
            sourceOfLife: {
                reached: false,
                upgrade: (function () {
                    assetPromises['modals'].then(
                        () => $('#reincarnate-button').closest('fieldset').prop('disabled', false)
                    );
                }).bind(this),
                costs: 500,
                coordinates: [1200, 550],
                depends: []
            },
            bottleCapShip: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapProductionMultiplier(1);
                }).bind(this),
                costs: 15e2,
                coordinates: [1000, 500],
                depends: [
                    'sourceOfLife'
                ]
            },
            fallout: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapProductionMultiplier(1);
                }).bind(this),
                costs: 15e3,
                coordinates: [900, 300],
                depends: [
                    'bottleCapShip'
                ]
            },
            bottleCapWalls: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapProductionMultiplier(1);
                }).bind(this),
                costs: 15e4,
                coordinates: [700, 250],
                depends: [
                    'fallout'
                ]
            },
            bottleCapUniverse: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapProductionMultiplier(1);
                }).bind(this),
                costs: 15e5,
                coordinates: [500, 200],
                depends: [
                    'bottleCapWalls'
                ]
            },
            bottleCapAtoms: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapProductionMultiplier(1);
                }).bind(this),
                costs: 15e6,
                coordinates: [300, 150],
                depends: [
                    'bottleCapUniverse'
                ]
            },
            bottleCapsForEveryone: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapFactoryReduction(0.05);
                }).bind(this),
                costs: 15e3,
                coordinates: [800, 550],
                depends: [
                    'bottleCapShip'
                ]
            },
            bottleCapJunkie: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapFactoryReduction(0.10);
                }).bind(this),
                costs: 15e4,
                coordinates: [600, 500],
                depends: [
                    'bottleCapsForEveryone'
                ]
            },
            bottleCapDealer: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapFactoryReduction(0.10);
                }).bind(this),
                costs: 15e5,
                coordinates: [400, 450],
                depends: [
                    'bottleCapJunkie'
                ]
            },
            bottleCapCartel: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapFactoryReduction(0.10);
                }).bind(this),
                costs: 15e6,
                coordinates: [200, 400],
                depends: [
                    'bottleCapDealer'
                ]
            },
            eSport: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapFactoryLevelReduction(0.10);
                }).bind(this),
                costs: 15e4,
                coordinates: [650, 375],
                depends: [
                    'bottleCapsForEveryone',
                    'fallout'
                ]
            },
            boardGame: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapFactoryLevelReduction(0.10);
                }).bind(this),
                costs: 15e5,
                coordinates: [450, 325],
                depends: [
                    'eSport'
                ]
            },
            vr: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().addBottleCapFactoryLevelReduction(0.10);
                }).bind(this),
                costs: 15e6,
                coordinates: [250, 275],
                depends: [
                    'boardGame'
                ]
            },
            beerCollector: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.getUpgradeStorage().addBuffBottleUpgradeReduction(0.10);
                }).bind(this),
                costs: 3e3,
                coordinates: [1400, 600],
                depends: [
                    'sourceOfLife'
                ]
            },
            beerGuru: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.getUpgradeStorage().addBuffBottleUpgradeReduction(0.15);
                }).bind(this),
                costs: 3e4,
                coordinates: [1600, 550],
                depends: [
                    'beerCollector'
                ]
            },
            beerDefeater: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.getUpgradeStorage().addBuffBottleUpgradeReduction(0.20);
                }).bind(this),
                costs: 15e4,
                coordinates: [1800, 500],
                depends: [
                    'beerGuru'
                ]
            },
            beerTime: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.addBuffBottleUpgradePossibility(0.10);
                }).bind(this),
                costs: 15e3,
                coordinates: [1600, 650],
                depends: [
                    'beerCollector'
                ]
            },
            beerNation: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.addBuffBottleUpgradePossibility(0.10);
                }).bind(this),
                costs: 75e3,
                coordinates: [1800, 600],
                depends: [
                    'beerTime'
                ]
            },
            beerLeader: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.addBuffBottleUpgradePossibility(0.15);
                }).bind(this),
                costs: 75e4,
                coordinates: [2000, 550],
                depends: [
                    'beerNation'
                ]
            },
            delegation: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.addBuffBottleUpgradePossibility(0.15);
                }).bind(this),
                costs: 75e6,
                coordinates: [2200, 500],
                depends: [
                    'beerLeader'
                ]
            },
            union: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.addBuffBottleUpgradePossibility(0.20);
                }).bind(this),
                costs: 75e8,
                coordinates: [2400, 450],
                depends: [
                    'delegation'
                ]
            },
            declaration: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.enableBuffBottleUpgradesAfterReincarnation();
                }).bind(this),
                costs: 75e10,
                coordinates: [2600, 400],
                depends: [
                    'union'
                ]
            },
            automatedBar: {
                reached: false,
                upgrade: () => (new BuildingMinigames.AutomatedBar()).unlock(),
                costs: 75e6,
                coordinates: [2150, 350],
                depends: [
                    'beerLeader'
                ]
            },
            cloning: {
                reached: false,
                upgrade: () => (new BuildingMinigames.BeerCloner()).unlock(),
                costs: 75e5,
                coordinates: [2150, 650],
                depends: [
                    'beerLeader'
                ]
            },
            fusion: {
                reached: false,
                upgrade: () => (new BuildingMinigames.BeerCloner()).decrementCloningCooldown(),
                costs: 375e7,
                coordinates: [2300, 750],
                depends: [
                    'cloning'
                ]
            },
            sorter: {
                reached: false,
                upgrade: () => (new BuildingMinigames.BeerCloner()).decrementCloningCooldown(),
                costs: 1875e9,
                coordinates: [2450, 850],
                depends: [
                    'fusion'
                ]
            },
            embryonic: {
                reached: false,
                upgrade: () => (new BuildingMinigames.BeerCloner()).decrementCloningCooldown(),
                costs: 9375e11,
                coordinates: [2600, 950],
                depends: [
                    'sorter'
                ]
            },
            molecular: {
                reached: false,
                upgrade: (fromLoading = false) => {
                    const cloner = new BuildingMinigames.BeerCloner();
                    // force an updated multiplier as cloning may be disabled after reincarnation
                    cloner.forceUpdateMultiplier = true;

                    if (fromLoading) {
                        return;
                    }

                    $.each(
                        ['bottleCapFactory', ...this.gameState.getBuildings()],
                        (index, building) => cloner.addCloning(building, true)
                    );
                },
                costs: 46875e13,
                coordinates: [2750, 1050],
                depends: [
                    'embryonic'
                ]
            },
            bionic: {
                reached: false,
                upgrade: () => (new BuildingMinigames.BeerCloner()).unlockAutoCloning(),
                costs: 35e19,
                coordinates: [2900, 1150],
                depends: [
                    'molecular'
                ]
            },
            beerRain: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(0.1, 'holy');
                }).bind(this),
                costs: 2e3,
                coordinates: [1200, 700],
                depends: [
                    'sourceOfLife'
                ]
            },
            creditWorthy: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addBuildingReductionFromHolyUpgrades(0.01);
                }).bind(this),
                costs: 5000,
                coordinates: [1300, 800],
                depends: [
                    'beerRain'
                ]
            },
            investment: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addBuildingReductionFromHolyUpgrades(0.02);
                }).bind(this),
                costs: 2e4,
                coordinates: [1400, 900],
                depends: [
                    'creditWorthy'
                ]
            },
            money: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addBuildingReductionFromHolyUpgrades(0.03);
                }).bind(this),
                costs: 1e5,
                coordinates: [1500, 1000],
                depends: [
                    'investment'
                ]
            },
            scrooge: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addBuildingReductionFromHolyUpgrades(0.04);
                }).bind(this),
                costs: 5e5,
                coordinates: [1600, 1100],
                depends: [
                    'money'
                ]
            },
            beerBank: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBank()).unlockBeerBank();
                }).bind(this),
                costs: 2e7,
                coordinates: [1700, 1200],
                depends: [
                    'scrooge'
                ]
            },
            accountAgreement: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBank()).addHolyUpgradeBeerBankBoost(0.05);
                }).bind(this),
                costs: 25e7,
                coordinates: [1650, 1325],
                depends: [
                    'beerBank'
                ]
            },
            cod: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBank()).addHolyUpgradeBeerBankBoost(0.1);
                }).bind(this),
                costs: 1e9,
                coordinates: [1600, 1450],
                depends: [
                    'accountAgreement'
                ]
            },
            mmda: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBank()).addHolyUpgradeBeerBankBoost(0.15);
                }).bind(this),
                costs: 5e9,
                coordinates: [1550, 1575],
                depends: [
                    'cod'
                ]
            },
            industrialRevolution: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.getUpgradeStorage().addUpgradeReductionFromHolyUpgrades(0.01);
                }).bind(this),
                costs: 5000,
                coordinates: [1100, 800],
                depends: [
                    'beerRain'
                ]
            },
            industrialRevolution2: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.getUpgradeStorage().addUpgradeReductionFromHolyUpgrades(0.02);
                }).bind(this),
                costs: 2e4,
                coordinates: [1200, 900],
                depends: [
                    'industrialRevolution'
                ]
            },
            digitalRevolution: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.getUpgradeStorage().addUpgradeReductionFromHolyUpgrades(0.03);
                }).bind(this),
                costs: 1e5,
                coordinates: [1300, 1000],
                depends: [
                    'industrialRevolution2'
                ]
            },
            kardaschow: {
                reached: false,
                upgrade: (function () {
                    this.upgradeController.getUpgradeStorage().addUpgradeReductionFromHolyUpgrades(0.04);
                }).bind(this),
                costs: 5e5,
                coordinates: [1400, 1100],
                depends: [
                    'digitalRevolution'
                ]
            },
            openerStudy: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(this.gameState.getBuildingData('opener').amount * 0.0005, 'openerStudy');
                }).bind(this),
                costs: 5e3,
                coordinates: [950, 750],
                depends: [
                    'smallHelper'
                ]
            },
            dispenserFactory: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(this.gameState.getBuildingData('dispenser').amount * 0.0005, 'dispenserFactory');
                }).bind(this),
                costs: 15e3,
                coordinates: [750, 800],
                depends: [
                    'mediumHelper'
                ]
            },
            beerAcademy: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(this.gameState.getBuildingData('serviceAssistant').amount * 0.0005, 'beerAcademy');
                }).bind(this),
                costs: 5e4,
                coordinates: [550, 850],
                depends: [
                    'bigHelper'
                ]
            },
            wisdom: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(0.1, 'holy');
                }).bind(this),
                costs: 1e5,
                coordinates: [700, 975],
                depends: [
                    'openerStudy',
                    'dispenserFactory',
                    'beerAcademy'
                ]
            },
            inspiration: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(0.15, 'holy');
                }).bind(this),
                costs: 5e5,
                coordinates: [650, 1100],
                depends: [
                    'wisdom'
                ]
            },
            theosophical: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(0.2, 'holy');
                }).bind(this),
                costs: 2e6,
                coordinates: [600, 1225],
                depends: [
                    'inspiration'
                ]
            },
            interconnectedness: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addUpgradeAutoPlopMultiplier(0.25, 'holy');
                }).bind(this),
                costs: 1e7,
                coordinates: [550, 1350],
                depends: [
                    'theosophical'
                ]
            },
            beerwarts: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).unlockBeerwarts(),
                costs: 1e8,
                coordinates: [500, 1475],
                depends: [
                    'interconnectedness'
                ]
            },
            manaBuff: {
                reached: false,
                upgrade: (function () {
                    this.buffController.enableAdditionalBuff('manaBoost');
                }).bind(this),
                costs: 5e8,
                coordinates: [450, 1600],
                depends: [
                    'beerwarts'
                ]
            },
            beerwartsAutoTrain: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).unlockAutoTraining(),
                costs: 5e10,
                coordinates: [600, 1725],
                depends: [
                    'manaBuff'
                ]
            },
            autoTrainReduction: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).setAutoTrainingReductionMultiplier(0.5),
                costs: 5e11,
                coordinates: [750, 1850],
                depends: [
                    'beerwartsAutoTrain'
                ]
            },
            groupTraining: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).enableGroupTrainingShortener(),
                costs: 5e13,
                coordinates: [900, 1975],
                depends: [
                    'autoTrainReduction'
                ]
            },
            crib: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addCribReduction(0.05),
                costs: 2e16,
                coordinates: [900, 2125],
                depends: [
                    'groupTraining'
                ]
            },
            scan: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addCribReduction(0.05),
                costs: 4e18,
                coordinates: [900, 2275],
                depends: [
                    'crib'
                ]
            },
            trainingBoost: {
                reached: false,
                upgrade: () => this.buffController.enableAdditionalBuff('shortenBeerwarts'),
                costs: 8e20,
                coordinates: [900, 2425],
                depends: [
                    'scan'
                ]
            },
            mb_1: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addManaProductionUpgradeMultiplier(0.15),
                costs: 1e10,
                coordinates: [400, 1725],
                depends: [
                    'manaBuff'
                ]
            },
            mb_2: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addManaProductionUpgradeMultiplier(0.25),
                costs: 2e11,
                coordinates: [350, 1850],
                depends: [
                    'mb_1'
                ]
            },
            mb_3: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addManaProductionUpgradeMultiplier(0.35),
                costs: 4e12,
                coordinates: [300, 1975],
                depends: [
                    'mb_2'
                ]
            },
            bwt_1: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addTrainingShortener(0.3),
                costs: 35e10,
                coordinates: [200, 1850],
                depends: [
                    'mb_1'
                ]
            },
            bwt_2: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addTrainingShortener(0.4),
                costs: 35e11,
                coordinates: [150, 1975],
                depends: [
                    'bwt_1'
                ]
            },
            bwt_3: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).addTrainingShortener(0.5),
                costs: 35e12,
                coordinates: [100, 2100],
                depends: [
                    'bwt_2'
                ]
            },
            bw_sacrifice: {
                reached: false,
                upgrade: () => (new Minigames.Beerwarts()).enableSacrifice(),
                costs: 5e14,
                coordinates: [50, 2225],
                depends: [
                    'bwt_3'
                ]
            },
            beerOceans: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('beerOceans'),
                        0
                    );
                },
                costs: 1e5,
                coordinates: [1550, 800],
                depends: [
                    'investment',
                    'beerTime'
                ]
            },
            beerCore: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('beerCore'),
                        0
                    );
                },
                costs: 5e5,
                coordinates: [1650, 900],
                depends: [
                    'beerOceans'
                ]
            },
            beerLaser: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('beerLaser'),
                        0
                    );
                },
                costs: 2e6,
                coordinates: [1750, 1000],
                depends: [
                    'beerCore'
                ]
            },
            beerPark: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('beerPark'),
                        0
                    );
                },
                costs: 5e5,
                coordinates: [1750, 800],
                depends: [
                    'beerOceans'
                ]
            },
            beerdedNation: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('beerdedNation'),
                        0
                    );
                },
                costs: 2e6,
                coordinates: [1850, 900],
                depends: [
                    'beerPark'
                ]
            },
            refillingCaps: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('refillingCaps'),
                        0
                    );
                },
                costs: 2e6,
                coordinates: [1950, 800],
                depends: [
                    'beerPark'
                ]
            },
            stargazer: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('stargazer'),
                        0
                    );
                },
                costs: 1e8,
                coordinates: [2000, 950],
                depends: [
                    'beerdedNation',
                    'refillingCaps'
                ]
            },
            clonedike: {
                reached: false,
                upgrade: function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('clonedike'),
                        0
                    );
                },
                costs: 25e10,
                coordinates: [2300, 1000],
                depends: [
                    'stargazer',
                    'fusion'
                ]
            },
            autoResearch: {
                reached: false,
                upgrade: () => (new Minigames.ResearchProject()).enableAutoRestart(),
                costs: 5e15,
                coordinates: [2450, 1100],
                depends: [
                    'clonedike',
                ]
            },
            training: {
                reached: false,
                upgrade: (function () {
                    window.setTimeout(
                        () => (new Minigames.ResearchProject()).startResearch('training'),
                        0
                    );
                }).bind(this),
                costs: 1e11,
                coordinates: [2000, 1200],
                depends: [
                    'researchBuff'
                ]
            },
            researchBuff: {
                reached: false,
                upgrade: (function () {
                    this.buffController.enableAdditionalBuff('researchBoost');
                }).bind(this),
                costs: 5e7,
                coordinates: [1850, 1100],
                depends: [
                    'beerLaser'
                ]
            },
            beerBankBuff: {
                reached: false,
                upgrade: (function () {
                    this.buffController.enableAdditionalBuff('beerBankBoost');
                }).bind(this),
                costs: 25e7,
                coordinates: [1850, 1300],
                depends: [
                    'researchBuff',
                    'beerBank'
                ]
            },
            banker: {
                reached: false,
                upgrade: function () {
                    (new Minigames.BeerBankBanker()).unlockBanker();
                },
                costs: 1e9,
                coordinates: [2000, 1400],
                depends: [
                    'beerBankBuff'
                ]
            },
            smallHelper: {
                reached: false,
                upgrade: (function () {
                    if (this.gameState.getBuildingData('opener').amount === 0) {
                        this.gameState.addBuildings('opener', 10);
                    }
                }).bind(this),
                costs: 1e3,
                coordinates: [1000, 600],
                depends: [
                    'sourceOfLife'
                ]
            },
            mediumHelper: {
                reached: false,
                upgrade: (function () {
                    if (this.gameState.getBuildingData('dispenser').amount === 0) {
                        this.gameState.addBuildings('dispenser', 10);
                    }
                }).bind(this),
                costs: 3e3,
                coordinates: [800, 650],
                depends: [
                    'smallHelper'
                ]
            },
            bigHelper: {
                reached: false,
                upgrade: (function () {
                    if (this.gameState.getBuildingData('serviceAssistant').amount === 0) {
                        this.gameState.addBuildings('serviceAssistant', 10);
                    }
                }).bind(this),
                costs: 1e4,
                coordinates: [600, 700],
                depends: [
                    'mediumHelper'
                ]
            },
            beerFactory: {
                reached: false,
                upgrade: function () {
                    (new Minigames.BeerFactory()).unlockBeerFactory();
                },
                costs: 5e4,
                coordinates: [400, 750],
                depends: [
                    'bigHelper'
                ]
            },
            beerFactoryBoost: {
                reached: false,
                upgrade: () => this.buffController.enableAdditionalBuff('beerFactory'),
                costs: 5e6,
                coordinates: [200, 800],
                depends: [
                    'beerFactory'
                ]
            },
            abstinence: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addInterpolateDuration(30);
                    this.gameState.addInterpolatePercentage(0.05);
                }).bind(this),
                costs: 500,
                coordinates: [1200, 400],
                depends: [
                    'sourceOfLife'
                ]
            },
            one: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addInterpolatePercentage(0.10);
                }).bind(this),
                costs: 2e3,
                coordinates: [1400, 450],
                depends: [
                    'abstinence'
                ]
            },
            more: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addInterpolatePercentage(0.20);
                }).bind(this),
                costs: 2e4,
                coordinates: [1600, 400],
                depends: [
                    'one'
                ]
            },
            time: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addInterpolatePercentage(0.40);
                }).bind(this),
                costs: 2e5,
                coordinates: [1800, 350],
                depends: [
                    'more'
                ]
            },
            keep: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addInterpolateDuration(60);
                }).bind(this),
                costs: 2e3,
                coordinates: [1300, 200],
                depends: [
                    'abstinence'
                ]
            },
            it: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addInterpolateDuration(120);
                }).bind(this),
                costs: 2e4,
                coordinates: [1500, 150],
                depends: [
                    'keep'
                ]
            },
            running: {
                reached: false,
                upgrade: (function () {
                    this.gameState.addInterpolateDuration(240);
                }).bind(this),
                costs: 2e5,
                coordinates: [1700, 100],
                depends: [
                    'it'
                ]
            },
            caps: {
                reached: false,
                upgrade: (function () {
                    this.gameState.getBuildingLevelController().enableBottleCapInterpolation();
                }).bind(this),
                costs: 15e3,
                coordinates: [1450, 300],
                depends: [
                    'one',
                    'keep'
                ]
            },
            bb: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockBeerBlender();
                }).bind(this),
                costs: 15e3,
                coordinates: [1050, 1000],
                depends: [
                    'industrialRevolution'
                ]
            },
            bb2: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalSlot(2);
                }).bind(this),
                costs: 1e5,
                coordinates: [1150, 1150],
                depends: [
                    'bb'
                ]
            },
            bb3: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalSlot(3);
                }).bind(this),
                costs: 1e6,
                coordinates: [1150, 1300],
                depends: [
                    'bb2'
                ]
            },
            bb_cherry: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalIngredient('cherry');
                }).bind(this),
                costs: 6e7,
                coordinates: [1250, 1450],
                depends: [
                    'bb3',
                    'beerBank'
                ]
            },
            bb_pear: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalIngredient('pear');
                }).bind(this),
                costs: 75e3,
                coordinates: [950, 1150],
                depends: [
                    'bb'
                ]
            },
            bb_chili: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalIngredient('chili');
                }).bind(this),
                costs: 25e4,
                coordinates: [950, 1300],
                depends: [
                    'bb_pear'
                ]
            },
            bb_grape: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalIngredient('grape');
                }).bind(this),
                costs: 1e6,
                coordinates: [950, 1450],
                depends: [
                    'bb_chili'
                ]
            },
            bb_melon: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalIngredient('melon');
                }).bind(this),
                costs: 35e6,
                coordinates: [950, 1600],
                depends: [
                    'bb_grape'
                ]
            },
            bb_blueberry: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalIngredient('blueberry');
                }).bind(this),
                costs: 5e8,
                coordinates: [850, 1750],
                depends: [
                    'bb_melon',
                    'beerwarts'
                ]
            },
            bb_woodruff: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).unlockAdditionalIngredient('woodruff');
                }).bind(this),
                costs: 75e8,
                coordinates: [1150, 1675],
                depends: [
                    'bb_melon',
                    'bb_cherry'
                ]
            },
            bb_preset1: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).addAvailablePresets(2);
                }).bind(this),
                costs: 75e10,
                coordinates: [1150, 1825],
                depends: [
                    'bb_woodruff'
                ]
            },
            bb_preset2: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).addAvailablePresets(1);
                }).bind(this),
                costs: 75e13,
                coordinates: [1150, 1975],
                depends: [
                    'bb_preset1'
                ]
            },
            bb_preset3: {
                reached: false,
                upgrade: (function () {
                    (new Minigames.BeerBlender()).addAvailablePresets(1);
                }).bind(this),
                costs: 75e16,
                coordinates: [1150, 2125],
                depends: [
                    'bb_preset2'
                ]
            },
        };
    };

    HolyUpgradeStorage.prototype.export = function () {
        let csv = '';
        $.each(this.upgrades, (key, data) => {
            csv += `${key};"${translator.translate(`holyUpgrade.${key}.title`)}";"${translator.translate(`holyUpgrade.${key}.description`)}";`
                + `"${translator.translate(`holyUpgrade.${key}.effect`)}";"${new Beerplop.NumberFormatter().formatInt(data.costs)}";`
                + `"${data.depends.map(dependsKey => translator.translate(`holyUpgrade.${dependsKey}.title`)).join(', ')}"` + "\n";
        });

        console.log(csv);
    };

    beerplop.HolyUpgradeStorage = HolyUpgradeStorage;
})(Beerplop);
