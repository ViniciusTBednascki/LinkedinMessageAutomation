const puppeteer = require('puppeteer');

async function startBrowser(wsChromeEndpointurl){
    let browser;
    const browserConfig = {
        headless: false,
        'defaultViewport' : { 'width' : 1536, 'height' : 737 },
        args: ["--disable-setuid-sandbox", '--window-size=1900,1000'],
        'ignoreHTTPSErrors': true
    }

    try {
        if(wsChromeEndpointurl) {
			try {
                console.log("Conectando ao navegador com WsEndpoint: " + wsChromeEndpointurl)
                const connectConfig = Object.assign({
                    browserWSEndpoint: wsChromeEndpointurl,
                }, browserConfig)
                browser = await puppeteer.connect(connectConfig);
            } catch (error) {
                console.log("Não foi possível conectar ao navegador existente")
                console.log("Abrindo novo navegador")
                browser = await puppeteer.launch(browserConfig);
            }
        } else {
            console.log("Abrindo novo navegador")
            browser = await puppeteer.launch(browserConfig);
        }
    } catch (err) {
        console.log("Could not create a browser instance => : ", err);
    }
    return browser;
}

module.exports = {
    startBrowser
};