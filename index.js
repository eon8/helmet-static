#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const Queue = require('queue-batch');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const server = require('./server');

const mainIndex = fs.readFileSync(path.join(process.cwd(), './dist/index.html')).toString();
const mainIndexDocument = cheerio.load(mainIndex);

mainIndexDocument('[data-react-helmet]').remove();
const template = mainIndexDocument.html();

const port = 3001;

const baseConfig = {
    basePath: path.join(process.cwd(), 'dist'),
    port,
    rootUrl: `http://localhost:${port}`,
    waitTime: 200,
    includeExternal: false,
    routes: ['/'],
};

fs.writeFileSync('./baseConfig.json', JSON.stringify(baseConfig, null, 4));
const loadedConfig = require(path.join(process.cwd(), 'helmet-static'));
const config = { ...baseConfig, ...loadedConfig };

const skipExternalRequests = async page => {
    await page.setRequestInterception(true);
    page.on('request', async request => {
        if (request.url().startsWith(config.rootUrl)) {
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

    console.time(timmingLabel);

    const target = `${config.rootUrl}${route}`;
    const page = await browser.newPage();

    await skipExternalRequests(page);

    await page.goto(target, { waitUntil: 'networkidle2' });

    await page.waitFor(config.waitTime);

    const helmetItems = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-react-helmet]')).map(x => x.outerHTML),
    );

    await page.close();

    const outputPath = path.join(config.basePath, route);

    mkdirp.sync(outputPath);

    const newIndex = cheerio.load(template);

    newIndex('head').append(helmetItems);

    fs.writeFile(path.join(outputPath, 'index.html'), newIndex.html(), error => {
        console.timeEnd(timmingLabel);
        callback(error);
    });
}

(async () => {
    server.serve(config.basePath, config.port);

    console.time('Total time');

    const browser = await puppeteer.launch({ headless: true });
    const queue = new Queue(getAndSavePage.bind(null, browser));

    queue.on('error', error => {
        throw error;
    });

    queue.on('empty', () => {
        shutdown(browser);
    });

    queue.concat(config.routes);
})();
