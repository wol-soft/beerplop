
class ComposedValue {

    /**
     * @param {string} key
     */
    constructor (key) {
        this._key = key;
        this._modifier         = {};
        this._uncachedModifier = {};

        this._cache = {
            composedValue: null,
            modifierValue: {},
        };

        this._changedEventListener = [];
    };

    /**
     * Get the current value of the ComposedValue
     *
     * @returns {number}
     */
    getValue () {
        if (this._cache.composedValue !== null) {
            return ComposedValue._finiteCheck(this._cache.composedValue * this._getUncachedModifierValue());
        }

        this._calculateModifierValues();

        this._cache.composedValue = Object.values(this._cache.modifierValue)
            .reduce((prev, cur) => prev * cur, 1);

        this._changedEventListener.forEach(callback => callback());

        return ComposedValue._finiteCheck(this._cache.composedValue * this._getUncachedModifierValue());
    };

    _getUncachedModifierValue () {
        return Object.values(this._uncachedModifier).reduce((prev, modifier) => prev * modifier(), 1);
    };

    /**
     * Get the value excluding the given modifiers
     *
     * @param {string[]} excludeModifier
     *
     * @returns {number}
     */
    getValueExcludingModifier (excludeModifier = []) {
        this.getValue();

        return ComposedValue._finiteCheck(
            Object.entries(this._uncachedModifier)
                .reduce((prev, modifier) => excludeModifier.includes(modifier[0]) ? prev : prev * modifier[1](), 1)
            * Object.entries(this._cache.modifierValue)
                .reduce((prev, modifier) => excludeModifier.includes(modifier[0]) ? prev : prev * modifier[1], 1)
        );
    };

    /**
     * The value for the given modifier must be recalculated due to external changes
     *
     * @param {string} modifierKey
     *
     * @returns {ComposedValue}
     */
    triggerModifierChange (modifierKey) {
        this._cache.composedValue = null;

        delete this._cache.modifierValue[modifierKey];

        return this;
    };

    /**
     * Clear all internal caches to trigger a recalculation of the value
     *
     * @returns {ComposedValue}
     */
    recalculate () {
        this._cache.composedValue = null;
        this._cache.modifierValue = {};

        return this;
    };

    /**
     * Add a new modifier function to the ComposedValue.
     *
     * @param {string}   modifierKey
     * @param {function} modifierCallback
     * @param {boolean}  cache
     *
     * @returns {ComposedValue}
     */
    addModifier (modifierKey, modifierCallback, cache = true) {
        if (typeof modifierCallback !== 'function') {
            throw Error(`Modifier '${modifierKey}' for composed value '${this._key}' must be a function, got ${typeof modifierCallback}`);
        }

        if (!cache) {
            this._uncachedModifier[modifierKey] = modifierCallback;

            return this;
        }

        this._modifier[modifierKey] = modifierCallback;
        delete this._cache.modifierValue[modifierKey];

        this._cache.composedValue = null;

        return this;
    };

    /**
     * Remove a modifier from the ComposedValue
     *
     * @param {string} modifierKey
     *
     * @returns {ComposedValue}
     */
    removeModifier (modifierKey) {
        delete this._modifier[modifierKey];
        delete this._uncachedModifier[modifierKey];
        delete this._cache.modifierValue[modifierKey];

        this._cache.composedValue = null;

        return this;
    };

    /**
     * Provide a callback function to be triggered after the value of the ComposedValue has changed
     *
     * @param {function} callback
     *
     * @returns {ComposedValue}
     */
    onValueChange (callback) {
        if (typeof callback !== 'function') {
            throw Error(`onValueChange listener for composed value '${this._key}' must be a function, got ${typeof callback}`);
        }

        this._changedEventListener.push(callback);

        return this;
    };

    /**
     * Calculate all modifier values which aren't present in the cache
     *
     * @private
     */
    _calculateModifierValues () {
        if (this._cache.composedValue !== null) {
            return;
        }

        const availableModifier = Object.keys(this._modifier),
              cachedModifier    = Object.keys(this._cache.modifierValue);

        availableModifier.filter(modifier => !cachedModifier.includes(modifier)).forEach(modifierKey => {
            this._cache.modifierValue[modifierKey] = this._modifier[modifierKey]();
        });
    }

    /**
     * Check if a given value is finite. If the value isn't finite return the MAX_VALUE.
     *
     * @param {number} value
     *
     * @return {number}
     *
     * @private
     */
    static _finiteCheck (value) {
        return isFinite(value) ? value : Number.MAX_VALUE;
    }

    /**
     * Show a debug message with the calculations for the current value
     */
    debug () {
        const numberFormatter = new Beerplop.NumberFormatter();

        console.log('Total value', numberFormatter.format(this.getValue()));
        console.log('Cached modifiers:');
        $.each(this._cache.modifierValue, (key, value) => console.log('  - ' + key, numberFormatter.format(value)));
        console.log('Uncached modifiers:');
        $.each(this._uncachedModifier, (key, value) => console.log('  - ' + key, numberFormatter.format(value())));
    }
}
