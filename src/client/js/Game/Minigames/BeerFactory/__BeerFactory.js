
const BUILD_QUEUE__BUILD          = 1;
const BUILD_QUEUE__UPGRADE        = 2;
const BUILD_QUEUE__CONSTRUCT_SLOT = 3;
const BUILD_QUEUE__EQUIP_SLOT     = 4;
const BUILD_QUEUE__UNIQUE_BUILD   = 5;

const MANAGER_ACADEMY__HIRE     = 'hire';
const MANAGER_ACADEMY__LEVEL_UP = 'levelUp';

const EQUIPMENT_STATE__UNDER_CONSTRUCTION = 1;
const EQUIPMENT_STATE__FINISHED           = 2;

const MISSING_MATERIAL_BUFFER = 10;

const EXTENSION_TYPE__PRODUCTION = 1;
const EXTENSION_TYPE__PROXY      = 2;

const EXTENSION_PRODUCTION__DIRECT  = 1;
const EXTENSION_PRODUCTION__PROJECT = 2;

// +15% production
const EQUIPMENT_ITEM__HYDROLYSIS   = 'hydrolysis';
// +30% production
const EQUIPMENT_ITEM__FERMENTATION = 'fermentation';
// building boosts last longer
const EQUIPMENT_ITEM__DEGRADATION  = 'degradation';
// boost each other building
const EQUIPMENT_ITEM__CARBONATION  = 'carbonation';
// auto buyer
const EQUIPMENT_ITEM__DIASTATIC    = 'diastatic';
// auto level up
const EQUIPMENT_ITEM__AMYLASE      = 'amylase';

const FACTORY_SECTION__FOOD = 'food';

const MATERIAL_SECTION__BASE     = 'base';
const MATERIAL_SECTION__PRODUCED = 'produced';
const MATERIAL_SECTION__FOOD     = 'food';

const MATERIAL_STORAGE_DIVIDENT = {
    wood: 1,
    strongWood: 1,
    woodenBeam: 2,
    stone: 1,
    granite: 2,
    iron: 1.5,
    charcoal: 3,
    marble: 5,
    tools: 7.5,
    gold: 2.5,
    basePlate: 0.5,
    knowledge: 30,
    copper: 2.5,
    diamond: 2.5,
    medallion: 2.5,
    crop: 5,
    fruit: 5,
    vegetable: 5,
    fish: 5,
    meat: 5,
    bread: 10,
    jam: 10,
    salad: 10,
    smokedFish: 10,
    steak: 10,
};

const FACTORY_DATA_FIX = {
    wood: {
        manual: true,
        buildable: true,
    },
    storage: {
        manual: false,
        factory: true,
        buildable: true,
    },
    transport: {
        manual: false,
        factory: true,
        buildable: true,
    },
    stone: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['stone'],
    },
    iron: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['iron'],
    },
    lodge: {
        manual: false,
        factory: true,
        buildable: true,
    },
    mine: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['gold'],
    },
    queue: {
        manual: false,
        factory: true,
        buildable: false,
    },
    academy: {
        manual: false,
        factory: true,
        buildable: true,
    },
    builder: {
        manual: false,
        factory: true,
        buildable: true,
    },
    tradingPost: {
        manual: false,
        factory: true,
        buildable: true,
    },
    engineer: {
        manual: false,
        factory: true,
        buildable: false,
    },
    backRoom: {
        manual: false,
        factory: true,
        buildable: true,
    },
    // food factories
    crop: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['crop'],
        section: FACTORY_SECTION__FOOD,
    },
    orchard: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['fruit'],
        section: FACTORY_SECTION__FOOD,
    },
    greenhouse: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['vegetable'],
        section: FACTORY_SECTION__FOOD,
    },
    fisherman: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['fish'],
        section: FACTORY_SECTION__FOOD,
    },
    cattle: {
        manual: true,
        factory: true,
        buildable: true,
        enableMaterial: ['meat'],
        section: FACTORY_SECTION__FOOD,
    },
    restaurant: {
        manual: false,
        factory: true,
        buildable: true,
        section: FACTORY_SECTION__FOOD,
    },
};

