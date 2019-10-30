(function(minigames) {
    'use strict';

    const BANKER_BASE_PRICE = 1e23;

    BeerBankBanker.prototype.gameEventBus          = null;
    BeerBankBanker.prototype.gameState             = null;
    BeerBankBanker.prototype.beerBank              = null;
    BeerBankBanker.prototype.stockMarket           = null;
    BeerBankBanker.prototype.numberFormatter       = null;
    BeerBankBanker.prototype.achievementController = null;

    BeerBankBanker.prototype._instance = null;

    BeerBankBanker.prototype.isBankerOverlayVisible = false;

    BeerBankBanker.prototype.updateTrainingButtonsForBanker = null;

    BeerBankBanker.prototype.trainingShortener = 1;

    BeerBankBanker.prototype.enabled = false;

    BeerBankBanker.prototype.state = {
        totalBalance:      0,
        totalInvestments:  0,
        openInvestments:   0,
        currentInvestment: 0,
        investmentStop:    false,
        banker:            [],
    };

    /**
     * Initialize the beer bank banker module
     *
     * @constructor
     */
    function BeerBankBanker(gameState, gameEventBus, beerBank) {
        if (BeerBankBanker.prototype._instance) {
            return BeerBankBanker.prototype._instance;
        }

        BeerBankBanker.prototype._instance = this;

        this.gameState       = gameState;
        this.gameEventBus    = gameEventBus;
        this.beerBank        = beerBank;
        this.numberFormatter = new Beerplop.NumberFormatter();

        const initialState = $.extend(true, {}, this.state);

        (new Beerplop.GamePersistor()).registerModule(
            'BeerBankBanker',
            (function () {
                return this.state;
            }.bind(this)),
            (function (loadedData) {
                this.state = $.extend(true, {}, initialState, loadedData);

                $.each(this.state.banker, (function (bankerId, banker) {
                    if (banker.trainingFinished) {
                        banker.trainingFinished = new Date(banker.trainingFinished);
                    }
                }).bind(this));

                this._updateBeerBankBankerView();
            }.bind(this))
        );
    }

    BeerBankBanker.prototype.unlockBanker = function () {
        if (this.enabled) {
            return;
        }

        this.enabled = true;

        $('#beer-bank__banker-container').removeClass('d-none');

        this.gameEventBus.on(EVENTS.CORE.ITERATION, (function () {
            const now = new Date();

            let currentBalance = 0;

            $.each(this.state.banker, (function coreIterationUpdateBankerInvestments(bankerId, banker) {
                (banker.investment !== null)
                    ? this._checkInvestmentClose(banker, bankerId)
                    : this._checkNewInvestment(banker, bankerId);

                if (banker.investment === null) {
                    return;
                }

                const bankerBalance = this._getInvestmentBalance(banker.investment);
                currentBalance += bankerBalance;

                if (this.isBankerOverlayVisible) {
                    const row = $('#beer-bank-banker__banker-row__id-' + bankerId);
                    this.stockMarket.writeBalance(
                        row.find('.beer-bank-banker__banker__investment-balance'),
                        bankerBalance
                    );

                    row.find('.beer-bank-banker__banker__age')
                        .text(this.numberFormatter.formatTimeSpan(now - new Date(banker.birth)));
                }
            }).bind(this));

            this.stockMarket.writeBalance($('#beer-bank__banker__current-balance'), currentBalance);

            $.each(this.state.banker, (function (index, banker) {
                if (banker.inTraining) {
                    if (banker.trainingFinished < now) {
                        if (this.updateTrainingButtonsForBanker == index) {
                            $('.training-hint').addClass('d-none');
                        }

                        this.state.banker[index].inTraining       = false;
                        this.state.banker[index].trainingFinished = null;

                        (new Beerplop.Notification()).notify({
                            content: translator.translate(
                                'beerBankBanker.message.trainingFinished',
                                {
                                    __NAME__:  `<i>${this.state.banker[index].name}</i>`,
                                }
                            ),
                            style: 'snackbar-success',
                            timeout: 5000,
                            channel: 'beerBank',
                        });
                    }
                }
            }).bind(this));

            if (this.updateTrainingButtonsForBanker) {
                this._updateTrainingButtons();

                if (this.state.banker[this.updateTrainingButtonsForBanker].inTraining) {
                    $('#beer-bank-banker__remaining-training-time').text(
                        this.numberFormatter.formatTimeSpan(
                            this.state.banker[this.updateTrainingButtonsForBanker].trainingFinished - now,
                            true
                        )
                    );
                }
            }
        }).bind(this));

        // check if there are enough plops available to hire another banker
        this.gameEventBus.on(EVENTS.CORE.PLOPS.UPDATED, (function (event, amount) {
            $('#beer-bank__hire-banker').closest('fieldset').prop('disabled', amount < this._getCostsForNextBanker());
        }).bind(this));

        $('#beer-bank__hire-banker').on('click', this._hireBanker.bind(this));
        this._updateBeerBankBankerView();

        $('#beer-bank__close-banker').on('click', (function () {
            this.state.investmentStop = true;
            this._updateBeerBankBankerView();

            let closedInvestments = 0;
            $.each(this.state.banker, (function (bankerId, banker) {
                if (this._closeInvestment(banker, bankerId)) {
                    closedInvestments++;
                }
            }).bind(this));

            if (closedInvestments >= 5) {
                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerBank.banker.special.fullStop
                );
            }
        }).bind(this));

        $('#beer-bank__open-banker').on('click', (function () {
            this.state.investmentStop = false;
            this._updateBeerBankBankerView();
        }).bind(this));

        (new Beerplop.OverlayController()).addCallback(
            'beer-bank-banker',
            this._renderBankerOverview.bind(this),
            () => {
                this.isBankerOverlayVisible = false;
                $('#beer-bank-banker__overlay').html('');
            },
        );

        this.achievementController.checkAchievement(
            this.achievementController.getAchievementStorage().achievements.beerBank.banker.special.unlock
        );
    };

    BeerBankBanker.prototype._hireBanker = function () {
        if (!this.gameState.removePlops(this._getCostsForNextBanker())) {
            return;
        }

        this.state.banker.push({
            // basic values
            birth:             new Date(),
            investment:        null,
            acceptableRange:   0.4,
            tendencyAwareness: 0.04,
            investmentLimit:   1e26,
            maxLever:          2,
            name:              chance.name({ middle: true }),
            // statistical values
            totalInvestments:  0,
            balance:           0,
            cheered:           false,
            // training values
            inTraining:        false,
            trainingFinished:  null,
            level:             0,
            training: {
                appreciation: 0,
                prognosis:    0,
                leadership:   0,
                lever:        0,
            }
        });

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerBank.banker.amount,
            this.state.banker.length
        );

        this._updateBeerBankBankerView();
    };

    BeerBankBanker.prototype._getCostsForNextBanker = function () {
        return Math.ceil(BANKER_BASE_PRICE * Math.pow(3, this.state.banker.length || 0));
    };

    BeerBankBanker.prototype._checkNewInvestment = function (banker, bankerId) {
        if (banker.investment !== null || this.state.investmentStop || banker.inTraining) {
            return;
        }

        const stocks = this.stockMarket.getStocks();
        $.each(
            Object.keys(stocks).sort(function orderStocksByTendency(a, b) {
                return Math.abs(stocks[a].tendency) > Math.abs(stocks[b].tendency);
            }),
            (function checkStocksForNewInvestment(index, key) {
                const stockData = stocks[key];
                if (!stockData.enabled) {
                    return;
                }

                const stockAcceptableRange = (stockData.maxValue - stockData.minValue) * banker.acceptableRange;

                // check if a "high" investment is possible
                if (stockData.value < stockData.minValue + stockAcceptableRange &&
                    stockData.tendency > banker.tendencyAwareness
                ) {
                    this._invest(banker, bankerId, 'long', key, stockData);
                    return false;
                }

                // check if a "low" investment is possible
                if (stockData.value > stockData.maxValue - stockAcceptableRange &&
                    stockData.tendency < -banker.tendencyAwareness
                ) {
                    this._invest(banker, bankerId, 'short', key, stockData);
                    return false;
                }
            }).bind(this)
        );
    };

    BeerBankBanker.prototype._invest = function (banker, bankerId, method, stock, stockData) {
        // invest between 60% and 100% of the investment limit
        const possibleInvestment = banker.investmentLimit * (Math.random() * 0.4 + 0.6),
              amount             = Math.floor(possibleInvestment / stockData.value),
              investment         = amount * stockData.value;

        if (!this.beerBank.removePlops(investment)) {
            return;
        }

        banker.investment = {
            stock:      stock,
            startValue: stockData.value,
            amount:     amount,
            investment: investment,
            method:     method,
            lever:      Math.floor(Math.random() * banker.maxLever) + 1,
            // define the goal of the investment (between 1% and 11% win)
            goal:       stockData.value + stockData.value * ((Math.random() * 0.1 + 0.01)* (method === 'long' ? 1 : -1)),
            // define at which value the investment is closed (between 10% and 30% loss)
            close:      stockData.value + stockData.value * ((Math.random() * 0.2 + 0.1)* (method === 'long' ? -1 : 1))
        };

        banker.totalInvestments++;
        this.state.totalInvestments++;
        this.state.openInvestments++;
        this.state.currentInvestment = this._getCurrentInvestment();

        if (this.isBankerOverlayVisible) {
            const row = $('#beer-bank-banker__banker-row__id-' + bankerId);

            row.find('.beer-bank-banker__banker__investment-stock').text(translator.translate('stockMarket.' + stock));
            row.find('.beer-bank-banker__banker__investment').text(this.numberFormatter.format(investment));
            this.stockMarket.writeBalance(row.find('.beer-bank-banker__banker__investment-balance'), 0);
            row.find('.beer-bank-banker__banker__total-investments').text(this.numberFormatter.formatInt(banker.totalInvestments));

            row.find('.beer-bank-banker__banker-current-investment')
                .toggleClass('d-none');
        }

        this._updateBeerBankBankerView();

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerBank.banker.investments,
            this.state.totalInvestments
        );
    };

    BeerBankBanker.prototype._checkInvestmentClose = function (banker, bankerId) {
        if (banker.investment === null) {
            return;
        }

        const stock      = this.stockMarket.getStock(banker.investment.stock),
              investment = banker.investment;

        if ((investment.method === 'long' && (stock.value < investment.close || stock.value > investment.goal)) ||
            (investment.method === 'short' && (stock.value > investment.close || stock.value < investment.goal))
        ){
            this._closeInvestment(banker, bankerId);
        }
    };

    BeerBankBanker.prototype._closeInvestment = function (banker, bankerId) {
        if (banker.investment === null) {
            return false;
        }

        let investmentBalance = this._getInvestmentBalance(banker.investment);
        if (banker.cheered) {
            banker.cheered     = false;
            investmentBalance *= 1.1;
        }

        this.beerBank.addPlops(banker.investment.startValue * banker.investment.amount + investmentBalance);
        this.state.totalBalance += investmentBalance;
        this.state.openInvestments--;

        banker.balance   += investmentBalance;
        banker.investment = null;

        this.state.currentInvestment = this._getCurrentInvestment();
        this._updateBeerBankBankerView();

        if (this.isBankerOverlayVisible) {
            const row = $('#beer-bank-banker__banker-row__id-' + bankerId);

            row.find('.beer-bank-banker__banker-current-investment').toggleClass('d-none');
            this.stockMarket.writeBalance(row.find('.beer-bank-banker__banker__balance'), banker.balance);
        }

        this.achievementController.checkAmountAchievement(
            this.achievementController.getAchievementStorage().achievements.beerBank.banker.balance,
            this.state.totalBalance
        );

        return true;
    };

    BeerBankBanker.prototype._getCurrentInvestment = function () {
        let investment = 0;
        $.each(this.state.banker, function () {
            investment += this.investment === null ? 0 : this.investment.investment;
        });
        return investment;
    };

    BeerBankBanker.prototype._getInvestmentBalance = function (investment) {
        const stock = this.stockMarket.getStock(investment.stock);

        return (investment.method === 'long'
                ? (stock.value - investment.startValue)
                : (investment.startValue - stock.value)
        ) * investment.amount * investment.lever;
    };

    BeerBankBanker.prototype._updateBeerBankBankerView = function () {
        if (this.state.investmentStop) {
            $('#beer-bank__close-banker').addClass('d-none');
            $('#beer-bank__open-banker').removeClass('d-none');
        } else {
            $('#beer-bank__close-banker').removeClass('d-none');
            $('#beer-bank__open-banker').addClass('d-none');
        }

        $('#beer-bank__banker').text(this.state.banker.length || 0);
        $('#beer-bank__cost-next-banker').text(this.numberFormatter.format(this._getCostsForNextBanker()));

        $('#beer-bank__banker__investments').text(this.numberFormatter.formatInt(this.state.totalInvestments));
        $('#beer-bank__banker__open-investments').text(this.numberFormatter.formatInt(this.state.openInvestments));
        $('#beer-bank__banker__current-investment').text(this.numberFormatter.format(this.state.currentInvestment));
        $('#beer-bank__banker__balance').text(this.numberFormatter.format(this.state.totalBalance));
    };

    BeerBankBanker.prototype._renderBankerOverview = function () {
        const now = new Date();

        this.isBankerOverlayVisible = true;

        $('#beer-bank-banker__overlay').html(
            Mustache.render(
                TemplateStorage.get('beer-bank-banker__overlay-template'),
                {
                    amount: this.state.banker.length,
                    banker: this.state.banker.map((function mapBankerData(banker, bankerId) {
                        let data = {
                            totalInvestments:     banker.totalInvestments,
                            balance:              this.numberFormatter.format(banker.balance),
                            balanceClass:         this.numberFormatter.getBalanceClass(banker.balance),
                            id:                   bankerId,
                            name:                 banker.name,
                            age:                  this.numberFormatter.formatTimeSpan(now - new Date(banker.birth)),
                            level:                this.numberFormatter.romanize(banker.level),
                            hasCurrentInvestment: banker.investment !== null,
                        };

                        if (banker.investment !== null) {
                            const investmentBalance = this._getInvestmentBalance(banker.investment);

                            data.investmentName         = translator.translate('stockMarket.' + banker.investment.stock);
                            data.investment             = this.numberFormatter.format(banker.investment.investment);
                            data.investmentBalance      = this.numberFormatter.format(investmentBalance);
                            data.investmentBalanceClass = this.numberFormatter.getBalanceClass(investmentBalance);
                        }

                        return data;
                    }).bind(this)),
                    ucfirst: function () {
                        return function (text, render) {
                            const renderedText = render(text);
                            return renderedText.charAt(0).toUpperCase() + renderedText.slice(1);
                        }
                    }
                }
            )
        );

        new Beerplop.ObjectNaming(
            $('.beer-bank-banker__banker-name'),
            (bankerId, name) => this.state.banker[bankerId].name = name,
            'beerBank.banker.special.naming'
        );

        this._initBeerBankBankerTraining();

        $('.beer-bank-banker__cheer-banker').on('click', (function (event) {
            this.state.banker[$(event.target).data('bankerId')].cheered = true;
            (new Beerplop.FlyoutText()).spawnFlyoutText(
                translator.translate('beerBankBanker.cheers'),
                event.clientX,
                event.clientY - 25
            );

            this.achievementController.checkAchievement(
                this.achievementController.getAchievementStorage().achievements.beerBank.banker.special.cheers
            );
        }).bind(this));
    };

    BeerBankBanker.prototype._initBeerBankBankerTraining = function () {
        $('.beer-bank-banker__start-training').on('click', (function (event) {
            const bankerId = $(event.target).data('bankerId'),
                  banker   = this.state.banker[bankerId];

            $('#beer-bank-banker__training-modal__body').html(
                Mustache.render(
                    TemplateStorage.get('beer-bank-banker__training-modal__body-template'),
                    {
                        id:           bankerId,
                        name:         `<i>${banker.name.replace(/"/g, '\\"')}</i>`,
                        level:        `<b id='beer-bank-banker__training-modal__level'>${this.numberFormatter.romanize(banker.level)}</b>`,
                        inTraining:   banker.inTraining,
                        trainingTime: this.numberFormatter.formatTimeSpan(banker.trainingFinished - new Date(), true),
                        trainings: [
                            {
                                title: translator.translate('beerBankBanker.training.appreciation.title'),
                                description: translator.translate('beerBankBanker.training.appreciation.description'),
                                key: 'appreciation',
                                level: this.numberFormatter.romanize(this.state.banker[bankerId].training.appreciation),
                                cost: this.numberFormatter.format(this._getTrainingCost(bankerId, 'appreciation')),
                            },
                            {
                                title: translator.translate('beerBankBanker.training.prognosis.title'),
                                description: translator.translate('beerBankBanker.training.prognosis.description'),
                                key: 'prognosis',
                                level: this.numberFormatter.romanize(this.state.banker[bankerId].training.prognosis),
                                cost: this.numberFormatter.format(this._getTrainingCost(bankerId, 'prognosis')),
                            },
                            {
                                title: translator.translate('beerBankBanker.training.leadership.title'),
                                description: translator.translate('beerBankBanker.training.leadership.description'),
                                key: 'leadership',
                                level: this.numberFormatter.romanize(this.state.banker[bankerId].training.leadership),
                                cost: this.numberFormatter.format(this._getTrainingCost(bankerId, 'leadership')),
                            },
                            {
                                title: translator.translate('beerBankBanker.training.lever.title'),
                                description: translator.translate('beerBankBanker.training.lever.description'),
                                key: 'lever',
                                level: this.numberFormatter.romanize(this.state.banker[bankerId].training.lever),
                                cost: this.numberFormatter.format(this._getTrainingCost(bankerId, 'lever')),
                            },
                        ]
                    }
                )
            );

            this.updateTrainingButtonsForBanker = bankerId;
            const modal = $('#beer-bank-banker__training-modal');
            modal.modal('show');
            modal.on('hidden.bs.modal', (function () {
                this.updateTrainingButtonsForBanker = null;
            }).bind(this));

            this._updateTrainingButtons();
            this._initTrainingButtons();
        }).bind(this));
    };

    BeerBankBanker.prototype._updateTrainingButtons = function () {
        $.each($('.beer-bank-banker__train'), (function updateTrainingButtons(index, element) {
            element = $(element);
            element.closest('fieldset').prop(
                'disabled',
                this.gameState.getPlops() < this._getTrainingCost(
                    this.updateTrainingButtonsForBanker,
                    element.data('training')
                ) || this.state.banker[this.updateTrainingButtonsForBanker].inTraining
            );
        }).bind(this));
    };

    BeerBankBanker.prototype._initTrainingButtons = function () {
        $('.beer-bank-banker__train').on('click', (function trainBanker(event) {
            const element  = $(event.target),
                  training = element.data('training');

            let banker = this.state.banker[this.updateTrainingButtonsForBanker];

            if (banker.inTraining ||
                !this.gameState.removePlops(
                    this._getTrainingCost(this.updateTrainingButtonsForBanker, training)
                 )
            ) {
                return;
            }

            let trainingFinished = new Date();
            trainingFinished.setSeconds(
                trainingFinished.getSeconds() + this._getTrainingDuration(this.updateTrainingButtonsForBanker, training)
            );

            banker.inTraining       = true;
            banker.trainingFinished = trainingFinished;

            this._closeInvestment(banker, this.updateTrainingButtonsForBanker);
            banker.level++;
            banker.training[training]++;

            switch (training) {
                case 'appreciation':
                    banker.tendencyAwareness += 0.01;
                    break;
                case 'prognosis':
                    if (banker.acceptableRange > 0.1) {
                        banker.acceptableRange -= 0.03
                    }
                    break;
                case 'leadership':
                    banker.investmentLimit *= 2;
                    break;
                case 'lever':
                    banker.lever++;
                    break;
            }

            $('.training-hint').removeClass('d-none');
            $('#beer-bank-banker__remaining-training-time').text(
                this.numberFormatter.formatTimeSpan(trainingFinished - new Date(), true)
            );

            $('.beer-bank-banker__training-modal__level__' + training).text(
                this.numberFormatter.romanize(banker.training[training])
            );
            this._updateTrainingButtons();

            $.each($('.beer-bank-banker__training-modal__cost'), (function (index, element) {
                $(element).text(
                    this.numberFormatter.format(
                        this._getTrainingCost(this.updateTrainingButtonsForBanker, $(element).data('training'))
                    )
                );
            }).bind(this));

            $('#beer-bank-banker__banker-row__id-' + this.updateTrainingButtonsForBanker)
                .find('.beer-bank-banker__banker-level')
                .text(this.numberFormatter.romanize(banker.level));
            $('#beer-bank-banker__training-modal__level')
                .text(this.numberFormatter.romanize(banker.level));


            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerBank.banker.level,
                banker.level
            );

            this.achievementController.checkAmountAchievement(
                this.achievementController.getAchievementStorage().achievements.beerBank.banker.totalTrainings,
                this._getTotalTrainings()
            );

            let hasAllSkills = true;
            $.each(banker.training, function () {
                hasAllSkills = hasAllSkills && this > 0;
            });
            if (hasAllSkills) {
                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerBank.banker.special.allSkills
                );
            }

            if (trainingFinished - new Date() > 3600) {
                this.achievementController.checkAchievement(
                    this.achievementController.getAchievementStorage().achievements.beerBank.banker.special.goodThings
                );
            }
        }).bind(this));
    };

    /**
     * Get the duration for a training session in seconds
     *
     * @param {int}    bankerId The ID of the banker who should train
     * @param {string} training The skill which should be trained
     *
     * @returns {number}
     *
     * @private
     */
    BeerBankBanker.prototype._getTrainingDuration = function (bankerId, training) {
        const baseTrainingTimeMap = {
            'appreciation': 300,
            'prognosis':    400,
            'leadership':   1000,
            'lever':        750,
        };

        return Math.floor(
            baseTrainingTimeMap[training]
            * Math.pow(2, this.state.banker[bankerId].training[training] * 0.8)
            * Math.pow(1.25, this.state.banker[bankerId].level)
            * this.trainingShortener
        );
    };

    /**
     * Get the costs for a training session (plops)
     *
     * @param {int}    bankerId The ID of the banker who should train
     * @param {string} training The skill which should be trained
     *
     * @returns {number}
     *
     * @private
     */
    BeerBankBanker.prototype._getTrainingCost = function (bankerId, training) {
        const baseCostMap = {
            'appreciation': 1e23,
            'prognosis':    2e23,
            'leadership':   7e23,
            'lever':        5e23,
        };

        return baseCostMap[training]
            * Math.pow(5.5, this.state.banker[bankerId].training[training])
            * Math.pow(2.5, this.state.banker[bankerId].level)
            * Math.pow(1.08, this._getTotalTrainings());
    };

    BeerBankBanker.prototype._getTotalTrainings = function () {
        let trainings = 0;

        $.each(this.state.banker, function () {
            trainings += this.level;
        });

        return trainings;
    };

    BeerBankBanker.prototype.setAchievementController = function (achievementController) {
        this.achievementController = achievementController;
        return this;
    };

    BeerBankBanker.prototype.setStockMarket = function (stockMarket) {
        this.stockMarket = stockMarket;
        return this;
    };

    BeerBankBanker.prototype.addTrainingShortener = function (shortener) {
        this.trainingShortener *= 1 - shortener;
    };

    minigames.BeerBankBanker = BeerBankBanker;
})(Minigames);
