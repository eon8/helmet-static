#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const Queue = require('queue-batch');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const server = require('./server');

const port = 3001;

const baseConfig = {
    basePath: path.join(process.cwd(), 'dist'),
    rootDocument: 'index.html',
    port,
    rootUrl: `http://localhost:${port}`,
    waitTime: 200,
    includeExternal: false,
    allowedExternalDomains: [],
    routes: ['/'],
    headless: true,
};

const loadedConfig = require(path.join(process.cwd(), 'helmet-static'));
const config = { ...baseConfig, ...loadedConfig };

const mainIndex = fs.readFileSync(path.join(config.basePath, config.rootDocument)).toString();
const mainIndexDocument = cheerio.load(mainIndex);

mainIndexDocument('[data-react-helmet]').remove();
const template = mainIndexDocument.html();

const skipExternalRequests = async page => {
    if (config.includeExternal) {
        return;
    }

    await page.setRequestInterception(true);
    page.on('request', async request => {
        const url = request.url();
        if (
            url.startsWith(config.rootUrl) ||
            config.allowedExternalDomains.some(allowedDomain => url.startsWith(allowedDomain))
        ) {
            request.continue();
        } else {
            request.abort();
        }
    });
};

async function shutdown(browser) {
    console.timeEnd('Total time');
    await browser.close();
    process.exit(0);
}

async function getAndSavePage(browser, route, callback) {
    const timmingLabel = `Processed ${route} in`;
    const outputPath = path.join(config.basePath, route);
    let error;
    let newIndex;

    console.time(timmingLabel);

    try {
        const target = `${config.rootUrl}${route}`;
        const page = await browser.newPage();

        await skipExternalRequests(page);

        await page.goto(target);

        await page.waitFor(config.waitTime);

        const helmetItems = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[data-react-helmet]')).map(x => x.outerHTML),
        );

        await page.close();

        mkdirp.sync(outputPath);

        newIndex = cheerio.load(template);

        newIndex('head').append(helmetItems);
    } catch (exception) {
        error = exception;
    }

    if (error) {
        return callback(error);
    }

    fs.writeFile(path.join(outputPath, 'index.html'), newIndex.html(), writeFileError => {
        console.timeEnd(timmingLabel);
        callback(writeFileError);
    });
}

(async () => {
    server.serve(config.basePath, config.port);

    console.time('Total time');

    const browser = await puppeteer.launch({ headless: config.headless });
    const queue = new Queue(getAndSavePage.bind(null, browser));

    queue.on('error', error => {
        shutdown(browser);
        throw error;
    });

    queue.on('empty', () => {
        shutdown(browser);
    });

    queue.concat(config.routes);
})();
