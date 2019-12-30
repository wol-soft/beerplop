(function(beerplop) {
    'use strict';

    // the possibility of a buff occuring during an iteration in percent
    BuffController.prototype.buffPossibility = 0.3;

    // the lifetime of a buff bottle in seconds
    BuffController.prototype.buffLifetime = 9;

    // the multiplier of an assembly line
    BuffController.prototype.assemblyLinePower = 5;
    BuffController.prototype.bottleChainPower  = 1;

    BuffController.prototype.gameState    = null;
    BuffController.prototype.gameEventBus = null;
    BuffController.prototype.flyoutText   = null;
    BuffController.prototype.beerBlender  = null;
    BuffController.prototype.beerFactory  = null;
    BuffController.prototype.beerBank     = null;

    BuffController.prototype.buffBottleCounter = 0;

    BuffController.prototype.buffIntervals     = {};
    BuffController.prototype.progressIntervals = {};

    BuffController.prototype.buffBottlesClicked = 0;

    BuffController.prototype.buffEffectMultiplier = 1;

    BuffController.prototype.doubleBottlePossibility = 0;
    BuffController.prototype.autoClickPossibility    = 0;

    BuffController.prototype.beerBankBoost = 1;
    BuffController.prototype.beerFactoryBoost = 1;

    BuffController.prototype.additionalBuffs = {
        stockMarketLobby: false,
        beerBankBoost:    false,
        researchBoost:    false,
        manaBoost:        false,
        shortenBeerwarts: false,
        beerFactory:      false,
    };

    /**
     * Initialize the save state controller
     *
     * @constructor
     */
    function BuffController(gameState, gameEventBus, beerBlender, beerFactory, beerBank) {
        this.gameState    = gameState;
        this.gameEventBus = gameEventBus;
        this.beerBlender  = beerBlender;
        this.beerFactory  = beerFactory;
        this.beerBank     = beerBank;
        this.flyoutText   = new Beerplop.FlyoutText();

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function () {
            if (Math.random() * 100 < this.buffPossibility) {
                this.spawnBuffBottle();

                if (this.doubleBottlePossibility && Math.random() * 100 < this.doubleBottlePossibility) {
                    this.spawnBuffBottle();
                }
            }
        }).bind(this));

        (new Beerplop.GamePersistor()).registerModule(
            'BuffController',
            (function () {
                return this.buffBottlesClicked;
            }.bind(this)),
            (function (loadedData) {
                this.buffBottlesClicked = loadedData || 0;
            }.bind(this))
        );

        this.gameEventBus.on(EVENTS.CORE.SACRIFICE, (function () {
            this.buffPossibility   = 0.3;
            this.buffLifetime      = 9;
            this.assemblyLinePower = 5;
            this.bottleChainPower  = 1;

            $.each(this.buffIntervals, function () {
                window.clearInterval(this);
            });

            this.buffIntervals     = {};
            this.progressIntervals = {};
            $('.buff-progress-container').html('');

            this.buffEffectMultiplier    = 1;
            this.doubleBottlePossibility = 0;
            this.autoClickPossibility    = 0;

            this.additionalBuffs = {
                stockMarketLobby: false
            };
        }).bind(this));

        ComposedValueRegistry.getComposedValue(CV_BEER_BANK).addModifier('Buff', () => this.beerBankBoost);
        ComposedValueRegistry.getComposedValue(CV_FACTORY).addModifier('Buff', () => this.beerFactoryBoost - (this.beerFactoryBoost > 1));
    }

    /**
     * Enable an additional buff
     *
     * @param {string} buff
     */
    BuffController.prototype.enableAdditionalBuff = function (buff) {
        this.additionalBuffs[buff] = true;
    };

    BuffController.prototype.increaseBuffPossibility = function (possibility) {
        this.buffPossibility += possibility;
    };

    BuffController.prototype.increaseBuffLifetime = function (lifetime) {
        this.buffLifetime += lifetime;
    };

    BuffController.prototype.setDoubleBottlePossibility = function (doubleBottlePossibility) {
        this.doubleBottlePossibility = Math.min(doubleBottlePossibility, 100);
    };

    BuffController.prototype.setAutoClickPossibility = function (autoClickPossibility) {
        this.autoClickPossibility = Math.min(autoClickPossibility, 100);
    };

    BuffController.prototype.increaseBuffEffectMultiplier = function (buffEffectMultiplier) {
        this.buffEffectMultiplier *= buffEffectMultiplier;
    };

    BuffController.prototype.increaseAssemblyLinePower = function (additionalAssemblyLinePower) {
        this.assemblyLinePower += additionalAssemblyLinePower;
    };

    BuffController.prototype.increaseBottleChainPower = function (additionalBottleChainPower) {
        this.bottleChainPower += additionalBottleChainPower;
    };

    BuffController.prototype.spawnBuffBottle = function (lifetime, clickCallback, removeCallback, forceBuff = '') {
        let x  = Math.random() * (window.innerWidth - 200) + 100,
            y  = Math.random() * (window.innerHeight - 200) + 100,
            id = 'buff-bottle-' + (++this.buffBottleCounter);

        $('body').append(
            '<svg id="' + id + '"' +
                ' class="buff-bottle buff-bottle-spawn"' +
                ' style="left:' + x + 'px;top:' + y + 'px;"' +
            '><use xlink:href="#svg-buff-bottle"></use></svg>'
        );

        let buffBottle = $('#' + id);

        buffBottle.css('opacity');
        buffBottle.removeClass('buff-bottle-spawn');
        buffBottle.css('top', (y - 100) + 'px');
        buffBottle.css('left', (x - 50) + 'px');

        let buffLifetime = lifetime || this.buffLifetime,

            clickCallbackFunction = clickCallback || (function (event, buffBottle, x, y) {
                    this.gameEventBus.emit(
                        EVENTS.CORE.BUFF.CLICKED,
                        {
                            buff:               this._initBuff(buffBottle, event, x, y, forceBuff),
                            buffBottlesClicked: ++this.buffBottlesClicked,
                            // if the buff bottle was clicked manually the originalEvent contains the MouseEvent
                            autoClick:          typeof event.originalEvent === 'undefined',
                        }
                    );
                }).bind(this),

            removeCallbackFunction = removeCallback || (function (buffBottle) {
                    this.gameEventBus.emit(EVENTS.CORE.BUFF.MISSED);
                    buffBottle.remove()
                }).bind(this);

        window.setTimeout(() => buffBottle.addClass('buff-bottle-spawn'), (buffLifetime - 3) * 1000);

        if (this.autoClickPossibility && Math.random() * 100 < this.autoClickPossibility) {
            window.setTimeout(() => buffBottle.trigger('click'), (buffLifetime / 2) * 1000);
        }

        window.setTimeout(
            function() {
                // if the bottle still exists (wasn't clicked before) call the remove callback function
                if ($.contains(document, buffBottle[0])) {
                    removeCallbackFunction(buffBottle);
                }
            },
            buffLifetime * 1000
        );

        buffBottle.on('click', function (event) {
            clickCallbackFunction(event, buffBottle, x, y);
            event.stopPropagation();
        });

        this.gameEventBus.emit(EVENTS.CORE.BUFF.SPAWNED, id);
    };

    /**
     * Get all available buffs
     *
     * @return {Object}
     * @private
     */
    BuffController.prototype._getPossibleBuffs = function () {
        let buffs = {
            masterOpener: {
                lifetime: 5 * this.buffEffectMultiplier,
                possibility: 2
            },
            bottleChain: {
                lifetime: 0,
                possibility: 2
            },
            buildingBoost: {
                lifetime: 10 * this.buffEffectMultiplier,
                possibility: 2
            },
            assemblyLine: {
                lifetime: 30 * this.buffEffectMultiplier,
                possibility: 4
            },
            luckyBottle:  {
                lifetime: 0,
                possibility: 4
            },
            bottleCap: {
                lifetime: 30 * this.buffEffectMultiplier,
                possibility: 2
            },
            beerSale: {
                lifetime: 3 * this.buffEffectMultiplier,
                possibility: 1
            }
        };

        if (this.additionalBuffs.stockMarketLobby) {
            buffs['stockMarketLobby'] = {
                lifetime: 20 * (1 + this.buffEffectMultiplier / 2),
                possibility: 2
            }
        }

        if (this.additionalBuffs.beerBankBoost) {
            buffs['beerBankBoost'] = {
                lifetime: 30 * this.buffEffectMultiplier,
                possibility: 1
            };
        }

        if (this.additionalBuffs.researchBoost) {
            buffs['researchBoost'] = {
                lifetime: 30 * this.buffEffectMultiplier,
                possibility: 1
            };
        }

        if (this.additionalBuffs.manaBoost) {
            buffs['manaBoost'] = {
                lifetime: 30 * this.buffEffectMultiplier,
                possibility: 1
            };
        }

        if (this.additionalBuffs.shortenBeerwarts) {
            buffs['shortenBeerwarts'] = {
                lifetime: 0,
                possibility: 1
            };
        }

        if (this.additionalBuffs.beerFactory) {
            buffs['beerFactory'] = {
                lifetime: 30 * this.buffEffectMultiplier,
                possibility: 1
            };
        }

        let autoPlopBoostingBuffs = 0;
        $.each(this.progressIntervals, function () {
            if ($.inArray(this.type, ['assemblyLine', 'buildingBoost']) !== -1) {
                autoPlopBoostingBuffs++;
            }

            // deny parallel beer sales
            if (this.type === 'beerSale') {
                delete buffs['beerSale'];
            }
        });

        // if there are already auto plop boosting buffs active minimize the possibility for a master opener
        if (autoPlopBoostingBuffs > 0) {
            const multiplier = Math.pow(2, autoPlopBoostingBuffs);

            $.each(buffs, function (buff) {
                if (buff !== 'masterOpener') {
                    buffs[buff].possibility *= multiplier;
                }
            });
        }

        return buffs;
    };

    BuffController.prototype._initBuff = function (buffBottle, clickEvent, x, y, forceBuff = '') {
        let buffs           = this._getPossibleBuffs(),
            buffList        = [],
            numberFormatter = new Beerplop.NumberFormatter();

        $.each(buffs, function (buffLabel, buff) {
            for (let i = 0; i < buff.possibility; i++) {
                buffList.push(buffLabel);
            }
        });

        let buff           = forceBuff || buffList[Math.floor(Math.random() * buffList.length)],
            lifetime       = buffs[buff].lifetime * 1000 * this.beerBlender.getEffect('buffLength'),
            buffText       = '',
            buffProgressId = buffBottle.prop('id') + '-progress';

        buffBottle.remove();

        switch (buff) {
            case 'masterOpener':
                const masterOpenerMultiplier = 150;

                this.gameState.addManualClicksMultiplier(masterOpenerMultiplier);

                buffText = translator.translate(
                    'buff.masterOpener',
                    {
                        __BOOST__: numberFormatter.format(masterOpenerMultiplier)
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        this.gameState.removeManualClicksMultiplier(masterOpenerMultiplier);
                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'assemblyLine':
                // store in a separate value so there will no problems if an upgrade is purchased during an assembly
                // line is active
                const assemblyLineMultiplier = this.assemblyLinePower;

                this.gameState.addBuffAutoPlopsMultiplier(assemblyLineMultiplier);

                buffText = translator.translate(
                    'buff.assemblyLine',
                    {
                        __BOOST__: numberFormatter.format(assemblyLineMultiplier)
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        this.gameState.removeBuffAutoPlopsMultiplier(assemblyLineMultiplier);
                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'beerSale':
                this.gameState.addBuffBuildingReduction(0.15);
                $('body').addClass('beer-sale');
                buffText = translator.translate('buff.beerSale');

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        this.gameState.removeBuffBuildingReduction(0.15);
                        this._removeBuffProgress(buffProgressId);
                        $('body').removeClass('beer-sale');
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'bottleCap':
                // store in a separate value so there will no problems if an upgrade is purchased during an assembly
                // line is active
                const bottleCapProductionMultiplier = this.assemblyLinePower;

                // get the multiplier to add enlarged lifetimes by equipped building slots
                lifetime *= this.beerFactory
                    .getSlotController()
                    .getBuildingBoostBuffBottleMultiplier('bottleCapFactory');

                this.gameState
                    .getBuildingLevelController()
                    .addBuffBottleCapProductionMultiplier(bottleCapProductionMultiplier);

                buffText = translator.translate(
                    'buff.bottleCapStorm',
                    {
                        __BOOST__: numberFormatter.format(bottleCapProductionMultiplier)
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        this.gameState
                            .getBuildingLevelController()
                            .removeBuffBottleCapProductionMultiplier(bottleCapProductionMultiplier);
                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'beerBankBoost':
                // store in a separate value so there will no problems if an upgrade is purchased during an assembly
                // line is active
                const beerBankBoostMultiplier = this.assemblyLinePower * 1.5;

                this.beerBankBoost += beerBankBoostMultiplier;
                ComposedValueRegistry.getComposedValue(CV_BEER_BANK).triggerModifierChange('Buff');

                buffText = translator.translate(
                    'buff.beerBank',
                    {
                        __BOOST__: numberFormatter.format(beerBankBoostMultiplier)
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        this.beerBankBoost -= beerBankBoostMultiplier;
                        ComposedValueRegistry.getComposedValue(CV_BEER_BANK).triggerModifierChange('Buff');
                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'researchBoost':
                // store in a separate value so there will no problems if an upgrade is purchased while a research boost
                // is active
                const researchBoostMultiplier = this.assemblyLinePower * 1.5;

                (new Minigames.ResearchProject()).addResearchProjectInvestmentMultiplier(researchBoostMultiplier);

                buffText = translator.translate(
                    'buff.researchProject',
                    {
                        __BOOST__: numberFormatter.format(researchBoostMultiplier)
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        (new Minigames.ResearchProject())
                            .removeResearchProjectInvestmentMultiplier(researchBoostMultiplier);

                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'manaBoost':
                // store in a separate value so there will no problems if an upgrade is purchased while a mana boost
                // is active
                const manaBoostBoostMultiplier = this.assemblyLinePower * 1.5;

                (new Minigames.Beerwarts()).addManaProductionMultiplier(manaBoostBoostMultiplier);

                buffText = translator.translate(
                    'buff.mana',
                    {
                        __BOOST__: numberFormatter.format(manaBoostBoostMultiplier)
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        (new Minigames.Beerwarts()).removeManaProductionMultiplier(manaBoostBoostMultiplier);

                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'shortenBeerwarts':
                const percentage = 5 * this.buffEffectMultiplier,
                      shortened  = (new Minigames.Beerwarts()).shortenTrainings(percentage);

                buffText = translator.translate(
                    'buff.shortenBeerwarts',
                    {
                        __AMOUNT__:     numberFormatter.formatInt(shortened),
                        __PERCENTAGE__: numberFormatter.formatInt(percentage),
                    }
                );

                break;
            case 'beerFactory':
                // store in a separate value so there will no problems if an upgrade is purchased while a mana boost
                // is active
                // included buff-bottle-related multipliers into CV_FACTORY -- 2ndK16, 30.12.2019
                const beerFactoryMultiplier = this.assemblyLinePower;

                this.beerFactoryBoost += beerFactoryMultiplier;
                ComposedValueRegistry.getComposedValue(CV_FACTORY).triggerModifierChange('Buff');

                buffText = translator.translate(
                    'buff.beerFactory',
                    {
                        __BOOST__: numberFormatter.format(beerFactoryMultiplier)
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        this.beerFactoryBoost -= beerFactoryMultiplier;
                        ComposedValueRegistry.getComposedValue(CV_FACTORY).triggerModifierChange('Buff');

                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'buildingBoost':
                const selectedBuilding = this.gameState.getRandomOwnedBuilding();

                // Fallback if no buildings are owned yet
                if (selectedBuilding === null) {
                    buffText = translator.translate(
                        'buff.luckyBottle',
                        {
                            __PLOPS__: numberFormatter.format(2000)
                        }
                    );
                    this.gameState.addPlops(2000);
                    break;
                }

                const buildingData = this.gameState.getBuildingData(selectedBuilding),
                      boost        = Math.pow(buildingData.amount * 10, 1 - buildingData.amount / 2e4),
                      roundedBoost = 1 + (+(boost / 100).toFixed(2));

                // get the multiplier to add enlarged lifetimes by equipped building slots
                lifetime *= this.beerFactory.getSlotController().getBuildingBoostBuffBottleMultiplier(selectedBuilding);

                this.gameState.addBuffAutoPlopsMultiplier(roundedBoost);

                buffText = translator.translate(
                    'buff.buildingBoost',
                    {
                        __AMOUNT__:   numberFormatter.formatInt(buildingData.amount),
                        __BUILDING__: translator.translate('building.' + selectedBuilding, {}, '', buildingData.amount),
                        __BOOST__:    numberFormatter.format(boost),
                    }
                );

                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        this.gameState.removeBuffAutoPlopsMultiplier(roundedBoost);
                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
            case 'luckyBottle':
                let plops = Math.min(this.gameState.getPlops() * 0.2, this.gameState.getAutoPlopsPerSecond() * 150);

                plops    = (plops > 200 ? plops : 200) * this.buffEffectMultiplier;
                buffText = translator.translate(
                    'buff.luckyBottle',
                    {
                        __PLOPS__: numberFormatter.format(plops)
                    }
                );

                this.gameState.addPlops(plops);
                break;
            case 'bottleChain':
                let chainSize               = 6,
                    baseBottlePlopsModifier = 2.0,
                    baseBottlePlops         =
                        Math.max(this.gameState.getAutoPlopsPerSecondWithoutBuffMultiplier(), 10)
                            * baseBottlePlopsModifier * this.buffEffectMultiplier * this.bottleChainPower,

                    completePlops = baseBottlePlops;

                buffText = translator.translate(
                    'buff.bottleChain',
                    {
                        __PLOPS__: numberFormatter.format(baseBottlePlops)
                    }
                );

                this.gameState.addPlops(baseBottlePlops);
                
                const nextChainStep = (function () {
                    this.buffIntervals[buffProgressId] = window.setTimeout(
                        (function () {
                            this.spawnBuffBottle(
                                5,
                                (function (clickEvent, buffBottle, x, y) {
                                    chainSize--;
                                    baseBottlePlops *= baseBottlePlopsModifier;
                                    completePlops   += baseBottlePlops;

                                    this.gameState.addPlops(baseBottlePlops);
                                    buffBottle.remove();

                                    if (chainSize > 0) {
                                        this.flyoutText.spawnFlyoutText(
                                            translator.translate(
                                                'plops.add',
                                                {
                                                    __PLOPS__: numberFormatter.format(baseBottlePlops)
                                                }
                                            ),
                                            clickEvent.clientX || x,
                                            (clickEvent.clientY || y) - 25
                                        );

                                        nextChainStep();
                                    } else {
                                        this.flyoutText.spawnFlyoutText(
                                            translator.translate(
                                                'buff.bottleChainOver',
                                                {
                                                    __PLOPS__: numberFormatter.format(completePlops)
                                                }
                                            ),
                                            clickEvent.clientX || x,
                                            (clickEvent.clientY || y) - 25,
                                        );

                                        delete this.buffIntervals[buffProgressId];
                                    }
                                }).bind(this),
                                (function (buffBottle) {
                                    buffBottle.remove();

                                    this.flyoutText.spawnFlyoutText(
                                        translator.translate(
                                            'buff.bottleChainOver',
                                            {
                                                __PLOPS__: numberFormatter.format(completePlops)
                                            }
                                        ),
                                        clickEvent.clientX || x,
                                        (clickEvent.clientY || y) - 25
                                    );

                                    delete this.buffIntervals[buffProgressId];
                                }).bind(this)
                            );
                        }).bind(this),
                        5000 + Math.random() * 1500
                    );
                }).bind(this);

                nextChainStep();
                break;
            case 'stockMarketLobby':
                const stockMarket     = new Minigames.StockMarket(),
                      stockMarketBuff = 0.019;

                stockMarket.addStockMarketBuff(stockMarketBuff);
                buffText = translator.translate('buff.stockMarket');
                this.buffIntervals[buffProgressId] = window.setTimeout(
                    (function () {
                        stockMarket.removeStockMarketBuff(stockMarketBuff);
                        this._removeBuffProgress(buffProgressId);
                        delete this.buffIntervals[buffProgressId];
                    }).bind(this),
                    lifetime
                );
                this._addBuffProgress(buffProgressId, lifetime, buffText, buff);
                break;
        }

        this.flyoutText.spawnFlyoutText(buffText, clickEvent.clientX || x, (clickEvent.clientY || y) - 25);

        return buff;
    };

    BuffController.prototype._addBuffProgress = function (buffProgressId, lifetime, buffText, type) {
        let start           = new Date(),
            buffProgressBar = Mustache.render(
            TemplateStorage.get('buff-progress-template'),
            {
                id:       buffProgressId,
                buffText: buffText
            }
        );

        $('.buff-progress-container').append(buffProgressBar);

        const progressElement = $('#' + buffProgressId).find('.progress-bar');

        this.progressIntervals[buffProgressId] = {
            type:     type,
            interval: window.setInterval(
                    function () {
                        progressElement.css('width', (100 - ((new Date() - start) / lifetime * 100)) + '%');
                    },
                    100
                )
        };
    };

    BuffController.prototype._removeBuffProgress = function (buffProgressId) {
        window.clearInterval(this.progressIntervals[buffProgressId].interval);
        delete this.progressIntervals[buffProgressId];
        $('#' + buffProgressId).remove();
    };

    BuffController.prototype.getClickedBuffBottles = function () {
        return this.buffBottlesClicked;
    };

    beerplop.BuffController = BuffController;
})(Beerplop);
