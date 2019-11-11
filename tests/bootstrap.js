const puppeteer = require('puppeteer');

(async () => {
    console.log('Init Puppeteer');
    const browser = await puppeteer.launch({
        headless: true,
        // de specific number parsing
        args: ['--lang=de-DE']
    });
    const page = await browser.newPage();

    await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
    });

    const notifyPuppeteer = new Promise(async (resolve) => {
        await page.exposeFunction('onNotifyPuppeteer', async e => {
            console.log('Tests finished:');

            const result = await page.$$eval(
                      '#mocha-stats li',
                      nodes => Object.values(nodes).map(item => item.textContent.trim()).filter(item => item.length)
                  ),
                  hasFailedTests = parseInt(result[1].split(' ')[1]) > 0;

            console.log();

            if (hasFailedTests) {
                const failedTests = await page.$$eval(
                    '#mocha-report > .suite',
                    suites => Object.values(suites).map(
                        suite => ({
                            label: $(suite).find('> h1').text(),
                            groups: $(suite).find('.suite').map(
                                (index, group) => ({
                                    label: $(group).find('> h1').text(),
                                    tests: $(group).find('li.test.fail').map(
                                        (index, test) => $(test).find('> h2').text().trim()
                                    ),
                                })
                            ).filter((index, group) => group.tests && group.tests.length > 0)
                        })
                    ).filter(suite => suite.groups && suite.groups.length > 0)
                );

                failedTests.forEach(suite => {
                    if (suite.groups) {
                        console.log(suite.label);
                        Object.values(suite.groups).forEach((group) => {
                            if (group.tests) {
                                console.log('  ' + group.label);
                                Object.values(group.tests).forEach(
                                    (error) => console.log('    ' + error)
                                );
                                console.log();
                            }
                        });
                        console.log();
                    }
                });
            }

            result.forEach(row => console.log(row));
            console.log();

            resolve(hasFailedTests);
        });
    });

    /**
     * Attach an event listener to page to capture a custom event on page load/navigation.
     * @param {string} type Event name.
     * @return {!Promise}
     */
    function listenFor(type) {
        return page.evaluateOnNewDocument(type => {
            document.addEventListener(type, e => {
                window.onNotifyPuppeteer({type, detail: e.detail});
            });
        }, type);
    }

    await listenFor('testSuiteFinished');
    await page.goto('http://localhost:8080/test');

    console.log('Init tests');
    const hasFailedTests = await notifyPuppeteer;

    await page.screenshot({path: 'test-result.png'});

    await browser.close();
    console.log('Done');

    process.exit(hasFailedTests ? 1 : 0);
})();
