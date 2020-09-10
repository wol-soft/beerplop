(function(beerplop) {
    'use strict';

    AchievementStorage.prototype.totalAchievements   = 0;
    AchievementStorage.prototype.reachedAchievements = 0;

    AchievementStorage.prototype.achievements = {};

    /**
     * Initialize the achievement storage
     *
     * @constructor
     */
    function AchievementStorage() {
        this._initAchievements();
        this.totalAchievements = this._countTotalAchievements(this.achievements);

        (new Beerplop.GamePersistor()).registerModule(
            'AchievementStorage',
            (function () {
                return this._minifyDataStructure(this.achievements);
            }.bind(this)),
            (function (loadedData) {
                this.reachedAchievements = 0;
                this.achievements        = $.extend(
                    true,
                    this.achievements,
                    this._extractDataStructure(loadedData)
                );
            }.bind(this))
        );
    }

    AchievementStorage.prototype.getTotalAchievements = function () {
        return this.totalAchievements;
    };

    AchievementStorage.prototype.getReachedAchievements = function () {
        return this.reachedAchievements;
    };

    /**
     * Minify the achievement data structure for storing a game state
     *
     * @param {Object} data
     *
     * @return {Object}
     *
     * @private
     */
    AchievementStorage.prototype._minifyDataStructure = function(data) {
        let resultObject = {};
        $.each(data, (function (key, value) {
            resultObject[key] = typeof value.reached === 'undefined'
                ? this._minifyDataStructure(value)
                : value.reached;
        }).bind(this));

        return resultObject;
    };

    /**
     * Extract the achievement data structure from a minified game state
     *
     * @param {Object} data
     *
     * @return {Object}
     *
     * @private
     */
    AchievementStorage.prototype._extractDataStructure = function(data) {
        let resultObject = {};
        $.each(data, (function (key, value) {
            if (typeof value !== 'boolean') {
                resultObject[key] = this._extractDataStructure(value);
                return;
            }

            resultObject[key] = {
                reached: value
            };

            if (value) {
                this.reachedAchievements++;
            }
        }).bind(this));

        return resultObject;
    };

    /**
     * Count the total amount of achievements
     *
     * @param {Object} data
     *
     * @return {number}
     *
     * @private
     */
    AchievementStorage.prototype._countTotalAchievements = function(data) {
        let achievements = 0;
        $.each(data, (function (key, value) {
            achievements += typeof value.reached === 'undefined'
                ? this._countTotalAchievements(value)
                : 1;
        }).bind(this));

        return achievements;
    };

    /**
     * Initialize the achievement object
     *
     * @private
     */
    AchievementStorage.prototype._initAchievements = function () {
        this.achievements = {
            totalPlopProduction: {
                100: {
                    reached: false,
                },
                1e3: {
                    reached: false,
                },
                1e4: {
                    reached: false,
                },
                1e5: {
                    reached: false,
                },
                1e6: {
                    reached: false,
                },
                1e7: {
                    reached: false,
                },
                1e8: {
                    reached: false,
                },
                1e9: {
                    reached: false,
                },
                1e10: {
                    reached: false,
                },
                1e11: {
                    reached: false,
                },
                1e12: {
                    reached: false,
                },
                1e13: {
                    reached: false,
                },
                1e14: {
                    reached: false,
                },
                1e15: {
                    reached: false,
                },
                1e16: {
                    reached: false,
                },
                1e17: {
                    reached: false,
                },
                1e18: {
                    reached: false,
                },
                1e19: {
                    reached: false,
                },
                1e20: {
                    reached: false,
                },
                1e21: {
                    reached: false,
                },
                1e22: {
                    reached: false,
                },
                1e23: {
                    reached: false,
                },
                1e24: {
                    reached: false,
                },
                1e25: {
                    reached: false,
                },
                1e26: {
                    reached: false,
                },
                1e27: {
                    reached: false,
                },
                1e28: {
                    reached: false,
                },
                1e29: {
                    reached: false,
                },
                1e30: {
                    reached: false,
                },
                1e31: {
                    reached: false,
                },
                1e32: {
                    reached: false,
                },
                1e33: {
                    reached: false,
                },
                1e34: {
                    reached: false,
                },
                1e35: {
                    reached: false,
                },
                1e36: {
                    reached: false,
                },
                1e37: {
                    reached: false,
                },
                1e38: {
                    reached: false,
                },
            },
            plopsPerSecond: {
                1: {
                    reached: false,
                },
                10: {
                    reached: false,
                },
                100: {
                    reached: false,
                },
                1e3: {
                    reached: false,
                },
                1e4: {
                    reached: false,
                },
                1e5: {
                    reached: false,
                },
                1e6: {
                    reached: false,
                },
                1e7: {
                    reached: false,
                },
                1e8: {
                    reached: false,
                },
                1e9: {
                    reached: false,
                },
                1e10: {
                    reached: false,
                },
                1e11: {
                    reached: false,
                },
                1e12: {
                    reached: false,
                },
                1e13: {
                    reached: false,
                },
                1e14: {
                    reached: false,
                },
                1e15: {
                    reached: false,
                },
                1e16: {
                    reached: false,
                },
                1e17: {
                    reached: false,
                },
                1e18: {
                    reached: false,
                },
                1e19: {
                    reached: false,
                },
                1e20: {
                    reached: false,
                },
                1e21: {
                    reached: false,
                },
                1e22: {
                    reached: false,
                },
                1e23: {
                    reached: false,
                },
                1e24: {
                    reached: false,
                },
                1e25: {
                    reached: false,
                },
                1e26: {
                    reached: false,
                },
                1e27: {
                    reached: false,
                },
                1e28: {
                    reached: false,
                },
                1e29: {
                    reached: false,
                },
                1e30: {
                    reached: false,
                },
                1e31: {
                    reached: false,
                },
                1e32: {
                    reached: false,
                },
                1e33: {
                    reached: false,
                },
                1e34: {
                    reached: false,
                },
            },
            manual: {
                production: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    1e3: {
                        reached: false,
                    },
                    1e4: {
                        reached: false,
                    },
                    1e5: {
                        reached: false,
                    },
                    1e6: {
                        reached: false,
                    },
                    1e7: {
                        reached: false,
                    },
                    1e8: {
                        reached: false,
                    },
                    1e9: {
                        reached: false,
                    },
                    1e10: {
                        reached: false,
                    },
                    1e11: {
                        reached: false,
                    },
                    1e12: {
                        reached: false,
                    },
                    1e13: {
                        reached: false,
                    },
                    1e14: {
                        reached: false,
                    },
                    1e15: {
                        reached: false,
                    },
                    1e16: {
                        reached: false,
                    },
                    1e17: {
                        reached: false,
                    },
                },
                clicks: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    1e3: {
                        reached: false,
                    },
                    5e3: {
                        reached: false,
                    },
                    1e4: {
                        reached: false,
                    },
                    2e4: {
                        reached: false,
                    },
                    5e4: {
                        reached: false,
                    },
                    1e5: {
                        reached: false,
                    },
                },
            },
            buildingAmount: {
                opener: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    },
                    600: {
                        reached: false,
                    },
                    650: {
                        reached: false,
                    },
                    700: {
                        reached: false,
                    },
                    750: {
                        reached: false,
                    }
                },
                dispenser: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                        key: 'dispenser-25'
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    },
                    600: {
                        reached: false,
                    },
                    650: {
                        reached: false,
                    },
                    700: {
                        reached: false,
                    },
                    750: {
                        reached: false,
                    }
                },
                serviceAssistant: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    },
                    600: {
                        reached: false,
                    },
                    650: {
                        reached: false,
                    }
                },
                automatedBar: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    },
                    600: {
                        reached: false,
                    },
                    650: {
                        reached: false,
                    }
                },
                deliveryTruck: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    },
                    600: {
                        reached: false,
                    },
                    650: {
                        reached: false,
                    }
                },
                tankerTruck: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    },
                    600: {
                        reached: false,
                    },
                    650: {
                        reached: false,
                    }
                },
                beerPipeline: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    }
                },
                cellarBrewery: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    }
                },
                automatedBrewery: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    }
                },
                pharmaceuticalBeer: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    550: {
                        reached: false,
                    }
                },
                drinkingWaterLine: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    }
                },
                beerTeleporter: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    }
                },
                beerCloner: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    350: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    450: {
                        reached: false,
                    },
                },
            },
            buildingSum: {
                100: {
                    reached: false,
                },
                250: {
                    reached: false,
                },
                500: {
                    reached: false,
                },
                1e3: {
                    reached: false,
                },
                2e3: {
                    reached: false,
                },
                3e3: {
                    reached: false,
                },
                4e3: {
                    reached: false,
                },
                5e3: {
                    reached: false,
                },
                6e3: {
                    reached: false,
                },
                7e3: {
                    reached: false,
                },
                8e3: {
                    reached: false,
                },
                9e3: {
                    reached: false,
                },
                1e4: {
                    reached: false,
                },
            },
            // https://www.thoughtco.com/biggest-dinosaurs-and-prehistoric-reptiles-1091964
            buildingLevel: {
                2: {
                    reached: false,
                },
                3: {
                    reached: false,
                },
                4: {
                    reached: false,
                },
                5: {
                    reached: false,
                },
                6: {
                    reached: false,
                },
                7: {
                    reached: false,
                },
                8: {
                    reached: false,
                },
                9: {
                    reached: false,
                },
                10: {
                    reached: false,
                },
                11: {
                    reached: false,
                },
                12: {
                    reached: false,
                },
                13: {
                    reached: false,
                },
                14: {
                    reached: false,
                },
                15: {
                    reached: false,
                },
                16: {
                    reached: false,
                },
                17: {
                    reached: false,
                },
                18: {
                    reached: false,
                },
                19: {
                    reached: false,
                },
                20: {
                    reached: false,
                },
                21: {
                    reached: false,
                },
                22: {
                    reached: false,
                },
            },
            buildingProduction: {
                opener: {
                    1e12: {
                        reached: false,
                    },
                    1e14: {
                        reached: false,
                    },
                    1e16: {
                        reached: false,
                    },
                    1e18: {
                        reached: false,
                    }
                },
                dispenser: {
                    2e12: {
                        reached: false,
                    },
                    2e14: {
                        reached: false,
                    },
                    2e16: {
                        reached: false,
                    },
                    2e18: {
                        reached: false,
                    }
                },
                serviceAssistant: {
                    5e12: {
                        reached: false,
                    },
                    5e14: {
                        reached: false,
                    },
                    5e16: {
                        reached: false,
                    },
                    5e18: {
                        reached: false,
                    }
                },
                automatedBar: {
                    2e11: {
                        reached: false,
                    },
                    2e13: {
                        reached: false,
                    },
                    2e15: {
                        reached: false,
                    },
                    2e17: {
                        reached: false,
                    }
                },
                deliveryTruck: {
                    5e11: {
                        reached: false,
                    },
                    5e13: {
                        reached: false,
                    },
                    5e15: {
                        reached: false,
                    },
                    5e17: {
                        reached: false,
                    }
                },
                tankerTruck: {
                    7e11: {
                        reached: false,
                    },
                    7e13: {
                        reached: false,
                    },
                    7e15: {
                        reached: false,
                    },
                    7e17: {
                        reached: false,
                    }
                },
                beerPipeline: {
                    1e12: {
                        reached: false,
                    },
                    1e14: {
                        reached: false,
                    },
                    1e16: {
                        reached: false,
                    },
                    1e18: {
                        reached: false,
                    }
                },
                cellarBrewery: {
                    25e11: {
                        reached: false,
                    },
                    25e13: {
                        reached: false,
                    },
                    25e15: {
                        reached: false,
                    },
                    25e17: {
                        reached: false,
                    }
                },
                automatedBrewery: {
                    5e12: {
                        reached: false,
                    },
                    5e14: {
                        reached: false,
                    },
                    5e16: {
                        reached: false,
                    },
                    5e18: {
                        reached: false,
                    }
                },
                pharmaceuticalBeer: {
                    1e13: {
                        reached: false,
                    },
                    1e15: {
                        reached: false,
                    },
                    1e17: {
                        reached: false,
                    },
                    1e19: {
                        reached: false,
                    }
                },
                drinkingWaterLine: {
                    2e13: {
                        reached: false,
                    },
                    2e15: {
                        reached: false,
                    },
                    2e17: {
                        reached: false,
                    },
                    2e19: {
                        reached: false,
                    }
                },
                beerTeleporter: {
                    5e13: {
                        reached: false,
                    },
                    5e15: {
                        reached: false,
                    },
                    5e17: {
                        reached: false,
                    },
                    5e19: {
                        reached: false,
                    }
                },
                beerCloner: {
                    5e14: {
                        reached: false,
                    },
                    5e16: {
                        reached: false,
                    },
                    5e18: {
                        reached: false,
                    },
                    5e20: {
                        reached: false,
                    }
                },
            },
            bottleCap: {
                production: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    1e3: {
                        reached: false,
                    },
                    1e4: {
                        reached: false,
                    },
                    1e5: {
                        reached: false,
                    },
                    1e6: {
                        reached: false,
                    },
                    1e7: {
                        reached: false,
                    },
                    1e8: {
                        reached: false,
                    },
                    1e9: {
                        reached: false,
                    },
                    1e10: {
                        reached: false,
                    },
                    1e11: {
                        reached: false,
                    },
                    1e12: {
                        reached: false,
                    },
                    1e13: {
                        reached: false,
                    },
                    1e14: {
                        reached: false,
                    },
                    1e15: {
                        reached: false,
                    },
                    1e16: {
                        reached: false,
                    },
                    1e17: {
                        reached: false,
                    },
                    1e18: {
                        reached: false,
                    },
                    1e19: {
                        reached: false,
                    },
                    1e20: {
                        reached: false,
                    },
                    1e21: {
                        reached: false,
                    },
                    1e22: {
                        reached: false,
                    },
                    1e23: {
                        reached: false,
                    },
                },
                factories: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    75: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    125: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                    175: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                },
                level: {
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                    5: {
                        reached: false,
                    },
                    6: {
                        reached: false,
                    },
                    7: {
                        reached: false,
                    },
                    8: {
                        reached: false,
                    },
                    9: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    11: {
                        reached: false,
                    },
                    12: {
                        reached: false,
                    },
                    13: {
                        reached: false,
                    },
                    14: {
                        reached: false,
                    },
                    15: {
                        reached: false,
                    },
                    16: {
                        reached: false,
                    },
                    17: {
                        reached: false,
                    },
                    18: {
                        reached: false,
                    },
                    19: {
                        reached: false,
                    },
                    20: {
                        reached: false,
                    },
                    21: {
                        reached: false,
                    },
                    22: {
                        reached: false,
                    },
                    23: {
                        reached: false,
                    },
                    24: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    26: {
                        reached: false,
                    },
                    27: {
                        reached: false,
                    },
                    28: {
                        reached: false,
                    },
                    29: {
                        reached: false,
                    },
                    30: {
                        reached: false,
                    },
                    31: {
                        reached: false,
                    },
                    32: {
                        reached: false,
                    },
                    33: {
                        reached: false,
                    },
                    34: {
                        reached: false,
                    },
                    35: {
                        reached: false,
                    },
                    36: {
                        reached: false,
                    },
                    37: {
                        reached: false,
                    },
                    38: {
                        reached: false,
                    },
                },
                perSecond: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    1e3: {
                        reached: false,
                    },
                    1e4: {
                        reached: false,
                    },
                    1e5: {
                        reached: false,
                    },
                    1e6: {
                        reached: false,
                    },
                    1e7: {
                        reached: false,
                    },
                    1e8: {
                        reached: false,
                    },
                    1e9: {
                        reached: false,
                    },
                    1e10: {
                        reached: false,
                    },
                    1e11: {
                        reached: false,
                    },
                    1e12: {
                        reached: false,
                    },
                    1e13: {
                        reached: false,
                    },
                    1e14: {
                        reached: false,
                    },
                    1e15: {
                        reached: false,
                    },
                    1e16: {
                        reached: false,
                    },
                    1e17: {
                        reached: false,
                    },
                    1e18: {
                        reached: false,
                    },
                }
            },
            buyAmount : {
                upgrades: {
                    2: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    20: {
                        reached: false,
                    },
                    30: {
                        reached: false,
                    },
                    40: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                },
                buildings: {
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    200: {
                        reached: false,
                    },
                    300: {
                        reached: false,
                    },
                    400: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    600: {
                        reached: false,
                    },
                },
            },
            level: {
                1: {
                    reached: false,
                },
                10: {
                    reached: false,
                },
                100: {
                    reached: false,
                },
                1e3: {
                    reached: false,
                },
                1e4: {
                    reached: false,
                },
                1e5: {
                    reached: false,
                },
                1e6: {
                    reached: false,
                },
                1e7: {
                    reached: false,
                },
                1e8: {
                    reached: false,
                },
                1e9: {
                    reached: false,
                },
                1e10: {
                    reached: false,
                },
                1e11: {
                    reached: false,
                },
                1e12: {
                    reached: false,
                },
                1e13: {
                    reached: false,
                },
            },
            abstinence: {
                1e9: {
                    reached: false,
                },
                1e10: {
                    reached: false,
                },
                1e11: {
                    reached: false,
                },
                1e12: {
                    reached: false,
                },
                1e13: {
                    reached: false,
                },
                1e14: {
                    reached: false,
                },
                1e15: {
                    reached: false,
                },
                1e16: {
                    reached: false,
                },
                1e17: {
                    reached: false,
                },
                1e18: {
                    reached: false,
                },
                1e19: {
                    reached: false,
                },
                1e20: {
                    reached: false,
                },
                1e21: {
                    reached: false,
                },
                1e22: {
                    reached: false,
                },
                1e23: {
                    reached: false,
                },
                1e24: {
                    reached: false,
                },
                1e25: {
                    reached: false,
                },
                1e26: {
                    reached: false,
                },
                1e27: {
                    reached: false,
                }
            },
            buff: {
                clicked: {
                    1: {
                        reached: false,
                    },
                    6: {
                        reached: false,
                    },
                    24: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    1000: {
                        reached: false,
                    },
                },
                upgrade: {
                    10: {
                        reached: false,
                    },
                    20: {
                        reached: false,
                    },
                    35: {
                        reached: false,
                    },
                },
            },
            stockMarket: {
                unlocked: {
                    reached: false,
                },
                investment: {
                    1e8: {
                        reached: false,
                    },
                    1e9: {
                        reached: false,
                    },
                    1e10: {
                        reached: false,
                    },
                    1e11: {
                        reached: false,
                    },
                    1e12: {
                        reached: false,
                    },
                    1e13: {
                        reached: false,
                    },
                    1e14: {
                        reached: false,
                    },
                    1e15: {
                        reached: false,
                    },
                },
                row: {
                    positive: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        }
                    },
                    negative: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        }
                    }
                },
                method: {
                    long: {
                        reached: false,
                    },
                    short: {
                        reached: false,
                    }
                },
                balance: {
                    positive: {
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                        1e12: {
                            reached: false,
                        },
                        1e13: {
                            reached: false,
                        },
                        1e14: {
                            reached: false,
                        }
                    },
                    negative: {
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                        1e12: {
                            reached: false,
                        },
                        1e13: {
                            reached: false,
                        },
                        1e14: {
                            reached: false,
                        }
                    }
                },
                holds: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    250: {
                        reached: false,
                    },
                    500: {
                        reached: false,
                    },
                    1000: {
                        reached: false,
                    }
                },
                lever: {
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                    5: {
                        reached: false,
                    }
                }
            },
            beerFactory: {
                unlocked: {
                    beerFactory: {
                        reached: false,
                    },
                    wood: {
                        reached: false,
                    },
                    storage: {
                        reached: false,
                    },
                    transport: {
                        reached: false,
                    },
                    stone: {
                        reached: false,
                    },
                    iron: {
                        reached: false,
                    },
                    lodge: {
                        reached: false,
                    },
                    mine: {
                        reached: false,
                    },
                    queue: {
                        reached: false,
                    },
                    academy: {
                        reached: false,
                    },
                    builder: {
                        reached: false,
                    },
                    tradingPost: {
                        reached: false,
                    },
                    engineer: {
                        reached: false,
                    },
                    backRoom: {
                        reached: false,
                    },
                    crop: {
                        reached: false,
                    },
                    orchard: {
                        reached: false,
                    },
                    greenhouse: {
                        reached: false,
                    },
                    fisherman: {
                        reached: false,
                    },
                    cattle: {
                        reached: false,
                    },
                    restaurant: {
                        reached: false,
                    },
                    charcoal: {
                        reached: false,
                    },
                    mason: {
                        reached: false,
                    },
                    blacksmith: {
                        reached: false,
                    },
                    basePlate: {
                        reached: false,
                    },
                    medallion: {
                        reached: false,
                    },
                    bakery: {
                        reached: false,
                    },
                    grandma: {
                        reached: false,
                    },
                    shed: {
                        reached: false,
                    },
                    smokehouse: {
                        reached: false,
                    },
                    slaughter: {
                        reached: false,
                    },
                    hydrolysis: {
                        reached: false,
                    },
                    fermentation: {
                        reached: false,
                    },
                    degradation: {
                        reached: false,
                    },
                    carbonation: {
                        reached: false,
                    },
                    diastatic: {
                        reached: false,
                    },
                    amylase: {
                        reached: false,
                    },
                },
                factories: {
                    // https://largest.org/nature/forests/
                    wood: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                        30: {
                            reached: false,
                        },
                        40: {
                            reached: false,
                        },
                    },
                    storage: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                        30: {
                            reached: false,
                        },
                    },
                    transport: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                        30: {
                            reached: false,
                        },
                    },
                    stone: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                        30: {
                            reached: false,
                        },
                    },
                    iron: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                        30: {
                            reached: false,
                        },
                    },
                    lodge: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    mine: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    academy: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    builder: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    tradingPost: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    // https://en.wikipedia.org/wiki/Lobbying_in_the_United_States#Key_players
                    backRoom: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    // https://www.inspection.gc.ca/plant-health/grains-and-field-crops/list-of-grains-and-field-crops/eng/1323244558875/1323244642996
                    crop: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    orchard: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    greenhouse: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    fisherman: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    cattle: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    restaurant: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                },
                materials: {
                    // https://en.wikipedia.org/wiki/List_of_woods
                    wood: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                        1e12: {
                            reached: false,
                        },
                    },
                    strongWood: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                    },
                    woodenBeam: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                    },
                    // https://en.wikipedia.org/wiki/List_of_gemstones_by_species
                    stone: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                        1e12: {
                            reached: false,
                        },
                    },
                    granite: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                    },
                    // https://www.thoughtco.com/list-of-alloys-by-base-metal-603716
                    iron: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                    },
                    copper: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                    },
                    // https://goldsilver.com/blog/101-best-gold-quotes-all-time/
                    gold: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                    },
                    // http://www.wiseoldsayings.com/diamond-quotes/
                    diamond: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                    },
                    // https://en.wikipedia.org/wiki/Cave_painting
                    charcoal: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                    },
                    // https://www.castles-of-britain.com/tools.htm
                    tools: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                    },
                    // https://zelda.gamepedia.com/Medallions#List_of_Medallions, https://zelda.gamepedia.com/Magic_Medallion
                    medallion: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                    },
                    // https://en.wikipedia.org/wiki/List_of_types_of_marble
                    marble: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                    },
                    basePlate: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                    },
                    knowledge: {
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                    },
                },
                jobs: {
                    delete: {
                        reached: false,
                    },
                    delete90: {
                        reached: false,
                    },
                    rearrange: {
                        reached: false,
                    },
                    pause: {
                        reached: false,
                    },
                    micro: {
                        rearrange: {
                            reached: false,
                        },
                        pause: {
                            reached: false,
                        },
                    },
                    amount: {
                        1: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        25: {
                            reached: false,
                        },
                        50: {
                            reached: false,
                        },
                        100: {
                            reached: false,
                        },
                        250: {
                            reached: false,
                        },
                        500: {
                            reached: false,
                        },
                    },
                    duration: {
                        10: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                        30: {
                            reached: false,
                        },
                    },
                },
                slots: {
                    constructed: {
                        1: {
                            reached: false,
                        },
                        2: {
                            reached: false,
                        },
                        3: {
                            reached: false,
                        },
                        4: {
                            reached: false,
                        },
                        5: {
                            reached: false,
                        },
                        6: {
                            reached: false,
                        },
                        7: {
                            reached: false,
                        },
                    },
                    onAllBuildings: {
                        reached: false,
                    },
                    rebuild: {
                        reached: false,
                    },
                    removed: {
                        reached: false,
                    },
                    automation: {
                        autoBuyer: {
                            enable: {
                                reached: false,
                            },
                            amount: {
                                100: {
                                    reached: false,
                                },
                                500: {
                                    reached: false,
                                },
                                1e3: {
                                    reached: false,
                                },
                                2500: {
                                    reached: false,
                                },
                                5e3: {
                                    reached: false,
                                },
                                1e4: {
                                    reached: false,
                                },
                            },
                        },
                        autoLevelUp: {
                            enable: {
                                reached: false,
                            },
                            amount: {
                                10: {
                                    reached: false,
                                },
                                25: {
                                    reached: false,
                                },
                                50: {
                                    reached: false,
                                },
                                100: {
                                    reached: false,
                                },
                            },
                        },
                        autoUpgrade: {
                            50: {
                                reached: false,
                            },
                            150: {
                                reached: false,
                            },
                            500: {
                                reached: false,
                            },
                            1000: {
                                reached: false,
                            },
                        },
                    },
                    equipProxy: {
                        reached: false,
                    },
                },
                trade: {
                    naming: {
                        reached: false,
                    },
                    present: {
                        reached: false,
                    },
                    autoMax: {
                        reached: false,
                    },
                },
                // https://en.wikipedia.org/wiki/Category:Ancient_Greek_merchants
                tradingRoutes: {
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                },
                // https://www.ranker.com/list/best-pc-trading-games-steam/ranker-games
                traded: {
                    1e3: {
                        reached: false
                    },
                    1e4: {
                        reached: false
                    },
                    1e5: {
                        reached: false
                    },
                    1e6: {
                        reached: false
                    },
                    1e7: {
                        reached: false
                    },
                    1e8: {
                        reached: false
                    },
                    1e9: {
                        reached: false
                    },
                    1e10: {
                        reached: false
                    },
                },
                uniqueBuild: {
                    unlocked: {
                        giza: {
                            reached: false
                        },
                    },
                    completed: {
                        giza: {
                            reached: false
                        },
                    },
                },
                lobby: {
                    double: {
                        reached: false,
                    },
                    education: {
                        reached: false,
                    },
                    naming: {
                        reached: false,
                    },
                },
            },
            researchProjects: {
                started: {
                    beerOceans: {
                        reached: false,
                    },
                    beerCore: {
                        reached: false,
                    },
                    beerLaser: {
                        reached: false,
                    },
                    beerPark: {
                        reached: false,
                    },
                    beerdedNation: {
                        reached: false,
                    },
                    refillingCaps: {
                        reached: false,
                    },
                    stargazer: {
                        reached: false,
                    },
                    training: {
                        reached: false,
                    },
                    clonedike: {
                        reached: false,
                    },
                },
                completed: {
                    beerOceans: {
                        reached: false,
                    },
                    beerCore: {
                        reached: false,
                    },
                    beerLaser: {
                        reached: false,
                    },
                    beerPark: {
                        reached: false,
                    },
                    beerdedNation: {
                        reached: false,
                    },
                    refillingCaps: {
                        reached: false,
                    },
                    stargazer: {
                        reached: false,
                    },
                    training: {
                        reached: false,
                    },
                    clonedike: {
                        reached: false,
                    },
                },
                stage: {
                    1: {
                        reached: false,
                    },
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                    5: {
                        reached: false,
                    },
                    6: {
                        reached: false,
                    },
                    7: {
                        reached: false,
                    },
                    8: {
                        reached: false,
                    },
                    9: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    11: {
                        reached: false,
                    },
                    12: {
                        reached: false,
                    },
                    13: {
                        reached: false,
                    },
                    14: {
                        reached: false,
                    }
                },
                restart: {
                    reached: false,
                },
                autoRestart: {
                    reached: false,
                },
            },
            beerBank: {
                unlocked: {
                    reached: false,
                },
                invested: {
                    1e24: {
                        reached: false,
                    },
                    1e25: {
                        reached: false,
                    },
                    1e26: {
                        reached: false,
                    },
                    1e27: {
                        reached: false,
                    },
                    1e28: {
                        reached: false,
                    },
                    1e29: {
                        reached: false,
                    },
                    1e30: {
                        reached: false,
                    },
                    1e31: {
                        reached: false,
                    },
                    1e32: {
                        reached: false,
                    },
                    1e33: {
                        reached: false,
                    },
                },
                banker: {
                    amount: {
                        1: {
                            reached: false,
                        },
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        15: {
                            reached: false,
                        },
                        20: {
                            reached: false,
                        },
                    },
                    level: {
                        1: {
                            reached: false,
                        },
                        2: {
                            reached: false,
                        },
                        3: {
                            reached: false,
                        },
                        4: {
                            reached: false,
                        },
                        5: {
                            reached: false,
                        },
                        6: {
                            reached: false,
                        },
                        7: {
                            reached: false,
                        },
                    },
                    totalTrainings: {
                        5: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        25: {
                            reached: false,
                        },
                        50: {
                            reached: false,
                        },
                    },
                    investments: {
                        10: {
                            reached: false,
                        },
                        100: {
                            reached: false,
                        },
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                    },
                    balance: {
                        1e24: {
                            reached: false,
                        },
                        1e25: {
                            reached: false,
                        },
                        1e26: {
                            reached: false,
                        },
                        1e27: {
                            reached: false,
                        },
                        1e28: {
                            reached: false,
                        },
                        1e29: {
                            reached: false,
                        },
                    },
                    special: {
                        unlock: {
                            reached: false,
                        },
                        fullStop: {
                            reached: false,
                        },
                        naming: {
                            reached: false,
                        },
                        cheers: {
                            reached: false,
                        },
                        allSkills: {
                            reached: false,
                        },
                        goodThings: {
                            reached: false,
                        },
                    },
                },
            },
            beerwarts: {
                unlocked: {
                    reached: false,
                },
                magicianSchool: {
                    reached: false,
                },
                level: {
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                },
                skillLevel: {
                    1: {
                        reached: false,
                    },
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                    5: {
                        reached: false,
                    },
                    6: {
                        reached: false,
                    },
                    7: {
                        reached: false,
                    },
                },
                magicians: {
                    1: {
                        reached: false,
                    },
                    5: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    15: {
                        reached: false,
                    },
                    20: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                },
                manaPerSecond: {
                    10: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    1e3: {
                        reached: false,
                    },
                    1e4: {
                        reached: false,
                    },
                    1e5: {
                        reached: false,
                    },
                    1e6: {
                        reached: false,
                    },
                    1e7: {
                        reached: false,
                    },
                    1e8: {
                        reached: false,
                    },
                },
                // Dark souls spells
                magicianManaPerSecond: {
                    10: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    1e3: {
                        reached: false,
                    },
                    1e4: {
                        reached: false,
                    },
                    1e5: {
                        reached: false,
                    },
                    1e6: {
                        reached: false,
                    },
                },
                manaTotal: {
                    100: {
                        reached: false,
                    },
                    1e3: {
                        reached: false,
                    },
                    1e4: {
                        reached: false,
                    },
                    1e5: {
                        reached: false,
                    },
                    1e6: {
                        reached: false,
                    },
                    1e7: {
                        reached: false,
                    },
                    1e8: {
                        reached: false,
                    },
                    1e9: {
                        reached: false,
                    },
                    1e10: {
                        reached: false,
                    },
                    1e11: {
                        reached: false,
                    },
                    1e12: {
                        reached: false,
                    },
                },
                buildingLevel: {
                    1: {
                        reached: false,
                    },
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                    5: {
                        reached: false,
                    },
                    6: {
                        reached: false,
                    },
                    7: {
                        reached: false,
                    },
                    8: {
                        reached: false,
                    },
                    9: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                },
                buildingLevelTotal: {
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    },
                    100: {
                        reached: false,
                    },
                    150: {
                        reached: false,
                    },
                },
                groupTraining: {
                    5: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                },
                // https://gameofthrones.fandom.com/wiki/Magic
                sacrifice: {
                    1: {
                        reached: false,
                    },
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                },
                // https://lotr.fandom.com/wiki/Wizards
                sacrificeEach: {
                    1: {
                        reached: false,
                    },
                    2: {
                        reached: false,
                    },
                    3: {
                        reached: false,
                    },
                    4: {
                        reached: false,
                    },
                },
                special: {
                    naming: {
                        reached: false,
                    },
                    onAllBuildings: {
                        reached: false,
                    },
                    material: {
                        reached: false,
                    },
                    auto: {
                        reached: false,
                    },
                    cancel: {
                        reached: false,
                    },
                    cancelComplete: {
                        reached: false,
                    },
                },
            },
            buildingMG: {
                automatedBar: {
                    enabled: {
                        reached: false,
                    },
                    sell: {
                        reached: false,
                    },
                    move: {
                        reached: false,
                    },
                    gameLevel: {
                        1: {
                            reached: false,
                        },
                        2: {
                            reached: false,
                        },
                        3: {
                            reached: false,
                        },
                        4: {
                            reached: false,
                        },
                        5: {
                            reached: false,
                        },
                        6: {
                            reached: false,
                        },
                        7: {
                            reached: false,
                        },
                        8: {
                            reached: false,
                        },
                        9: {
                            reached: false,
                        },
                    },
                    // https://en.wikipedia.org/wiki/List_of_towns_and_cities_with_100,000_or_more_inhabitants/cityname:_B
                    soldBeer: {
                        1e3: {
                            reached: false,
                        },
                        1e4: {
                            reached: false,
                        },
                        1e5: {
                            reached: false,
                        },
                        1e6: {
                            reached: false,
                        },
                        1e7: {
                            reached: false,
                        },
                        1e8: {
                            reached: false,
                        },
                        1e9: {
                            reached: false,
                        },
                        1e10: {
                            reached: false,
                        },
                        1e11: {
                            reached: false,
                        },
                        1e12: {
                            reached: false,
                        },
                        1e13: {
                            reached: false,
                        },
                        1e14: {
                            reached: false,
                        },
                    },
                    items: {
                        // http://menstoptens.com/home/food-drink/worlds-10-most-historic-bars
                        bar: {
                            5: {
                                reached: false,
                            },
                            10: {
                                reached: false,
                            },
                            15: {
                                reached: false,
                            },
                            20: {
                                reached: false,
                            },
                        },
                        table: {
                            10: {
                                reached: false,
                            },
                            25: {
                                reached: false,
                            },
                            50: {
                                reached: false,
                            },
                            100: {
                                reached: false,
                            },
                        },
                        pipe: {
                            10: {
                                reached: false,
                            },
                            20: {
                                reached: false,
                            },
                            35: {
                                reached: false,
                            },
                            50: {
                                reached: false,
                            },
                        },
                        coolingEngine: {
                            5: {
                                reached: false,
                            },
                            10: {
                                reached: false,
                            },
                            15: {
                                reached: false,
                            },
                            20: {
                                reached: false,
                            },
                        },
                    },
                },
                beerCloner: {
                    enabled: {
                        reached: false,
                    },
                    clonerCloning: {
                        reached: false,
                    },
                    clonings: {
                        1: {
                            reached: false,
                        },
                        10: {
                            reached: false,
                        },
                        25: {
                            reached: false,
                        },
                        50: {
                            reached: false,
                        },
                        100: {
                            reached: false,
                        },
                        250: {
                            reached: false,
                        },
                    },
                    // cloning quotes
                    autoClonings: {
                        1: {
                            reached: false,
                        },
                        25: {
                            reached: false,
                        },
                        50: {
                            reached: false,
                        },
                        100: {
                            reached: false,
                        },
                        250: {
                            reached: false,
                        },
                    },
                    buildingLevel: {
                        1: {
                            reached: false,
                        },
                        2: {
                            reached: false,
                        },
                        3: {
                            reached: false,
                        },
                        4: {
                            reached: false,
                        },
                    },
                    boost: {
                        1: {
                            reached: false,
                        },
                        2: {
                            reached: false,
                        },
                        3: {
                            reached: false,
                        },
                        4: {
                            reached: false,
                        },
                        5: {
                            reached: false,
                        },
                    },
                },
            },
            special: {
                clickBar: {
                    reached: false,
                },
                clickBarComplete: {
                    reached: false,
                },
                theRiskySide: {
                    reached: false,
                },
                frankBottleCollector: {
                    reached: false,
                },
                missedBuffs: {
                    reached: false,
                },
                saveSide: {
                    reached: false,
                },
                schnapps: {
                    reached: false,
                },
                scientist: {
                    reached: false,
                },
                1337: {
                    reached: false,
                },
                443: {
                    reached: false,
                },
                collector: {
                    reached: false,
                },
                magnet: {
                    reached: false,
                },
                noClick: {
                    reached: false,
                },
                automation: {
                    reached: false,
                },
                config: {
                    reached: false,
                },
                doubleConfig: {
                    reached: false,
                },
                beerBlender: {
                    unlocked: {
                        reached: false,
                    },
                    equipped: {
                        1: {
                            reached: false,
                        },
                        2: {
                            reached: false,
                        },
                        3: {
                            reached: false,
                        },
                        4: {
                            reached: false,
                        },
                    },
                    preset: {
                        reached: false,
                    },
                    presetDel: {
                        reached: false,
                    },
                    presetEmpty: {
                        reached: false,
                    },
                },
                sacrificed: {
                    1: {
                        reached: false,
                    },
                    10: {
                        reached: false,
                    },
                    25: {
                        reached: false,
                    },
                    50: {
                        reached: false,
                    }
                }
            }
        };

        this._generateKeys(this.achievements);
    };

    /**
     * Generate generic keys for each achievement
     *
     * @param {Object} data
     * @param {string} generatedKey
     *
     * @private
     */
    AchievementStorage.prototype._generateKeys = function(data, generatedKey = '') {
        $.each(data, (function (key, value) {
            if (typeof value.reached === 'undefined') {
                this._generateKeys(value, (generatedKey !== '' ? generatedKey + '.' : '') + key);
                return;
            }

            data[key].key = generatedKey + '.' + key;
        }).bind(this));
    };

    AchievementStorage.prototype.getAchievementByKey = function (key) {
        let achievement = this.achievements;

        $.each(key.split('.'), function () {
            achievement = achievement[this];
        });

        return achievement;
    };

    beerplop.AchievementStorage = AchievementStorage;
})(Beerplop);
