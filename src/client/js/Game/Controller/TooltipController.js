(function(beerplop) {
    'use strict';

    TooltipController.prototype._instance = null;

    TooltipController.prototype.gameState       = null;
    TooltipController.prototype.beerFactory     = null;
    TooltipController.prototype.numberFormatter = null;

    /**
     * Initialize the tooltip controller
     *
     * @constructor
     */
    function TooltipController(gameState, beerFactory) {
        if (TooltipController.prototype._instance) {
            return TooltipController.prototype._instance;
        }

        this.gameState       = gameState;
        this.beerFactory     = beerFactory;
        this.numberFormatter = new Beerplop.NumberFormatter();

        TooltipController.prototype._instance = this;
    }

    /**
     * Initialize the main building popovers
     */
    TooltipController.prototype.initPopover = function () {
        this._initBuildingPopover();
        this._initLevelUpTooltip();
    };

    /**
     * Initialize the building information popover
     *
     * @private
     */
    TooltipController.prototype._initBuildingPopover = function () {
        const tooltipController = this,
              popoverElements   = $('.building-container-popover');

        popoverElements.popover({
            content: function() {
                const buildingKey = $(this).data('buildingKey');

                tooltipController.gameState.setActiveBuildingPopover(buildingKey);

                return tooltipController.renderBuildingTooltip(buildingKey);
            }
        });

        popoverElements.on('hide.bs.popover', () => this.gameState.setActiveBuildingPopover(null));
    };

    /**
     * Render the tooltip content for the given building key
     *
     * @param {string}  buildingKey
     * @param {boolean} displaySlots
     *
     * @return {string}
     */
    TooltipController.prototype.renderBuildingTooltip = function (buildingKey, displaySlots = true) {
        const autoBuyerEnabled   = this.beerFactory.getSlotController().isAutoBuyerEnabled(buildingKey, false),
              autoLevelUpEnabled = this.beerFactory.getSlotController().isAutoLevelUpEnabled(buildingKey, false),
              specialInfo        = this.gameState.resolvePopoverCallback(buildingKey);

        let data = {};

        if (buildingKey !== 'bottleCapFactory') {
            const buildingData   = this.gameState.getBuildingData(buildingKey),
                  buildingAmount = this.gameState.getBuildingProduction(buildingKey, buildingData);

            data = {
                showBuildingStats: true,
                owned:             this.numberFormatter.formatInt(buildingData.amount),
                level:             buildingData.level,
                production:        this.numberFormatter.format(buildingAmount),
                productionEach:    this.numberFormatter.format(
                    buildingData.amount > 0
                        ? this.gameState.getBuildingProductionPerBuilding(buildingKey, buildingData)
                            * this.gameState.getExternalAutoPlopsMultiplier()
                        : 0
                ),
                totalProduction: this.numberFormatter.format(buildingData.production),
                percentage:      this.numberFormatter.format(
                    buildingAmount > 0 ? buildingAmount / this.gameState.getAutoPlopsPerSecond() * 100 : 0
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
                    specialInfo:     specialInfo,
                    slotsEnabled:    this.beerFactory.getSlotController().buildingSlotsEnabled() && displaySlots,
                    slots:           this.beerFactory.getSlotController().getSlotsForBuilding(buildingKey)
                        .map(function (slot) {
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