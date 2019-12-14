(function(minigames) {
    'use strict';

    const COMPOSED_VALUE_MODIFIER_KEY = 'BeerBlender';
    // A list of all composed values which may be affected by the Beer Blender Bar. If the Beer Blender Bar equipment
    // is changed an update for all these values is triggered
    const AFFECTED_COMPOSED_VALUES_MAP = {
        bottleCaps: CV_BOTTLE_CAP,
        mana:       CV_MANA,
        beerBank:   CV_BEER_BANK,
    };

    const MAX_SLOTS = 4;

    const INGREDIENTS = {
        apple: {
            effect: {
                plop: 0.1,
                bottleCaps: -0.05,
            },
        },
        banana: {
            effect: {
                plop: -0.05,
                bottleCaps: 0.1,
            },
        },
        lime: {
            effect: {
                plop: -0.05,
                bottleCaps: -0.05,
                buffLength: 0.15,
            },
        },
        pear: {
            effect: {
                plop: 0.05,
                bottleCaps: 0.05,
                buffLength: -0.1,
            }
        },
        chili: {
            effect: {
                plop: 0.05,
                bottleCaps: 0.05,
                buildings: 0.1,
            }
        },
        grape: {
            effect: {
                plop: 0.2,
                bottleCaps: -0.1,
                buildings: 0.1,
                buffLength: -0.1,
            },
        },
        melon: {
            effect: {
                plop: -0.15,
                bottleCaps: 0.25,
                buffLength: -0.15,
            },
        },
        cherry: {
            effect: {
                bottleCaps: -0.1,
                beerBank: 0.15,
            },
        },
        blueberry: {
            effect: {
                bottleCaps: -0.1,
                plop: -0.1,
                mana: 0.2,
            },
        },
        woodruff: {
            effect: {
                bottleCaps: 0.2,
                plop: -0.1,
                mana: -0.1,
                beerBank: 0.2,
            },
        },
         egg: {
            effect: {
                bottleCaps: -0.1,
                plop: -0.1,
                mana: -0.1,
                factory: 0.2,
            },
        },
    };

    BeerBlender.prototype._instance = null;

    BeerBlender.prototype.gameEventBus          = null;
    BeerBlender.prototype.achievementController = null;

    BeerBlender.prototype.state = {
        slots: [null, null],
        ingredients: ['apple', 'banana', 'lime'],
        presets: [],
    };

    BeerBlender.prototype.modificationCache = {};
    BeerBlender.prototype.availablePresets  = 0;

    /**
     * Initialize the beer bank mini game
     *
     * @constructor
     */
    function BeerBlender(gameEventBus) {
        if (BeerBlender.prototype._instance) {
            return BeerBlender.prototype._instance;
        }

        BeerBlender.prototype._instance = this;

        this.gameEventBus = gameEventBus;

        const initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'BeerBlender',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(true, {}, initialState, loadedData);
            }.bind(this))
        );

        $.each(AFFECTED_COMPOSED_VALUES_MAP, (effectKey, composedValueKey) =>
            ComposedValueRegistry.getComposedValue(composedValueKey).addModifier(
                COMPOSED_VALUE_MODIFIER_KEY,
                () => this.getEffect(effectKey),
            )
        );
    }

    BeerBlender.prototype.unlockBeerBlender = function () {
        this.achievementController.checkAchievement(
            this.achievementController.getAchievementStorage().achievements.special.beerBlender.unlocked
        );

        this._renderBeerBlender();
        $('#beer-blender-control').removeClass('d-none');

        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, () => this.availablePresets = 0);
    };

    BeerBlender.prototype._renderBeerBlender = function () {
        const numberFormatter     = new Beerplop.NumberFormatter(),
              container           = $('#beer-blender__body');
        let   equippedIngredients = [];

        $.each(this.state.slots, function (id, ingredient) {
            if (ingredient !== null) {
                equippedIngredients.push(ingredient);
            }
        });

        this._rebuildModificationCache();

        let effectLabels = [];
        $.each(this.modificationCache, function (key, value) {
            effectLabels.push({
                description: translator.translate('beerBlender.' + key + (value > 0 ? 'Up' : 'Down'))
                    .replace('__', numberFormatter.formatInt(value * 100))
            });
        });

        container.html(
            Mustache.render(
                TemplateStorage.get('beer-blender__body-template'),
                $.extend(
                    this._getEquipment(this.state.slots, equippedIngredients),
                    {
                        effectLabels:      effectLabels,
                        availablePresets : this.availablePresets,
                        createNewPreset:   this.state.presets.length < this.availablePresets,
                        presets:           Object.entries(this.state.presets).map((function (preset) {
                            return {
                                presetId:    preset[0],
                                ingredients: preset[1],
                            };
                        }).bind(this)),
                    },
                ),
                {
                    equipTemplate: TemplateStorage.get('beer-blender__equip-template'),
                }
            )
        );

        this._initEquipmentEventListener(
            container,
            this.state.slots,
            () => {
                this._renderBeerBlender();
                this._checkEquippedSlotsAchievements();
            },
        );

        container.find('.beer-blender__preset-delete').on('click', (function (event) {
            this.state.presets.splice($(event.target).closest('.beer-blender__preset-container').data('presetId'), 1);
            this._renderBeerBlender();

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.special.beerBlender.presetDel
            );
        }).bind(this));

        container.find('.beer-blender__preset-equip').on('click', (function (event) {
            this.state.slots = [...this.state.presets[
                $(event.target).closest('.beer-blender__preset-container').data('presetId')
            ]];

            this._renderBeerBlender();
        }).bind(this));

        $('#beer-blender__preset-new').on('click', () => this._showPresetModal());
    };

    BeerBlender.prototype._initEquipmentEventListener = function (container, affectedSlots, updateCallback) {
        const ingredients             = container.find('.beer-blender__ingredient'),
              interactableIngredients = container.find('.beer-blender__ingredient-manual');

        ingredients.tooltip({
            title: function renderBeerBlenderIngredientTooltip(event) {
                const ingredient      = $(this).data('ingredient'),
                      numberFormatter = new Beerplop.NumberFormatter();

                let effects = [];
                $.each(INGREDIENTS[ingredient].effect, function (key, value) {
                    effects.push({
                        description: translator.translate('beerBlender.' + key + (value > 0 ? 'Up' : 'Down'))
                            .replace('__', numberFormatter.formatInt(value * 100))
                    });
                });

                return Mustache.render(
                    TemplateStorage.get('beer-blender__effect-tooltip-template'),
                    {
                        ingredient: translator.translate('beerBlender.' + ingredient),
                        effects:    effects,
                    }
                )
            }
        });

        // make items equippable/unequippable via double click
        interactableIngredients.on('dblclick', (function (event) {
            const ingredient = $(event.target).closest('.beer-blender__ingredient');

            // unequip an equipped slot
            if (ingredient.hasClass('beer-blender__ingredient-equipped')) {
                affectedSlots[ingredient.closest('.beer-blender__slot').data('slot')] = null;

                ingredient.tooltip('hide');
                updateCallback();

                return;
            }

            // check for a free slot to equip
            $.each(affectedSlots, (function (slotIndex, equip) {
                if (equip === null) {
                    affectedSlots[slotIndex] = ingredient.data('ingredient');

                    ingredient.tooltip('hide');
                    updateCallback();

                    return false;
                }
            }).bind(this));
        }).bind(this));

        interactableIngredients.draggable({
            revert:      'invalid',
            containment: '#' + container.attr('id'),
            scroll:      false,
        });

        container.find('.beer-blender__free-slot').droppable({
            accept: '.beer-blender__ingredient-available',
            drop: (function(event, ui) {
                affectedSlots[$(event.target).data('slot')] = $(ui.draggable).data('ingredient');

                $(ui.draggable).tooltip('hide');
                updateCallback();
            }).bind(this)
        });

        container.find('.beer-blender__available-ingredients').droppable({
            accept: '.beer-blender__ingredient-equipped',
            drop: (function(event, ui) {
                const unequipped = $(ui.draggable).data('ingredient');

                // unequip the slot
                $.each(affectedSlots, (function (slotKey, equipment) {
                    if (unequipped === equipment) {
                        affectedSlots[slotKey] = null;
                        return false;
                    }
                }).bind(this));

                ingredients.tooltip('hide');
                updateCallback();
            }).bind(this)
        });
    };

    BeerBlender.prototype._getEquipment = function (slots, equippedIngredients) {
        return {
            availableSlots:       Object.keys(slots).map((function (slotKey) {
                const ingredientKey = slots[slotKey];

                return {
                    equipped: ingredientKey ? translator.translate('beerBlender.' + ingredientKey) : null,
                    key:      ingredientKey,
                    slotKey:  slotKey,
                };
            }).bind(this)),
            availableIngredients: $(this.state.ingredients).not(equippedIngredients).get().map(function (item) {
                return {
                    key:  item,
                };
            }),
        };
    };

    /**
     * Show the modal to create a new preset
     *
     * @private
     */
    BeerBlender.prototype._showPresetModal = function () {
        let slots = [null, null, null, null];

        const modal           = $('#beer-blender-bar__create-preset-modal'),
              container       = $('#beer-blender-bar__create-preset-modal__body'),
              createButton    = $('#beer-blender-bar__create-preset'),
              numberFormatter = new Beerplop.NumberFormatter(),
              renderModal     = () => {
                  let effectLabels = [];
                  $.each(this._getModifications(slots), function (key, value) {
                      effectLabels.push({
                          description: translator.translate('beerBlender.' + key + (value > 0 ? 'Up' : 'Down'))
                              .replace('__', numberFormatter.formatInt(value * 100))
                      });
                  });

                  container.html(
                      Mustache.render(
                          TemplateStorage.get('beer-blender__equip-template'),
                          $.extend(this._getEquipment(slots, slots), {effectLabels: effectLabels}),
                      )
                  );

                  this._initEquipmentEventListener(
                      container,
                      slots,
                      renderModal,
                  );
              };

        renderModal();

        createButton.off('click');
        createButton.on('click', () => {
            this.state.presets.push(slots);
            this._renderBeerBlender();

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.special.beerBlender.preset
            );

            if(slots.every(ingredient => ingredient === null)) {
                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.special.beerBlender.presetEmpty
                );
            }
        });
        modal.modal('show');
    };

    /**
     * Check for achievements for the amount of equipped slots
     *
     * @private
     */
    BeerBlender.prototype._checkEquippedSlotsAchievements = function () {
        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.special.beerBlender.equipped,
            Object.values(this.state.slots).reduce((carry, ingredient) => carry + (ingredient !== null), 0)
        );
    };

    BeerBlender.prototype._rebuildModificationCache = function () {
        this.modificationCache = this._getModifications(this.state.slots);

        this.gameEventBus.emit(EVENTS.BEER_BLENDER.UPDATE);

        $.each(AFFECTED_COMPOSED_VALUES_MAP, (effectKey, composedValueKey) =>
            ComposedValueRegistry.getComposedValue(composedValueKey).triggerModifierChange(COMPOSED_VALUE_MODIFIER_KEY)
        );
    };

    BeerBlender.prototype._getModifications = function (slots) {
        let modifications = {};

        $.each(slots, (function (index, equippedIngredient) {
            if (equippedIngredient) {
                $.each(INGREDIENTS[equippedIngredient].effect, (function (key, value) {
                    modifications[key]
                        ? modifications[key] += value
                        : modifications[key] = value;

                    // nice floating point calculations
                    if (modifications[key] > -0.0001 && modifications[key] < 0.0001) {
                        delete modifications[key];
                    }
                }).bind(this));
            }
        }).bind(this));

        return modifications;
    };

    BeerBlender.prototype.unlockAdditionalSlot = function (slot) {
        if (this.state.slots[slot] || slot < 1 || slot > MAX_SLOTS) {
            return;
        }

        this.state.slots[slot] = null;
        this._renderBeerBlender();
    };

    BeerBlender.prototype.unlockAdditionalIngredient = function (ingredient) {
        if ($.inArray(ingredient, this.state.ingredients) === -1 && INGREDIENTS[ingredient]) {
            this.state.ingredients.push(ingredient);
            this._renderBeerBlender();
        }
    };

    BeerBlender.prototype.getEffect = function (effect) {
        return this.modificationCache[effect] ? (1 + this.modificationCache[effect]) : 1;
    };

    BeerBlender.prototype.addAvailablePresets = function (amount) {
        this.availablePresets += amount;

        this._renderBeerBlender();
    };

    BeerBlender.prototype.setAchievementController = function (achievementController) {
        this.achievementController = achievementController;
    };

    minigames.BeerBlender = BeerBlender;
})(Minigames);
