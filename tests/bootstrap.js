const puppeteer = require('puppeteer');

(async () => {
    const delay = ((process.argv[2] || '').match(/^--delay=(\d+)$/) || [])[1] || 0;
    if (delay) {
        await new Promise(resolve => {
            console.log('Wait for database to be up');
            setTimeout(resolve, delay);
        });
    }

    setTimeout(() => {
        console.log('Test timeout');
        process.exit(1);
    }, 60000);

    console.log('Init Puppeteer');
    const browser = await puppeteer.launch({
        headless: true,
        // de specific number parsing
        args: ['--lang=de-DE']
    });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('error', msg => console.log('PAGE ERROR:', msg.message));
    page.on('pageerror', msg => console.log('PAGE ERROR:', msg.message));

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
                            groups: Object.values($(suite).find('.suite')).map(
                                group => ({
                                    label: $(group).find('> h1').text(),
                                    tests: Object.values($(group).find('li.test.fail'))
                                        .map(test => ({
                                            assertion: $(test).find('> h2').text().trim(),
                                            error: $(test).find('> pre.error').text(),
                                        }))
                                        .filter(test => test.assertion.length > 0),
                                })
                            ).filter(group => group.tests && group.tests.length > 0)
                        })
                    ).filter(suite => suite.groups && suite.groups.length > 0)
                );

                failedTests.forEach(suite => {
                    if (suite.groups) {
                        console.log(suite.label);
                        suite.groups.forEach((group) => {
                            if (group.tests) {
                                console.log('  ' + group.label);
                                group.tests.forEach(
                                    (test) => {
                                        console.log('    ' + test.assertion);
                                        console.log('      ' + test.error);
                                    }
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
    const response = await page.goto('http://localhost:8080/test').catch(reason => {
        console.log('Loading tests failed.');
        console.log(reason.message);

        process.exit(1);
    });

    if (!response.ok()) {
        console.log('Loading tests failed. Got ' + response.status());
        console.log(response.statusText());
        console.log(response.text());

        process.exit(1);
    }

    console.log('Init tests. Server responded with: ' + response.status() + ' ' + response.statusText());

    const hasFailedTests = await notifyPuppeteer;

    await page.screenshot({path: 'test-result.png'});

    await browser.close();
    console.log('Done');

    process.exit(hasFailedTests ? 1 : 0);
})();
