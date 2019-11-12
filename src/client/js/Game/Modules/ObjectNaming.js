(function(beerplop) {
    'use strict';

    /**
     * Provide renaming in-game objects
     *
     * @param {Element}  elements            jQuery elements which shall be capable of renaming
     * @param {function} nameChangedCallback The callback to execute after a rename happened. Signature: (id, newName)
     * @param {string}   achievementPath     [optional] Dot separated path to the achievement to unlock after a renaming
     *
     * @constructor
     */
    function ObjectNaming (elements, nameChangedCallback, achievementPath = null) {
        elements.addClass('naming-enabled');
        elements.on('click', function (event) {
            const div       = $(event.target),
                  elementId = div.closest('.naming-container').data('namingId'),
                  inputId   = 'object-naming__' + elementId,
                  oldName   = div.text();

            if (div.hasClass('naming-active')) {
                return;
            }

            div.addClass('naming-active');
            div.html(`<input id="${inputId}" type="text" class="form-control" />`);

            const inputElement = $('#' + inputId);

            inputElement.val(oldName);
            inputElement.focus();

            inputElement.on('focusout', function (event) {
                const newName = $(event.target).val().trim();
                if (newName !== oldName && newName.length) {
                    nameChangedCallback(elementId, newName);

                    if (achievementPath) {
                        const achievementController = new Beerplop.AchievementController();

                        let achievement = achievementController.getAchievementStorage().achievements;
                        achievementPath.split('.').forEach(segment => achievement = achievement[segment]);

                        achievementController.checkAchievement(achievement);
                    }
                }
                div.text(newName);
                div.removeClass('naming-active');
            });
        });
    }

    beerplop.ObjectNaming = ObjectNaming;
})(Beerplop);