const MATERIAL_DATA_CONST = {
    wood: {
        enabled: true,
    },
    strongWood: {
        enabled: true,
    },
    knowledge: {
        enabled: true,
        hidden: true,
    },
    charcoal: {
        section: MATERIAL_SECTION__PRODUCED,
    },
    marble: {
        section: MATERIAL_SECTION__PRODUCED,
    },
    tools: {
        section: MATERIAL_SECTION__PRODUCED,
    },
    medallion: {
        section: MATERIAL_SECTION__PRODUCED,
    },
    basePlate: {
        section: MATERIAL_SECTION__PRODUCED,
    },
    crop: {
        section: MATERIAL_SECTION__FOOD,
    },
    fruit: {
        section: MATERIAL_SECTION__FOOD,
    },
    vegetable: {
        section: MATERIAL_SECTION__FOOD,
    },
    fish: {
        section: MATERIAL_SECTION__FOOD,
    },
    meat: {
        section: MATERIAL_SECTION__FOOD,
    },
    bread: {
        section: MATERIAL_SECTION__FOOD,
    },
    jam: {
        section: MATERIAL_SECTION__FOOD,
    },
    salad: {
        section: MATERIAL_SECTION__FOOD,
    },
    smokedFish: {
        section: MATERIAL_SECTION__FOOD,
    },
    steak: {
        section: MATERIAL_SECTION__FOOD,
    },
};

const EXTENSIONS = {
    charcoal: {
        enableMaterial: ['charcoal'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            wood: 10,
        },
        produces: {
            charcoal: 1,
        },
    },
    mason: {
        enableMaterial: ['marble'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            stone: 15,
            woodenBeam: 5,
            iron: 5,
        },
        produces: {
            marble: 1,
        },
    },
    blacksmith: {
        enableMaterial: ['tools'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            iron: 10,
            wood: 5,
            charcoal: 1,
        },
        produces: {
            tools: 1,
        },
    },
    basePlate: {
        enableMaterial: ['basePlate'],
        productionType: EXTENSION_PRODUCTION__PROJECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            iron: 550,
            strongWood: 450,
            wood: 250,
            stone: 450,
            marble: 30,
            tools: 75,
            gold: 150,
        },
        produces: {
            basePlate: 1,
        },
    },
    medallion: {
        enableMaterial: ['medallion'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            charcoal: 3,
            gold: 5,
            diamond: 2,
            copper: 3,
        },
        produces: {
            medallion: 1,
        },
    },
    managerAcademy: {
        productionType: EXTENSION_PRODUCTION__PROJECT,
        hasProjectQueue: true,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            knowledge: 0,
        },
    },
    bakery: {
        enableMaterial: ['bread'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            crop: 3,
            wood: 2,
        },
        produces: {
            bread: 1,
        },
    },
    grandma: {
        enableMaterial: ['jam'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            fruit: 3,
            wood: 1,
        },
        produces: {
            jam: 1,
        },
    },
    shed: {
        enableMaterial: ['salad'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            vegetable: 3,
        },
        produces: {
            salad: 1,
        },
    },
    smokehouse: {
        enableMaterial: ['smokedFish'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            fish: 3,
            wood: 3,
        },
        produces: {
            smokedFish: 1,
        },
    },
    slaughter: {
        enableMaterial: ['steak'],
        productionType: EXTENSION_PRODUCTION__DIRECT,
        type: EXTENSION_TYPE__PRODUCTION,
        consumes: {
            meat: 3,
            tools: 1,
        },
        produces: {
            steak: 1,
        },
    },
    coworker: {
        type: EXTENSION_TYPE__PROXY,
    },
    planned: {
        type: EXTENSION_TYPE__PROXY,
    },
    bully: {
        type: EXTENSION_TYPE__PROXY,
    },
};

let BeerFactoryGame = {};
(function($, BeerFactoryGame){})(jQuery, BeerFactoryGame);
