
const SLOT__COMPOSED_VALUE_KEY = 'BeerFactory__Slot';

(function(beerFactoryGame) {
    'use strict';

    const EQUIPMENT_MAP = [
        EQUIPMENT_ITEM__HYDROLYSIS,
        EQUIPMENT_ITEM__FERMENTATION,
        EQUIPMENT_ITEM__DEGRADATION,
        EQUIPMENT_ITEM__CARBONATION,
        EQUIPMENT_ITEM__DIASTATIC,
        EQUIPMENT_ITEM__AMYLASE,
    ];

    const EQUIPMENT_BASE_COST = {
        hydrolysis: {
            gold: 350_000,
            copper: 450_000,
            diamond: 250_000,
            tools: 10_000,
            marble: 16_000,
            granite: 600_000,
        },
        fermentation: {
            gold: 550_000,
            copper: 650_000,
            diamond: 400_000,
            tools: 15_000,
            marble: 25_000,
            granite: 800_000,
            iron: 800_000,
            woodenBeam: 400_000,
            stone: 150_000,
            charcoal: 60_000,
        },
        degradation: {
            gold: 1_050_000,
            copper: 1_650_000,
            diamond: 700_000,
            tools: 35_000,
            marble: 45_000,
            medallion: 170_000,
            granite: 1_800_000,
            iron: 4_000_000,
            wood: 5_600_000,
            strongWood: 2_300_000,
            stone: 3_500_000,
            charcoal: 180_000,
        },
        carbonation: {
            gold: 2_050_000,
            copper: 2_650_000,
            diamond: 1_200_000,
            tools: 75_000,
            marble: 95_000,
            medallion: 320_000,
            granite: 2_800_000,
            iron: 6_500_000,
            wood: 8_600_000,
            strongWood: 3_300_000,
            stone: 5_500_000,
            charcoal: 280_000,
        },
        diastatic: {
            gold: 4_050_000,
            copper: 5_650_000,
            diamond: 2_500_000,
            tools: 145_000,
            marble: 185_000,
            medallion: 620_000,
            granite: 5_400_000,
            iron: 12_500_000,
            wood: 15_600_000,
            strongWood: 6_300_000,
            stone: 10_500_000,
            charcoal: 480_000,
        },
        amylase: {
            gold: 8_050_000,
            copper: 10_650_000,
            diamond: 4_500_000,
            tools: 275_000,
            marble: 335_000,
            medallion: 1_220_000,
            granite: 10_400_000,
            iron: 24_500_000,
            wood: 30_600_000,
            strongWood: 12_300_000,
            stone: 20_500_000,
            charcoal: 880_000,
        },
    };

    Slot.prototype.state           = null;
    Slot.prototype.cache           = null;
    Slot.prototype.factory         = null;
    Slot.prototype.buildQueue      = null;
    Slot.prototype.numberFormatter = null;

    function Slot(state, cache, factory, buildQueue, numberFormatter) {
        this.state           = state;
        this.cache           = cache;
        this.factory         = factory;
        this.buildQueue      = buildQueue;
        this.numberFormatter = numberFormatter;

        ComposedValueRegistry
            .getComposedValue(CV_BOTTLE_CAP)
            .addModifier(
                SLOT__COMPOSED_VALUE_KEY,
                () => this.getBuildingMultiplier('bottleCapFactory').totalMultiplier
            );
    }

    /**
     * Build a new slot for the given building
     *
     * @param {string} building The key for the building to construct a slot at
     *
     * @returns {boolean}
     */
    Slot.prototype.buildSlot = function (building) {
        const state = this.state.getState();

        if (!state.equippedBuildings[building]) {
            state.equippedBuildings[building] = {
                slots: [],
            }
        }

        if (!this.buildQueue.addToQueue(BUILD_QUEUE__CONSTRUCT_SLOT, building, this.getNextSlotCosts(building))) {
            return false;
        }

        (new Beerplop.Notification()).notify({
            content: translator.translate('beerFactory.queue.addedSlot'),
            style:   'snackbar-success',
            timeout: 5000,
            channel: 'beerFactory',
        });

        return true;
    };

    /**
     * Get the costs for the next slot
     *
     * @param building
     */
    Slot.prototype.getNextSlotCosts = function (building) {
        const state        = this.state.getState(),
              costDivident = this.state.getFactory('stone').upgrades.diversify > 3 ? 2 : 1,
              freeSlots    = +(state.factories.academy.upgrades.explore >= 7 && this.isBuildingEquippedWith(building, EQUIPMENT_ITEM__DIASTATIC))
                             +(state.factories.academy.upgrades.explore >= 8 && this.isBuildingEquippedWith(building, EQUIPMENT_ITEM__AMYLASE));

        return [{
            name:      translator.translate('beerFactory.material.basePlate'),
            key:       'basePlate',
            delivered: 0,
            required:  Math.ceil(
                500 / costDivident * Math.pow(
                    5,
                    (state.equippedBuildings[building] ? state.equippedBuildings[building].slots.length - freeSlots : 0) +
                        this.getSlotsUnderConstruction(building)
                ) * this.factory.getBuilderReduction(BUILD_QUEUE__CONSTRUCT_SLOT)
            ),
        }];
    };

    /**
     * Check if the construction of building slots is enabled
     *
     * @returns {boolean}
     */
    Slot.prototype.buildingSlotsEnabled = function () {
        return this.state.getMaterial('basePlate').enabled;
    };

    /**
     * Get the slots of the given building
     *
     * @param {string} building
     *
     * @returns {Array}
     */
    Slot.prototype.getSlotsForBuilding = function (building) {
        const state = this.state.getState();

        return state.equippedBuildings[building] ? state.equippedBuildings[building].slots : [];
    };

    Slot.prototype.isAutoBuyerEnabled = function (building, globalCheck = true) {
        const state = this.state.getState();

        return state.equippedBuildings[building]
            ? this.isBuildingEquippedWith(building, EQUIPMENT_ITEM__DIASTATIC)
                && !!state.equippedBuildings[building].autoBuyer
                && (!globalCheck || !state.autoBuyerDisabled)
            : false;
    };

    Slot.prototype.toggleAutoBuyerEnabled = function (building) {
        return this.state.getState().equippedBuildings[building].autoBuyer = !this.isAutoBuyerEnabled(building, false);
    };

    Slot.prototype.isAutoLevelUpEnabled = function (building, globalCheck = true) {
        const state = this.state.getState();

        return state.equippedBuildings[building]
            ? this.isBuildingEquippedWith(building, EQUIPMENT_ITEM__AMYLASE)
                && !!state.equippedBuildings[building].autoLevelUp
                && (!globalCheck || !state.autoLevelUpDisabled)
            : false;
    };

    Slot.prototype.toggleAutoLevelUpEnabled = function (building) {
        return this.state.getState().equippedBuildings[building].autoLevelUp = !this.isAutoLevelUpEnabled(building, false);
    };

    /**
     * Get the equipment costs for adding the given equipment to the given building
     *
     * @param {string} building
     * @param {string} equipment
     */
    Slot.prototype.getNextEquipCosts = function (building, equipment) {
        let costMultiplier = 1;

        $.each(this.state.getState().equippedBuildings[building].slots, function checkBuildingEquipment () {
            if (this === null) {
                return;
            }

            costMultiplier *= this.equip === equipment ? 5 : 2;
        });

        let requiredMaterials = [];
        $.each(EQUIPMENT_BASE_COST[equipment], function (material, amount) {
            requiredMaterials.push({
                name:      translator.translate('beerFactory.material.' + material),
                key:       material,
                delivered: 0,
                required:  Math.ceil(amount * costMultiplier),
            });
        });

        return requiredMaterials;
    };

    /**
     * Get the amount of queued slot constructions for the given building
     *
     * @param {string} building
     *
     * @returns {number}
     */
    Slot.prototype.getSlotsUnderConstruction = function (building) {
        let queuedConstructions = 0;

        $.each(this.state.getBuildQueue(), function getBuildJobsFromBuildQueueForBuildingSlot (index, job) {
            if (job.action === BUILD_QUEUE__CONSTRUCT_SLOT && job.item === building) {
                queuedConstructions++;
            }
        });

        return queuedConstructions;
    };

    /**
     * Check if a given building is equipped with the given equipment
     *
     * @param {string}  building  The key of the requested building
     * @param {string}  equipment The key of the requested equipment
     * @param {boolean} completed Must the requested item be completed?
     *
     * @returns {boolean}
     */
    Slot.prototype.isBuildingEquippedWith = function (building, equipment, completed = true) {
        if (!this.state.getState().equippedBuildings[building]) {
            return false;
        }

        let isEquipped = false;

        $.each(this.state.getState().equippedBuildings[building].slots, function (index, slot) {
            // check if the slot is filled, the equipment matches and if the slot equipment is completed (if requested
            // to check for the completed state)
            if (slot && slot.equip === equipment && (!completed || slot.state === EQUIPMENT_STATE__FINISHED)) {
                isEquipped = true;
                return false;
            }
        });

        return isEquipped;
    };

    /**
     * Show the dialog to equip a slot
     *
     * @param {string} building  The building to equip
     * @param {int}    slotIndex The slot to edit
     */
    Slot.prototype.showSlotEquipDialog = function (building, slotIndex) {
        let slot = this.state.getState().equippedBuildings[building].slots[slotIndex];

        const modal             = $('#equip-modal'),
              modalBody         = $('#equip-modal__body'),
              parentModal       = $('#building-details-modal'),
              slotController    = this,
              hasDiastatic      = this.isBuildingEquippedWith(building, EQUIPMENT_ITEM__DIASTATIC, false),
              hasAmylase        = this.isBuildingEquippedWith(building, EQUIPMENT_ITEM__AMYLASE, false),
              currentEquip      = slot !== null ? slot.equip : null,
              explorationLevel  = this.state.getFactory('academy').upgrades.explore,
              looseSlotOnChange = slot !== null && (
                  (explorationLevel >= 7 && slot.equip === EQUIPMENT_ITEM__DIASTATIC) ||
                  (explorationLevel >= 8 && slot.equip === EQUIPMENT_ITEM__AMYLASE)
              ),
              renderModalBody   = (function () {
                  modalBody.html(
                      Mustache.render(
                          TemplateStorage.get('beer-factory__equip-slot-modal__body-template'),
                          {
                              equipped:          slot !== null,
                              underConstruction: slot !== null && slot.state === EQUIPMENT_STATE__UNDER_CONSTRUCTION,
                              looseSlotOnChange: looseSlotOnChange,
                              equippedLabel:     slot !== null
                                  ? this.getEquipmentLabel(slot.equip)
                                  : translator.translate('beerFactory.emptySlot'),
                              equippedContent: slot !== null
                                  ? this.getEquipmentEffectLabel(building, slot.equip)
                                  : translator.translate(
                                      'beerFactory.equipHint',
                                      {
                                          __BUILDING__: translator.translate('building.' + building, {}, '', 2),
                                      }
                                  ),
                              equippedKey: slot !== null ? slot.equip : 'empty',
                              availableEquipments: this.getUnlockedEquipments()
                                  .filter(function (item) {
                                      return (slot === null || slot.equip !== item)
                                          // Amylase and Diastatic Enzymes can only be constructed once for each building
                                          && (item !== EQUIPMENT_ITEM__DIASTATIC || !hasDiastatic)
                                          && (item !== EQUIPMENT_ITEM__AMYLASE || !hasAmylase)
                                          // Carbonation isn't allowed for Bottle Cap Factories
                                          && (item !== EQUIPMENT_ITEM__CARBONATION || building !== 'bottleCapFactory');
                                  })
                                  .map((function (item) {
                                      return {
                                          key:   item,
                                          label: this.getEquipmentLabel(item),
                                      }
                                  }).bind(this)),
                          }
                      )
                  );

                  modal.find('.modal-title').text(
                      translator.translate(
                          'beerFactory.equipSlotHead',
                          {
                              __SLOT_INDEX__: slotIndex + 1,
                              __BUILDING__:   translator.translate('building.' + building, {}, '', 2),
                          }
                      )
                  );

                  const availableItems = modalBody.find('.beer-factory__slot:not(.beer-factory__slot--equipped)');

                  modalBody.find('.beer-factory__slot--equipped').popover();
                  availableItems.popover({
                      content: function () {
                          const item = $(this).data('item');
                          return Mustache.render(
                              TemplateStorage.get('beer-factory__slot-item-popover-template'),
                              {
                                  effect:    slotController.getEquipmentEffectLabel(building, item),
                                  materials: slotController.getNextEquipCosts(building, item).map(function (material) {
                                      return {
                                          name:   material.name,
                                          amount: slotController.numberFormatter.formatInt(material.required),
                                      };
                                  }),
                              }
                          );
                      }
                  });

                  availableItems.on('click', (function (event) {
                      const achievementController = new Beerplop.AchievementController(),
                            resetAutomation       = (function () {
                                // if a slot with automation is changed reset the automation settings
                                if (currentEquip === EQUIPMENT_ITEM__DIASTATIC) {
                                    delete this.state.getState().equippedBuildings[building].autoBuyer;
                                }
                                if (currentEquip === EQUIPMENT_ITEM__AMYLASE) {
                                    delete this.state.getState().equippedBuildings[building].autoLevelUp;
                                }
                            }).bind(this),
                            checkRebuildAchievement = function () {
                                if (currentEquip !== null) {
                                    achievementController.checkAchievement(
                                        achievementController.getAchievementStorage().achievements.beerFactory.slots.rebuild
                                    );
                                }
                            };

                      if (looseSlotOnChange) {
                          this.state.getState().equippedBuildings[building].slots.splice(slotIndex, 1);
                          parentModal.find('.beer-factory__slot')[slotIndex].remove();

                          modal.modal('hide');

                          achievementController.checkAchievement(
                              achievementController.getAchievementStorage().achievements.beerFactory.slots.removed
                          );

                          checkRebuildAchievement();
                          resetAutomation();

                          return;
                      }

                      const equipment = $(event.target).closest('.beer-factory__slot').data('item');

                      if (this.buildQueue.addToQueue(
                              BUILD_QUEUE__EQUIP_SLOT,
                              {
                                  building:  building,
                                  slot:      slotIndex,
                                  equipment: equipment,
                              },
                              this.getNextEquipCosts(building, equipment),
                          )
                      ) {
                          // update the slot variable (may be null before this code is executed on first equipment, so
                          // not always a reference)
                          slot = this.state.getState().equippedBuildings[building].slots[slotIndex];

                          modalBody.find('.beer-factory__slot').popover('dispose');
                          renderModalBody();

                          (new Beerplop.Notification()).notify({
                              content: translator.translate(
                                  'beerFactory.queue.equipAdded',
                                  {
                                      __BUILDING__: translator.translate('building.' + building, null, '', 2),
                                  }
                              ),
                              style: 'snackbar-success',
                              timeout: 5000,
                              channel: 'beerFactory',
                          });

                          checkRebuildAchievement();
                          resetAutomation();
                      }
                  }).bind(this));
              }).bind(this);

        renderModalBody();

        // make sure the content of the parent modal isn't cleared as it'll be opened after closing the slot equip modal
        parentModal.addClass('modal__dynamic-content__lock');
        parentModal.modal('hide');

        modal.modal('show');
        modal.on('hide.bs.modal.openParent', (function () {
            $('#building-details-modal').modal('show');
            parentModal.removeClass('modal__dynamic-content__lock');

            modal.off('hide.bs.modal.openParent');
        }).bind(this));
    };

    Slot.prototype.getUnlockedEquipments = function () {
        let exploreLevel = this.state.getFactory('academy').upgrades.explore;

        // cut away explorations which don't provide an equipment
        if (exploreLevel >= 7) {
            exploreLevel--;
        }
        if (exploreLevel >= 8) {
            exploreLevel--;
        }

        return EQUIPMENT_MAP.slice(0, exploreLevel);
    };

    Slot.prototype.getEquipmentLabel = function (equipment) {
        return translator.translate('beerFactory.equipment.' + equipment);
    };

    /**
     * Get the description label for an equipment
     *
     * @param {string} building The building which shall be equipped
     * @param {string} item     The item to equip the building with
     *
     * @returns {string}
     */
    Slot.prototype.getEquipmentEffectLabel = function(building, item) {
        // degradation has a different effect for Bottle Cap Factories, consequently display a different description
        const key = (building === 'bottleCapFactory' && item === EQUIPMENT_ITEM__DEGRADATION)
            ? `beerFactory.equipment.degradation.effect.bottleCapFactory`
            : `beerFactory.equipment.${item}.effect`;

        return translator.translate(
            key,
            {
                '__BUILDING_PLURAL__': translator.translate('building.' + building, null, '', 2),
            }
        );
    };

    /**
     * Get the multiplier the production of the given building gets by the equipped items
     *
     * @param {string} building
     *
     * @returns {Object}
     */
    Slot.prototype.getBuildingMultiplier = function(building) {
        let carbonation = building !== 'bottleCapFactory' ? this.cache.getCarbonationBuildingAmountCache() : 1,
            result      = {
                totalMultiplier: carbonation,
                carbonation:     carbonation,
                equipmentBoost:  1,
            },
            state       = this.state.getState();

        if (!state.equippedBuildings[building]) {
            return result;
        }

        const multiplierMap = {
            hydrolysis: 1.15,
            fermentation: 1.3,
        };

        $.each(
            state.equippedBuildings[building].slots,
            function calculateBeerFactoryBuildingMultiplier(index, equippedItem) {
                if (equippedItem &&
                    equippedItem.state === EQUIPMENT_STATE__FINISHED &&
                    multiplierMap[equippedItem.equip]
                ) {
                    result.equipmentBoost *= multiplierMap[equippedItem.equip];
                }
            }
        );

        result.totalMultiplier *= result.equipmentBoost;

        return result;
    };

    /**
     * Get the multiplier the lifetime of a spawned building boost buff bottle of the given building gets by the
     * equipped items of the building
     *
     * @param {string} building
     *
     * @returns {number}
     */
    Slot.prototype.getBuildingBoostBuffBottleMultiplier = function(building) {
        const state = this.state.getState();

        if (!state.equippedBuildings[building]) {
            return 1;
        }

        let multiplier = 1;

        $.each(
            state.equippedBuildings[building].slots,
            function calculateBuildingBoostBuffBottleMultiplier(index, equippedItem) {
                if (equippedItem &&
                    equippedItem.state === EQUIPMENT_STATE__FINISHED &&
                    equippedItem.equip === EQUIPMENT_ITEM__DEGRADATION
                ) {
                    multiplier *= 1.5;
                }
            }
        );

        return multiplier;
    };

    beerFactoryGame.Slot = Slot;
})(BeerFactoryGame);
