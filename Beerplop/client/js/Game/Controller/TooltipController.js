(function(beerplop) {
    'use strict';

    TooltipController.prototype.gameState       = null;
    TooltipController.prototype.beerFactory     = null;
    TooltipController.prototype.numberFormatter = null;

    /**
     * Initialize the tooltip controller
     *
     * @constructor
     */
    function TooltipController(gameState, beerFactory) {
        this.gameState       = gameState;
        this.beerFactory     = beerFactory;
        this.numberFormatter = new Beerplop.NumberFormatter();

        this._initBuildingPopover();
        this._initLevelUpTooltip();
    }

    /**
     * Initialize the building information popover
     *
     * @private
     */
    TooltipController.prototype._initBuildingPopover = function () {
        const gameState       = this.gameState,
              slotController  = this.beerFactory.getSlotController(),
              numberFormatter = this.numberFormatter,
              popoverElements = $('.building-container-popover');

        popoverElements.popover({
            content: function() {
                const buildingKey        = $(this).data('buildingKey'),
                      autoBuyerEnabled   = slotController.isAutoBuyerEnabled(buildingKey, false),
                      autoLevelUpEnabled = slotController.isAutoLevelUpEnabled(buildingKey, false);

                gameState.setActiveBuildingPopover(buildingKey);

                let data = {};
                if (buildingKey !== 'bottleCapFactory') {
                    const buildingData   = gameState.getBuildingData(buildingKey),
                          buildingAmount = gameState.getBuildingProduction(buildingKey, buildingData),
                          specialInfo    = gameState.resolvePopoverCallback(buildingKey);

                    data = {
                        showBuildingStats: true,
                        specialInfo:       specialInfo,
                        owned:             numberFormatter.formatInt(buildingData.amount),
                        level:             buildingData.level,
                        production:        numberFormatter.format(buildingAmount),
                        productionEach:    numberFormatter.format(
                            buildingData.amount > 0
                                ? gameState.getBuildingProductionPerBuilding(buildingKey, buildingData) * gameState.getExternalAutoPlopsMultiplier()
                                : 0
                        ),
                        totalProduction: numberFormatter.format(buildingData.production),
                        percentage:      numberFormatter.format(
                            buildingAmount > 0 ? buildingAmount / gameState.getAutoPlopsPerSecond() * 100 : 0
                        ),
                    };
                }

                return Mustache.render(
                    TemplateStorage.get('building-popover-template'),
                    $.extend(
                        data,
                        {
                            buildingKey:     buildingKey,
                            description:     translator.translate(`building.${buildingKey}.description`),
                            slotsEnabled:    slotController.buildingSlotsEnabled(),
                            slots:           slotController.getSlotsForBuilding(buildingKey).map(function (slot) {
                                return {
                                    key:               slot !== null ? slot.equip : 'empty',
                                    underConstruction: slot !== null && slot.state === EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                                    active:            slot !== null && slot.state === EQUIPMENT_STATE__FINISHED && (
                                            (slot.equip === EQUIPMENT_ITEM__DIASTATIC && autoBuyerEnabled) ||
                                            (slot.equip === EQUIPMENT_ITEM__AMYLASE && autoLevelUpEnabled)
                                        )
                                };
                            }),
                        }
                    )
                );
            }
        });

        popoverElements.on('hide.bs.popover', function () {
            gameState.setActiveBuildingPopover(null);
        })
    };

    /**
     * Initialize the tooltips which show the requirements for the next level of a building
     *
     * @private
     */
    TooltipController.prototype._initLevelUpTooltip = function () {
        const gameState       = this.gameState,
              numberFormatter = this.numberFormatter;

        $('.level-up-tooltip').tooltip({
            title: function () {
                const buildingData       = gameState.getBuildingData($(this).find('.level-up').data('building')),
                      requiredBuildings  = gameState.getBuildingLevelController().getRequiredBuildingsForNextLevel(
                              buildingData.level
                          ),
                      requiredBottleCaps = gameState.getBuildingLevelController().getRequiredBottleCapsForNextLevel(
                              buildingData.tier,
                              buildingData.level
                          );

                return Mustache.render(
                    TemplateStorage.get('level-up-tooltip-template'),
                    {
                        buildings:         numberFormatter.formatInt(requiredBuildings),
                        buildingsReached:  requiredBuildings <= buildingData.amount,
                        bottleCaps:        numberFormatter.formatInt(requiredBottleCaps),
                        bottleCapsReached: requiredBottleCaps <= gameState.getBuildingLevelController().getBottleCaps()
                    }
                );
            }
        });

        $('.level-up-bottle-cap-factory-tooltip').tooltip({
            title: function () {
                const requiredBuildingTypes = Math.min(
                        gameState
                            .getBuildingLevelController()
                            .getCurrentBottleCapFactoryLevel() + 2,
                        gameState.getBuildings().length
                    ),

                    requiredBottleCapFactories = gameState
                            .getBuildingLevelController()
                            .getCurrentBottleCapFactoryLevel() * 5,

                    requiredPlops = gameState.getBuildingLevelController().getCostsForNextBottleCapFactoryLevel();

                return Mustache.render(
                    TemplateStorage.get('level-up-bottle-cap-factory-tooltip-template'),
                    {
                        buildingTypes:             requiredBuildingTypes,
                        buildingTypesReached:      requiredBuildingTypes <= gameState.getOwnedBuildingTypesAmount(),
                        bottleCapFactories:        requiredBottleCapFactories,
                        bottleCapFactoriesReached: requiredBottleCapFactories <= gameState.getBuildingLevelController().getBottleCapFactoriesAmount(),
                        plops:                     numberFormatter.formatInt(requiredPlops),
                        plopsReached:              requiredPlops <= gameState.getPlops()
                    }
                );
            }
        });
    };

    beerplop.TooltipController = TooltipController;
})(Beerplop);