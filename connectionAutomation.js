const waitFor = (ms) => new Promise(r => setTimeout(r, ms));

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

async function autoScroll(page, itemClass, name) {
	const delay = 2000;
	let thereIsButton = true;
	let foundName = false;

	const xpathButton = "//button/span[contains(.,'Exibir mais resultados')]"
	const xpathName = name ? `//a/span[contains(.,'${name}')]` : ''

  do {
		await scrollDown(page,itemClass);
    await page.waitForNetworkIdle()
		thereIsButton = await isThereButton(page, xpathButton)
    if(xpathName) foundName = await searchByName(page, xpathName)
  } while (thereIsButton & !foundName);
	await waitFor(delay)

	if(foundName) {
		await page.evaluate((xpathName) => {
			const item = document.evaluate(xpathName, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
			item.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
		}, xpathName)
	}
}

async function scrollDown(page,itemClass) {
  await page.evaluate((selector) => {
		const item = document.querySelector(selector)
    item.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' });
  }, `${itemClass}:last-child`);
}

async function isThereButton(page, xpathButton) {
	return await page.evaluate((xpathButton) => {
		let found = false
		const button = document.evaluate(xpathButton, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
		if(button) {
			button.click()
			found = true
		}
		return found
	}, xpathButton)
}

const scraperObject = {
	homeUrl: 'https://www.linkedin.com/',
	browser: null,
	page: null,
	infos_list: [],

	async scrapPage(browser) {
		try {
			console.log("\nIniciando automação de conexões\n")
			this.browser = browser
			this.page = await this.browser.newPage();

			console.log("Indo para a página incial")
			await this.page.goto(this.homeUrl, {
				waitUntil: 'domcontentloaded',
			})
			
			const usernameInput = await this.page.$("#session_key")
			if(usernameInput) {
				await this.login(config['credentials'])
			}
	
			console.log("Navegando para minha rede")
			await this.page.hover('span[title="Minha rede"]')
			await this.page.click('span[title="Minha rede"]')
			await this.page.waitForNetworkIdle({concurrency: 2})
			
			console.log("Navegando para minhas conexões")
			const xpathMenu = "//a/div/div[contains(.,'Conexões')]"
			await this.page.evaluate((xpathMenu) => {
				const menu = document.evaluate(xpathMenu, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
				menu.dispatchEvent(new Event('mouseover'));
				menu.click()
			}, xpathMenu)
			await this.page.waitForNetworkIdle({concurrency: 2})

			await prompt("\nSelecione o filtro e aperte enter para continuar\n")
			console.log("Enviando pedidos de conexões")
			
			let endOfSearch = false
			do {
				const buttons = await this.page.$$(".mn-connection-card__action-container div button")

				for await (const button of buttons) {
					const isConnectButton = await this.page.evaluate(btn => {
						if(!btn.firstElementChild.innerText) return false
						return btn.firstElementChild.innerText.trim() == "Conectar"
					}, button)
					
					if(isConnectButton) {
						console.log("Enviando pedido")
						await button.scrollIntoView()

						await button.hover()
						await button.click()
						await waitFor(500)
						
						const sendButton = await this.page.waitForSelector('button[aria-label="Enviar sem nota"]')
						await sendButton.hover()
						await sendButton.click()

						await this.page.waitForNetworkIdle({concurrency: 2})
					}
				}
				
				await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
				const nextButton = await this.page.waitForSelector('button[aria-label="Avançar"]', { visible: true , timeout: 5000 }).catch(_ => { return null })
				endOfSearch = !nextButton

				if(nextButton) {
					console.log("Avançando para a próxima página")
					await waitFor(500)
					
					await nextButton.hover()
					await nextButton.click()

					await this.page.waitForNetworkIdle({concurrency: 2})
					await waitFor(500)
				}
			} while (!endOfSearch);
		} catch (error) {
			console.log("Erro na automação:")
			console.log(error)
		}


	},
	
  async login(credentials) {
    try {
			console.log("Fazendo Login")
      await this.page.type(
          '#session_key',
          credentials['username'],
          {delay: 200}
      )
			await waitFor(500)
      await this.page.type(
          '#session_password',
          credentials['password'],
          {delay: 200}
      )
      await this.page.keyboard.press('Enter')

			// await prompt("Após aprovar o login, pressione enter para continuar.")
			await waitFor(5000)
			await this.page.waitForNetworkIdle()
    } catch (e) {
      console.log(e)
      throw "Erro ao fazer login"
    }
  },
}

module.exports = scraperObject;