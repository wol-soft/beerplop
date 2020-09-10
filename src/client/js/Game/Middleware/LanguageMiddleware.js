(function(beerplop) {
    'use strict';

    /**
     * Process the language file to expand duplicated entries and to resolve macros
     *
     * @constructor
     */
    function LanguageMiddleware(language) {
        return this._resolveMacros(
            this._expandMinigameUpgradeTranslations(
                this._expandUpgradeTranslations(
                    this._expandAchievementTranslations(language)
                )
            )
        );
    }

    LanguageMiddleware.prototype._resolveMacros = function (language) {
        const numberFormatter = new Beerplop.NumberFormatter(),
              getNumber       = value => Number(eval(value.replace(/[^-()\d/*+.e]/g, ''))),
              macros          = {
                  NF:  value => numberFormatter.format(getNumber(value)),
                  NFR: value => numberFormatter.romanize(getNumber(value)),
                  NFI: value => numberFormatter.formatInt(getNumber(value)),
                  NFW: value => {
                      value = getNumber(value);

                      return value <= 12
                          ? translator.translate('numbers.' + value)
                          : numberFormatter.formatInt(value);
                  },
                  PluralLabel: value => {
                      const [languageKey, amount] = value.split(',');
                      return translator.translate(languageKey, null, '', getNumber(amount));
                  }
              },
              macroRegExp     = new RegExp(`__(${Object.keys(macros).join('|')})\\[(.*?)]`, 'g');

        $.each(language, function (key, value) {
            language[key] = value.replace(macroRegExp, (match, macro, value) => macros[macro](value));
        });

        return language;
    };

    LanguageMiddleware.prototype._expandUpgradeTranslations = function (language) {
        const upgradeStorage = (new Beerplop.UpgradeController()).getUpgradeStorage(),
              keysToExpand   = {
                  'upgrade.achievementUpgrades.effect': ['achievementUpgrades'],
                  'upgrade.beerLaser.effect':           ['beerLaser1', 'beerLaser2', 'beerLaser3', 'beerLaser4'],
                  'upgrade.autoPlopRate.effect.1':      ['autoPlopUpgrades'],
                  'upgrade.autoPlopRate.effect.2':      ['totalPlopUpgrades', 'buffBottleUpgrades'],
                  'upgrade.autoPlopRate.effect.10':     ['minimumBuildingUpgrades'],
                  'upgrade.bottleCapRate.15':           ['bottleCapFactoryUpgrades'],
              };

        $.each(keysToExpand, function (upgradeGroupLanguageKey, expandToUpgradeGroupList) {
            $.each(expandToUpgradeGroupList, function (index, expandToUpgradeGroup) {
                $.each(upgradeStorage.upgrades[expandToUpgradeGroup], function (upgradeKey) {
                    language[`upgrade.${expandToUpgradeGroup}.${upgradeKey}.effect`] = language[upgradeGroupLanguageKey];
                });
            });
        });

        return language;
    };

    LanguageMiddleware.prototype._expandMinigameUpgradeTranslations = function (language) {
        const beerFactoryUpgrades = (new Minigames.BeerFactory()).upgrade.upgradePath,
              automatedBar        = (new BuildingMinigames.AutomatedBar()).upgradeStorage.upgrades,
              keysToExpand        = {
                  'beerFactory.upgrade.wood.double': beerFactoryUpgrades.wood.double,
                  'beerFactory.upgrade.stone.double': beerFactoryUpgrades.stone.double,
                  'beerFactory.upgrade.storage.double': beerFactoryUpgrades.storage.double,
                  'beerFactory.upgrade.transport.double': beerFactoryUpgrades.transport.double,
                  'beerFactory.upgrade.iron.double': beerFactoryUpgrades.iron.double,
                  'beerFactory.upgrade.lodge.comfort': beerFactoryUpgrades.lodge.comfort,
                  'beerFactory.upgrade.mine.double': beerFactoryUpgrades.mine.double,
                  'beerFactory.upgrade.builder.double': beerFactoryUpgrades.builder.double,
                  'beerFactory.upgrade.tradingPost.double': beerFactoryUpgrades.tradingPost.double,
                  'beerFactory.upgrade.tradingPost.routes': beerFactoryUpgrades.tradingPost.routes,
                  'beerFactory.upgrade.academy.double': beerFactoryUpgrades.academy.double,
                  'beerFactory.upgrade.academy.explore': beerFactoryUpgrades.academy.explore,
                  'beerFactory.upgrade.engineer.calculation': beerFactoryUpgrades.engineer.calculation,
                  'beerFactory.upgrade.engineer.construction': beerFactoryUpgrades.engineer.construction,
                  'beerFactory.upgrade.backRoom.lobbyist': beerFactoryUpgrades.backRoom.lobbyist,
                  'beerFactory.upgrade.backRoom.influence': beerFactoryUpgrades.backRoom.influence,
                  'automatedBar.upgrade.level.capacity': automatedBar.level.capacity,
                  'automatedBar.upgrade.level.price': automatedBar.level.price,
                  'automatedBar.upgrade.level.bar': automatedBar.level.bar,
                  'automatedBar.upgrade.level.table': automatedBar.level.table,
                  'automatedBar.upgrade.level.pipe': automatedBar.level.pipe,
              };

        $.each(keysToExpand, function (upgradeGroupLanguageKey, expandToUpgradeList) {
            $.each(expandToUpgradeList, function (upgradeKey) {
                const key = `${upgradeGroupLanguageKey}.${upgradeKey}.effect`;

                if (language[key]) {
                    return;
                }

                if (!language[upgradeGroupLanguageKey]) {
                    (new Beerplop.ErrorReporter()).reportError(
                        'DEBUG',
                        'LanguageMiddleware expandUpgrades',
                        upgradeGroupLanguageKey
                    );

                    return;
                }

                language[key] = language[upgradeGroupLanguageKey].replace(/__KEY__/g, upgradeKey);
            });

            delete language[upgradeGroupLanguageKey];
        });

        return language;
    };

    LanguageMiddleware.prototype._expandAchievementTranslations = function (language) {
        const achievements = (new Beerplop.AchievementController()).getAchievementStorage().achievements,
              keysToExpand = {
                  'achievements.buildingAmount.opener': achievements.buildingAmount.opener,
                  'achievements.buildingAmount.dispenser': achievements.buildingAmount.dispenser,
                  'achievements.buildingAmount.serviceAssistant': achievements.buildingAmount.serviceAssistant,
                  'achievements.buildingAmount.automatedBar': achievements.buildingAmount.automatedBar,
                  'achievements.buildingAmount.deliveryTruck': achievements.buildingAmount.deliveryTruck,
                  'achievements.buildingAmount.tankerTruck': achievements.buildingAmount.tankerTruck,
                  'achievements.buildingAmount.beerPipeline': achievements.buildingAmount.beerPipeline,
                  'achievements.buildingAmount.cellarBrewery': achievements.buildingAmount.cellarBrewery,
                  'achievements.buildingAmount.automatedBrewery': achievements.buildingAmount.automatedBrewery,
                  'achievements.buildingAmount.pharmaceuticalBeer': achievements.buildingAmount.pharmaceuticalBeer,
                  'achievements.buildingAmount.drinkingWaterLine': achievements.buildingAmount.drinkingWaterLine,
                  'achievements.buildingAmount.beerTeleporter': achievements.buildingAmount.beerTeleporter,
                  'achievements.buildingAmount.beerCloner': achievements.buildingAmount.beerCloner,
                  'achievements.buildingLevel': achievements.buildingLevel,
                  'achievements.buildingProduction.opener': achievements.buildingProduction.opener,
                  'achievements.buildingProduction.dispenser': achievements.buildingProduction.dispenser,
                  'achievements.buildingProduction.serviceAssistant': achievements.buildingProduction.serviceAssistant,
                  'achievements.buildingProduction.automatedBar': achievements.buildingProduction.automatedBar,
                  'achievements.buildingProduction.deliveryTruck': achievements.buildingProduction.deliveryTruck,
                  'achievements.buildingProduction.tankerTruck': achievements.buildingProduction.tankerTruck,
                  'achievements.buildingProduction.beerPipeline': achievements.buildingProduction.beerPipeline,
                  'achievements.buildingProduction.cellarBrewery': achievements.buildingProduction.cellarBrewery,
                  'achievements.buildingProduction.automatedBrewery': achievements.buildingProduction.automatedBrewery,
                  'achievements.buildingProduction.pharmaceuticalBeer': achievements.buildingProduction.pharmaceuticalBeer,
                  'achievements.buildingProduction.drinkingWaterLine': achievements.buildingProduction.drinkingWaterLine,
                  'achievements.buildingProduction.beerTeleporter': achievements.buildingProduction.beerTeleporter,
                  'achievements.buildingProduction.beerCloner': achievements.buildingProduction.beerCloner,
                  'achievements.buildingSum': achievements.buildingSum,
                  'achievements.manual.production': achievements.manual.production,
                  'achievements.manual.clicks': achievements.manual.clicks,
                  'achievements.bottleCap.production': achievements.bottleCap.production,
                  'achievements.bottleCap.factories': achievements.bottleCap.factories,
                  'achievements.bottleCap.level': achievements.bottleCap.level,
                  'achievements.bottleCap.perSecond': achievements.bottleCap.perSecond,
                  'achievements.buff.clicked': achievements.buff.clicked,
                  'achievements.buff.upgrade': achievements.buff.upgrade,
                  'achievements.totalPlopProduction': achievements.totalPlopProduction,
                  'achievements.plopsPerSecond': achievements.plopsPerSecond,
                  'achievements.level': achievements.level,
                  'achievements.beerBank.invested': achievements.beerBank.invested,
                  'achievements.beerBank.banker.amount': achievements.beerBank.banker.amount,
                  'achievements.beerBank.banker.level': achievements.beerBank.banker.level,
                  'achievements.beerBank.banker.totalTrainings': achievements.beerBank.banker.totalTrainings,
                  'achievements.beerBank.banker.investments': achievements.beerBank.banker.investments,
                  'achievements.beerBank.banker.balance': achievements.beerBank.banker.balance,
                  'achievements.researchProjects.stage': achievements.researchProjects.stage,
                  'achievements.beerwarts.skillLevel': achievements.beerwarts.skillLevel,
                  'achievements.beerwarts.magicians': achievements.beerwarts.magicians,
                  'achievements.beerwarts.manaPerSecond': achievements.beerwarts.manaPerSecond,
                  'achievements.beerwarts.magicianManaPerSecond': achievements.beerwarts.magicianManaPerSecond,
                  'achievements.beerwarts.manaTotal': achievements.beerwarts.manaTotal,
                  'achievements.beerwarts.buildingLevel': achievements.beerwarts.buildingLevel,
                  'achievements.beerwarts.buildingLevelTotal': achievements.beerwarts.buildingLevelTotal,
                  'achievements.beerwarts.sacrifice': achievements.beerwarts.sacrifice,
                  'achievements.beerwarts.sacrificeEach': achievements.beerwarts.sacrificeEach,
                  'achievements.beerwarts.groupTraining': achievements.beerwarts.groupTraining,
                  'achievements.beerFactory.factories.wood': achievements.beerFactory.factories.wood,
                  'achievements.beerFactory.factories.storage': achievements.beerFactory.factories.storage,
                  'achievements.beerFactory.factories.transport': achievements.beerFactory.factories.transport,
                  'achievements.beerFactory.factories.stone': achievements.beerFactory.factories.stone,
                  'achievements.beerFactory.factories.iron': achievements.beerFactory.factories.iron,
                  'achievements.beerFactory.factories.lodge': achievements.beerFactory.factories.lodge,
                  'achievements.beerFactory.factories.mine': achievements.beerFactory.factories.mine,
                  'achievements.beerFactory.factories.academy': achievements.beerFactory.factories.academy,
                  'achievements.beerFactory.factories.builder': achievements.beerFactory.factories.builder,
                  'achievements.beerFactory.factories.tradingPost': achievements.beerFactory.factories.tradingPost,
                  'achievements.beerFactory.factories.backRoom': achievements.beerFactory.factories.backRoom,
                  'achievements.beerFactory.factories.crop': achievements.beerFactory.factories.crop,
                  'achievements.beerFactory.factories.orchard': achievements.beerFactory.factories.orchard,
                  'achievements.beerFactory.factories.greenhouse': achievements.beerFactory.factories.greenhouse,
                  'achievements.beerFactory.factories.fisherman': achievements.beerFactory.factories.fisherman,
                  'achievements.beerFactory.factories.cattle': achievements.beerFactory.factories.cattle,
                  'achievements.beerFactory.factories.restaurant': achievements.beerFactory.factories.restaurant,
                  'achievements.beerFactory.materials.wood': achievements.beerFactory.materials.wood,
                  'achievements.beerFactory.materials.strongWood': achievements.beerFactory.materials.strongWood,
                  'achievements.beerFactory.materials.woodenBeam': achievements.beerFactory.materials.woodenBeam,
                  'achievements.beerFactory.materials.stone': achievements.beerFactory.materials.stone,
                  'achievements.beerFactory.materials.granite': achievements.beerFactory.materials.granite,
                  'achievements.beerFactory.materials.iron': achievements.beerFactory.materials.iron,
                  'achievements.beerFactory.materials.copper': achievements.beerFactory.materials.copper,
                  'achievements.beerFactory.materials.gold': achievements.beerFactory.materials.gold,
                  'achievements.beerFactory.materials.diamond': achievements.beerFactory.materials.diamond,
                  'achievements.beerFactory.materials.charcoal': achievements.beerFactory.materials.charcoal,
                  'achievements.beerFactory.materials.tools': achievements.beerFactory.materials.tools,
                  'achievements.beerFactory.materials.medallion': achievements.beerFactory.materials.medallion,
                  'achievements.beerFactory.materials.marble': achievements.beerFactory.materials.marble,
                  'achievements.beerFactory.materials.basePlate': achievements.beerFactory.materials.basePlate,
                  'achievements.beerFactory.materials.knowledge': achievements.beerFactory.materials.knowledge,
                  'achievements.beerFactory.jobs.amount': achievements.beerFactory.jobs.amount,
                  'achievements.beerFactory.jobs.duration': achievements.beerFactory.jobs.duration,
                  'achievements.beerFactory.slots.constructed': achievements.beerFactory.slots.constructed,
                  'achievements.beerFactory.slots.automation.autoBuyer.amount': achievements.beerFactory.slots.automation.autoBuyer.amount,
                  'achievements.beerFactory.slots.automation.autoLevelUp.amount': achievements.beerFactory.slots.automation.autoLevelUp.amount,
                  'achievements.beerFactory.slots.automation.autoUpgrade': achievements.beerFactory.slots.automation.autoUpgrade,
                  'achievements.beerFactory.tradingRoutes': achievements.beerFactory.tradingRoutes,
                  'achievements.beerFactory.traded': achievements.beerFactory.traded,
                  'achievements.stockMarket.investment': achievements.stockMarket.investment,
                  'achievements.stockMarket.row.positive': achievements.stockMarket.row.positive,
                  'achievements.stockMarket.row.negative': achievements.stockMarket.row.negative,
                  'achievements.stockMarket.balance.positive': achievements.stockMarket.balance.positive,
                  'achievements.stockMarket.balance.negative': achievements.stockMarket.balance.negative,
                  'achievements.stockMarket.holds': achievements.stockMarket.holds,
                  'achievements.stockMarket.lever': achievements.stockMarket.lever,
                  'achievements.abstinence': achievements.abstinence,
                  'achievements.buyAmount.upgrades': achievements.buyAmount.upgrades,
                  'achievements.buyAmount.buildings': achievements.buyAmount.buildings,
                  'achievements.buildingMG.automatedBar.gameLevel': achievements.buildingMG.automatedBar.gameLevel,
                  'achievements.buildingMG.automatedBar.soldBeer': achievements.buildingMG.automatedBar.soldBeer,
                  'achievements.buildingMG.automatedBar.items.bar': achievements.buildingMG.automatedBar.items.bar,
                  'achievements.buildingMG.automatedBar.items.table': achievements.buildingMG.automatedBar.items.table,
                  'achievements.buildingMG.automatedBar.items.pipe': achievements.buildingMG.automatedBar.items.pipe,
                  'achievements.buildingMG.automatedBar.items.coolingEngine': achievements.buildingMG.automatedBar.items.coolingEngine,
                  'achievements.buildingMG.beerCloner.clonings': achievements.buildingMG.beerCloner.clonings,
                  'achievements.buildingMG.beerCloner.autoClonings': achievements.buildingMG.beerCloner.clonings,
                  'achievements.buildingMG.beerCloner.buildingLevel': achievements.buildingMG.beerCloner.buildingLevel,
                  'achievements.special.beerBlender.equipped': achievements.special.beerBlender.equipped,
                  'achievements.special.sacrificed': achievements.special.sacrificed,
              };

        $.each(keysToExpand, function (achievementGroupLanguageKey, expandToAchievementList) {
            $.each(expandToAchievementList, function (achievementKey) {
                const key = `${achievementGroupLanguageKey}.${achievementKey}.description`;
                if (language[key]) {
                    return;
                }

                if (!language[achievementGroupLanguageKey]) {
                    (new Beerplop.ErrorReporter()).reportError(
                        'DEBUG',
                        'LanguageMiddleware expandAchievements',
                        achievementGroupLanguageKey
                    );

                    return;
                }

                language[key] = language[achievementGroupLanguageKey].replace(/__KEY__/g, achievementKey);
            });

            delete language[achievementGroupLanguageKey];
        });

        return language;
    };

    beerplop.LanguageMiddleware = LanguageMiddleware;
})(Beerplop);
