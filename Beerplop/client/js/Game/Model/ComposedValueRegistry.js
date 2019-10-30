
const CV_MANUAL_PLOP = "CV_MANUAL_PLOP",
      CV_BOTTLE_CAP  = "CV_BOTTLE_CAP",
      CV_MANA        = "CV_MANA";

const ComposedValueRegistry = {
    _registry: {},

    /**
     * Get a composed value object
     *
     * @param {string} key
     *
     * @return {ComposedValue}
     */
    getComposedValue: function (key) {
        if (!this._registry[key]) {
            this._registry[key] = new ComposedValue(key);
        }

        return this._registry[key];
    }
};
