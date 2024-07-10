const browserObject = require('./browser');

const readline = require("readline");
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function prompt(questionText) {
	console.log("\n[Prompt] - Aguardando resposta");
		return new Promise((resolve) => {
			rl.question(`\n${questionText}`, (input) => {
				rl.close();
				console.log('\n')
				resolve(input);
			});
		});
}

const config = require('./.config.json')

const init = async () => {
	try {
		const wsChromeEndpointurl = config.wsChromeEndpointurl
		const browser = await browserObject.startBrowser(wsChromeEndpointurl);
	
		const scraperName = process.argv[2] || ''
		const scraper = scraperName ? require(`./${scraperName}`) : require('./infoScraper');
		
		await scraper.scrapPage(browser)
	} catch (e) {
		console.log(e)
	}
}

init()