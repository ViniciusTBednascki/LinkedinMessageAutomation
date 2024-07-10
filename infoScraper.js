const fs = require('fs')
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

async function searchByName(page, xpathName) {
	return await page.evaluate((xpathName) => {
		const item = document.evaluate(xpathName, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
		return !!item
	}, xpathName)
}

let config = require('./.config.json')

const scraperObject = {
	homeUrl: 'https://www.linkedin.com/',
	browser: null,
	page: null,
	infos_list: [],

	async scrapPage(browser) {
		try {
			console.log("\nIniciando scraper de informações\n")
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
			await this.page.click('span[title="Minha rede"]')
			await this.page.waitForNetworkIdle({concurrency: 2})
			
			console.log("Navegando para minhas conexões")
			const xpathMenu = "//a/div/div[contains(.,'Conexões')]"
			await this.page.evaluate((xpathMenu) => {
				const menu = document.evaluate(xpathMenu, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
				menu.click()
			}, xpathMenu)
			await this.page.waitForNetworkIdle({concurrency: 2})
			
			/* console.log("Buscando último nome")
			let lastName = config['last_info'] || ''
			
			await autoScroll(this.page, '.mn-connection-card', lastName)

			const xpathName = lastName ? `//a/span[contains(.,'${lastName}')]` : ''
			const linkList = await this.page.$$eval(".mn-connection-card", (cardList, xpathName) => {
				if(xpathName) {
					const item = document.evaluate(xpathName, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
					const idx = cardList.indexOf(item.offsetParent)
					cardList = cardList.slice(0, idx)
				}
				
				return cardList.reverse().map(card => {
					const nameElement = card.querySelectorAll(".visually-hidden")[1].nextElementSibling
					const name = nameElement.innerText.trim()
					const link = nameElement.parentElement.href
					return [name, link]
				})
			}, xpathName)
			
			return fs.writeFileSync('./linkList.json', JSON.stringify(linkList, null, 2)) */

			const infos = require("./infos.json")
			let linkList = require("./linkList.json")
			let lastName = config['last_info'] || ''

			const lastNameIdx = linkList.findIndex(item => item[0] == lastName)
			linkList = linkList.slice(lastNameIdx+1)
			
			let idx = 1;
			for await (const [name, link] of linkList) {
				try {
					console.log("Abrindo perfil de "+name)
					const infoPage = await browser.newPage()
					await infoPage.goto(link)
					await infoPage.waitForNetworkIdle({concurrency: 2})
					await waitFor(1000)
	
					console.log("Abrindo e coletando informações")
					await infoPage.click("#top-card-text-details-contact-info")
					await infoPage.waitForNetworkIdle({concurrency: 2})
					await waitFor(1000)
	
					const info = await infoPage.evaluate((link) => {
						const info = {
							name: document.querySelector("h1#pv-contact-info").innerText.trim(),
							url: link
						}
						
						const sections = document.querySelectorAll("div.section-info section")
	
						sections.forEach(section => {
							const title = section.querySelector(".pv-contact-info__header").innerText.trim()
							switch (title) {
								case "sites":
									info[title] = Array.from(section.querySelectorAll("ul li a"), a => a.href)
									break;
							
								case "telefone":
									info[title] = Array.from(section.querySelectorAll("ul li"), li => li.firstElementChild.innerText.trim())
									break;
								
								case "Endereço":
								case "E-mail":
									info[title] = section.querySelector("div a").innerText.trim()
									break;
								
								default:
									break;
							}
						})
	
						return info
					}, link)
					
					infos.push(info)
					lastName = info.name

					await waitFor(500)
					await infoPage.close()
					await waitFor(1000)

					if(idx%10 == 0) {
						console.log("salvando informações")
						fs.writeFileSync('./infos.json', JSON.stringify(infos, null, 2))
						config['last_info'] = lastName
						fs.writeFileSync('./.config.json', JSON.stringify(config, null, 2))
					}
					idx++;
				} catch (error) {
					console.log("Erro na obtenção de dados:")
					console.log(error)
					break
				}
			}

			fs.writeFileSync('./infos.json', JSON.stringify(infos, null, 2))
			config['last_info'] = lastName
			fs.writeFileSync('./.config.json', JSON.stringify(config, null, 2))
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