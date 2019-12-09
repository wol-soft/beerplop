
const EVENTS = {
    CORE: {
        ITERATION: 'beerplop.core.iteration',
        ITERATION_LONG: 'beerplop.core.iteration-long',
        STATISTIC_SNAPSHOT: 'beerplop.core.statistic-snapshot',
        ACHIEVEMENT_REACHED: 'beerplop.core.achievement-reached',
        LEVEL_UP: 'beerplop.core.level-up',
        SACRIFICE: 'beerplop.core.sacrifice',
        REINCARNATE: 'beerplop.core.reincarnate',
        CLICK: 'beerplop.core.click',
        OPTION_CHANGED: 'beerplop.core.option-changed',
        BUY_AMOUNT_UPDATED: 'beerplop.core.buy-amount-updated',
        BUFF: {
            SPAWNED: 'beerplop.core.buff.spawned',
            CLICKED: 'beerplop.core.buff.clicked',
            MISSED: 'beerplop.core.buff.missed',
        },
        BUILDING: {
            LEVEL_UP: 'beerplop.core.building.level-up',
            PURCHASED: 'beerplop.core.building.purchased'
        },
        BOTTLE_CAP: {
            PRODUCTION_UPDATED: 'beerplop.core.bottle-cap.production-updated',
            PURCHASED: 'beerplop.core.bottle-cap.purchased',
        },
        PLOPS: {
            ADDED: 'beerplop.core.plops.added',
            REMOVED: 'beerplop.core.plops.removed',
            UPDATED: 'beerplop.core.plops.updated',
            AUTO_PLOPS_UPDATED: 'beerplop.core.plops.auto-plops-updated'
        },
        INITIALIZED: {
            GAME: 'beerplop.core.initialized.game',
            INDEXED_DB: 'beerplop.core.initialized.indexed-db',
        },
    },
    SAVE: {
        LOAD: {
            STARTED: 'beerplop.save.load.start',
            FINISHED: 'beerplop.save.load.finish',
        },
        AUTOSAVE: 'beerplop.save.autosave',
    },
    BEER_BLENDER: {
        UPDATE: 'beerplop.beer-blender.update',
    },
    RESEARCH: {
        STARTED: 'beerplop.research.started',
        FINISHED: 'beerplop.research.finished',
    },
    STOCK: {
        PURCHASED: 'beerplop.stock.purchased',
        CLOSED: 'beerplop.stock.closed',
    },
    BEER_FACTORY: {
        QUEUE: {
            ADDED: 'beerplop.beer-factory.queue.added',
            FINISHED: 'beerplop.beer-factory.queue.finished',
            MATERIAL_FINISHED: 'beerplop.beer-factory.queue.material-finished',
        },
        UNIQUE_BUILD: {
            UPDATED: 'beerplop.beer-factory.unique-build.updated',
        },
        AUTO_BUYER: 'beerplop.beer-factory.auto-buyer',
        AUTO_LEVEL_UP: 'beerplop.beer-factory.auto-level-up',
        AUTO_UPGRADE: 'beerplop.beer-factory.auto-upgrade',
    },
    AUTOMATED_BAR: {
        SACRIFICE: 'beerplop.automated-bar.sacrifice',
        UPDATE: 'beerplop.automated-bar.update',
        UPGRADE_PURCHASED: 'beerplop.automated-bar.upgrade-purchased',
    },
    CLONING: {
        CLONED: 'beerplop.cloning.cloned',
        AVAILABLE: 'beerplop.cloning.available',
    },
};
