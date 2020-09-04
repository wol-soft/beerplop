(function(beerplop) {
    'use strict';

    BuildingDetails.prototype.building        = null;
    BuildingDetails.prototype.numberFormatter = null;
    BuildingDetails.prototype.gameEventBus    = null;
    BuildingDetails.prototype.gameState       = null;
    BuildingDetails.prototype.gameOptions     = null;

    BuildingDetails.prototype.deleteGraphSemaphore = false;
    BuildingDetails.prototype.charts               = [];

    /**
     * Initialize the overlay controller
     *
     * @constructor
     */
    function BuildingDetails(building) {
        this.building        = building;
        this.numberFormatter = new Beerplop.NumberFormatter();
        this.gameEventBus    = new Beerplop.GameEventBus();
        this.gameState       = new Beerplop.GameState();
        this.gameOptions     = new Beerplop.GameOptions();

        this._renderBuildingDetailsModal();
        this.gameState.setActiveBuildingDetailsModal(building);
    }

    BuildingDetails.prototype._renderBuildingDetailsModal = function () {
        const modal              = $('#building-details-modal'),
              slotController     = new Minigames.BeerFactory().getSlotController(),
              beerCloner         = new BuildingMinigames.BeerCloner(),
              autoBuyerEnabled   = slotController.isAutoBuyerEnabled(this.building, false),
              autoLevelUpEnabled = slotController.isAutoLevelUpEnabled(this.building, false),
              productionStats    = !this.gameOptions.hasDisabledProductionStatistics(),
              buildings          = ['total', 'bottleCapFactory', ...(new Beerplop.GameState()).getBuildings()];

        let index = 0;

        // TODO: instead of knowing all content partials of the modal let components register content to be rendered
        $('#building-details-modal__body').html(
            Mustache.render(
                TemplateStorage.get('building-details-modal__body-template'),
                {
                    // base data
                    key:                  this.building,
                    building:             translator.translate('building.' + this.building + '.plural'),
                    productionStatistics: productionStats,
                    baseStats:            this.building !== 'total'
                        ? new Beerplop.TooltipController().renderBuildingTooltip(this.building, false)
                        : '',

                    // fast switch data
                    buildings:    buildings,
                    lastBuilding: buildings[buildings.indexOf(this.building) - 1],
                    nextBuilding: buildings[buildings.indexOf(this.building) + 1],

                    // required data for slot-section
                    slotsUnderConstruction: slotController.getSlotsUnderConstruction(this.building),
                    slotsEnabled:           slotController.buildingSlotsEnabled() && this.building !== 'total',
                    slots:                  slotController.getSlotsForBuilding(this.building).map((function (slot) {
                        return {
                            index:             index++,
                            slotKey:           slot !== null ? slot.equip : 'empty',
                            underConstruction: slot !== null && slot.state === EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                            label:             slot !== null
                                ? slotController.getEquipmentLabel(slot.equip)
                                : translator.translate('beerFactory.emptySlot'),
                            content: slot !== null
                                ? slotController.getEquipmentEffectLabel(this.building, slot.equip)
                                : translator.translate('beerFactory.equipSlotHint'),
                            active:            slot !== null && slot.state === EQUIPMENT_STATE__FINISHED && (
                                    (slot.equip === EQUIPMENT_ITEM__DIASTATIC && autoBuyerEnabled) ||
                                    (slot.equip === EQUIPMENT_ITEM__AMYLASE && autoLevelUpEnabled)
                                )
                        };
                    }).bind(this)),

                    // required data for auto buyer configuration section
                    hasAutoBuyer:       slotController.isBuildingEquippedWith(this.building, EQUIPMENT_ITEM__DIASTATIC),
                    autoBuyerEnabled:   autoBuyerEnabled,
                    hasAutoLevelUp:     slotController.isBuildingEquippedWith(this.building, EQUIPMENT_ITEM__AMYLASE),
                    autoLevelUpEnabled: autoLevelUpEnabled,

                    // required data for auto cloning configuration section
                    autoCloning: beerCloner.isAutoCloningUnlocked() && $.inArray(this.building, ['total']) === -1,
                    priority:    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                }
            )
        );

        $('#beer-cloner__auto-cloning__priority').val(beerCloner.getAutoCloningPriority(this.building));

        if (productionStats) {
            this._initProductionStatisticGraphs();
        } else {
            modal.modal('show');
        }

        this._initEventListener(slotController);

        modal.off('hidden.bs.modal.resetActiveModal');
        modal.on('hidden.bs.modal.resetActiveModal', () => {
            this.gameState.setActiveBuildingDetailsModal(null);
        });
    };

    /**
     * Initialize the production statistic graphs
     *
     * @private
     */
    BuildingDetails.prototype._initProductionStatisticGraphs = function () {
        (new Beerplop.ProductionStatistics()).getBuildingStats(this.building).then((function (buildingStatistics) {
            if (buildingStatistics === null) {
                $('#building-details-modal__graph__total-production').text(translator.translate('stats.noData'));
                $('#building-details-modal__graph__production-per-second').text(translator.translate('stats.noData'));
                $('#building-details-modal__graph__owned').text(translator.translate('stats.noData'));
            } else {
                const numberFormatter     = this.numberFormatter,
                      productionGraphType = this.gameOptions.getProductionStatisticsType(),
                      valueLabel          = this.building === 'bottleCapFactory' ? 'bottleCapValue' : 'plopValue';

                console.log(this.building, valueLabel);

                // reset the internal charts array for correct indices when adding new data points
                this.charts = [];

                this.charts.push(
                    this._renderProductionGraph(
                        'building-details-modal__graph__total-production',
                        buildingStatistics.total,
                        function() {
                            return numberFormatter.format(this.value);
                        },
                        function() {
                            return translator.translate(
                                valueLabel,
                                {
                                    __VALUE__: numberFormatter.format(this.y),
                                },
                            );
                        },
                        productionGraphType
                    )
                );

                this.charts.push(
                    this._renderProductionGraph(
                        'building-details-modal__graph__production-per-second',
                        buildingStatistics.perSecond,
                        function() {
                            return numberFormatter.format(this.value);
                        },
                        function() {
                            return translator.translate(
                                valueLabel,
                                {
                                    __VALUE__: numberFormatter.format(this.y),
                                },
                            );
                        },
                        productionGraphType
                    )
                );

                this.charts.push(
                    this._renderProductionGraph(
                        'building-details-modal__graph__owned',
                        buildingStatistics.owned,
                        function() {
                            return numberFormatter.formatInt(this.value);
                        },
                        function() {
                            return numberFormatter.formatInt(this.y);
                        },
                        'linear',
                    )
                );
            }

            const modal           = $('#building-details-modal'),
                  statisticsEvent = EVENTS.CORE.STATISTIC_SNAPSHOT + '.buildingDetailsChart';

            this.gameEventBus.on(statisticsEvent, (function (event, building, snapshot) {
                if (building === this.building) {
                    this._addDataPoint(0, [snapshot.timestamp, snapshot.total]);
                    this._addDataPoint(1, [snapshot.timestamp, snapshot.perSecond]);
                    this._addDataPoint(2, [snapshot.timestamp, snapshot.owned]);
                }
            }).bind(this));

            modal.modal('show');
            modal.off('hidden.bs.modal.clearChart');
            modal.on('hidden.bs.modal.clearChart', (function () {
                if (this.deleteGraphSemaphore) {
                    this.deleteGraphSemaphore = false;
                    return;
                }

                this.gameEventBus.off(statisticsEvent);
                $.each(this.charts, (function (index, chart) {
                    if (chart) {
                        this.charts[index] = chart.destroy();
                    }
                }).bind(this));
            }).bind(this));
        }).bind(this));
    };

    BuildingDetails.prototype._addDataPoint = function (chart, value) {
        this.charts[chart].series[0].addPoint(value);
    };

    BuildingDetails.prototype._initEventListener = function (slotController) {
        const container        = $('#building-details-modal__body'),
              prioritySelect   = $('#beer-cloner__auto-cloning__priority'),
              fastSwitchSelect = $('#building-details__fast-switch-select');

        container.find('.building-details__fast-switch').on('click', event => this._switchBuilding(
            $(event.target).closest('.building-details__fast-switch').data('targetBuilding')
        ));

        fastSwitchSelect.val(this.building);
        fastSwitchSelect.on('change', () => this._switchBuilding(fastSwitchSelect.val()));

        container.find('.beer-factory__material-tooltip').tooltip({
            title: (function renderRequredMaterialsTooltip() {
                return Mustache.render(
                    TemplateStorage.get('beer-factory__required-materials-tooltip-template'),
                    {
                        materials: Object.values(slotController.getNextSlotCosts(this.building))
                            .map((function mapMaterialProduction(material) {
                                    return {
                                        name:   material.name,
                                        amount: this.numberFormatter.formatInt(material.required),
                                    }
                                }).bind(this)
                            ),
                    }
                )
            }).bind(this)
        });

        container.find('.beer-factory__material-tooltip').on('click', (function (event) {
            if (slotController.buildSlot(this.building)) {
                $('.beer-factory__slots-under-construction').text(
                    slotController.getSlotsUnderConstruction(this.building)
                );
            }
            $(event.target).tooltip('hide');
        }).bind(this));

        container.find('.beer-factory__toggle-auto-buyer').on('change', (function () {

            container.find('.beer-factory__slot[data-slot-key="diastatic"]').toggleClass('beer-factory__slot--active');

            this.gameEventBus.emit(
                EVENTS.BEER_FACTORY.AUTO_BUYER,
                {
                    building: this.building,
                    enabled:  slotController.toggleAutoBuyerEnabled(this.building)
                }
            );

            const achievementController = new Beerplop.AchievementController();
            achievementController.checkAchievement(
                achievementController.getAchievementStorage().achievements.beerFactory.slots.automation.autoBuyer.enable
            );
        }).bind(this));

        container.find('.beer-factory__toggle-auto-level-up').on('change', (function () {
            container.find('.beer-factory__slot[data-slot-key="amylase"]').toggleClass('beer-factory__slot--active');

            this.gameEventBus.emit(
                EVENTS.BEER_FACTORY.AUTO_LEVEL_UP,
                {
                    building: this.building,
                    enabled:  slotController.toggleAutoLevelUpEnabled(this.building)
                }
            );

            const achievementController = new Beerplop.AchievementController();
            achievementController.checkAchievement(
                achievementController.getAchievementStorage().achievements.beerFactory.slots.automation.autoLevelUp.enable
            );
        }).bind(this));

        // use an event with a suffix to avoid unbinding other event listeners on modal close
        const event = EVENTS.BEER_FACTORY.QUEUE.FINISHED + '.checkSlotUpgrade';
        this.gameEventBus.on(event, this._checkSlotUpdate.bind(this));
        $('#building-details-modal').on('hidden.bs.modal', (function () {
            this.gameEventBus.off(event);
        }).bind(this));

        const slotElements = $('#building-details__beer-factory-slots').find('.beer-factory__slot');
        slotElements.popover();
        slotElements.on('click', (function (event) {
            // set the graph semaphore to avoid deleting the graphs. The building detail modal is closed only temporary
            this.deleteGraphSemaphore = true;

            const element = $(event.target).closest('.beer-factory__slot');
            slotController.showSlotEquipDialog(element.data('building'), element.data('slotIndex'));
        }).bind(this));

        prioritySelect.on(
            'change',
            () => (new BuildingMinigames.BeerCloner())
                .setAutoCloningPriority(this.building, parseInt(prioritySelect.val()))
        );
    };

    BuildingDetails.prototype._checkSlotUpdate = function (event, id, action, item) {
        if ((action === BUILD_QUEUE__CONSTRUCT_SLOT || action === BUILD_QUEUE__EQUIP_SLOT) &&
            (item === this.building || item.building === this.building)
        ) {
            this._renderBuildingDetailsModal();
        }
    };

    BuildingDetails.prototype._switchBuilding = function (building) {
        this.building = building;
        this._renderBuildingDetailsModal();
    };

    BuildingDetails.prototype._renderProductionGraph = function (
        container,
        data,
        axisFormatter,
        tooltipFormatter,
        yAxisType = 'logarithmic',
    ) {
        return Highcharts.chart(container, {
            title:{
                text:''
            },
            chart: {
                zoomType: 'x'
            },
            subtitle: {
                text: document.ontouchstart === undefined
                    ? translator.translate('stats.zoomDesktopHint')
                    : translator.translate('stats.zoomMobileHint')
            },
            xAxis: {
                type: 'datetime'
            },
            yAxis: {
                floor: 0,
                min: yAxisType === 'logarithmic' ? 0.0000001 : 0,
                type: yAxisType,
                startOnTick: false,
                labels: {
                    formatter: axisFormatter
                }
            },
            legend: {
                enabled: false
            },
            credits: {
                enabled: false
            },
            plotOptions: {
                area: {
                    fillColor: {
                        linearGradient: {
                            x1: 0,
                            y1: 0,
                            x2: 0,
                            y2: 1
                        },
                        stops: [
                            [0, Highcharts.getOptions().colors[0]],
                            [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
                        ]
                    },
                    marker: {
                        radius: 2
                    },
                    lineWidth: 1,
                    states: {
                        hover: {
                            lineWidth: 1
                        }
                    },
                    threshold: null
                }
            },

            tooltip: {
                formatter: tooltipFormatter
            },

            series: [{
                type: 'area',
                data: data
            }]
        });
    };

    beerplop.BuildingDetails = BuildingDetails;
})(Beerplop);

$(function() {
    $('.details-modal-button').on(
        'click',
        event => new Beerplop.BuildingDetails($(event.target).closest('.details-modal-button').data('buildingKey'))
    );
});
