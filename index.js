import axios from "axios";
import * as cheerio from 'cheerio';
import puppeteer from "puppeteer";
import readline from 'node:readline/promises';

// Hjemmesider
const vgHjemmeside = "https://www.vg.no";
const nrkHjemmeside = "https://www.nrk.no";
const aftenpostenHjemmeside = "https://www.aftenposten.no";

// Spør brukeren om emner den har lyst til å lese om
async function emneValg() {
	// Modul som tillater brukerinteraksjon
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const brukerSvar = await rl.question('Hvilke emner har du lyst til å lese om? Separer emnene med komma');
	// Setter valgte emner i listeform(array)
  const stikkord = brukerSvar.split(",").map((emne) => emne.trim());
  rl.close();
  
  return stikkord
};


async function nettsideHTML(url) {
	try {
		const html = await axios.get(url);
		const htmlMarkup = cheerio.load(html);

		return htmlMarkup
	} catch (err) {
		console.error(err);
	}
}

async function hentNyheterVg() {
	try {
		const $ = await nettsideHTML(vgHjemmeside);
		const nyheter = [];
		// Henter url, overskrift, og indikerer om artiklen har en betalingsmur
		$("article:not([hidden])").each((index, element) => {
			const overskrift = $(element).find('.titles').text();
			const url = $(element).find('a').attr('href');

			overskrift = overskrift.replace(/\s*\n\s*/g, ' ').trim(""); // Formatering av overskrift
			const betalingsmur = $(element).attr('data-paywall');
			if (url && url.startsWith(vgHjemmeside)) {
				nyheter.push({
					nyhetsside: 'VG',
					tittel: overskrift,
					lenke: url,
					betalingsmur: betalingsmur
					})};
				});

		return nyheter		
    } catch(err) {
        console.error("Error fetching data: ", err);
    }
};

async function hentNyheterNrk() {
	try {
		const $ = await nettsideHTML(nrkHjemmeside);
		const nyheter = [];
		
		// Henter url, overskrift
		$('.kur-room:not([data-ec-id="https://radio.nrk.no/"])').each((index, element) => {
			const url = $(element).find('a').attr('href');
			const overskrift = $(element).find('.kur-room__title').text().trim("");
			nyheter.push({
				nyhetsside: "NRK",
				tittel: overskrift,
				lenke: url,
				betalingsmur: false
				});
			});

		return nyheter
	} catch (err) {
		console.error("Error fetching data: ", err);
	}
};

async function hentNyheterAftenposten() {
	try {
		const $ = await nettsideHTML(aftenpostenHjemmeside);
		const nyheter = [];

		// Henter url, overskrift, og indikerer om artiklen har en betalingsmur
		$('.content-main-wrapper article').each((index, element) => {
			// Henting av overskrift og url v/ hjelp av attributt vs. nettsidestruktur
			const overskrift = $(element).attr('data-pulse-teaser-title') || $(element).find('h2').text();
			const url = $(element).attr('data-pulse-url') || $(element).find('a').attr('href');

			// Attributt som signaliserer tilgang til artikkel
			const betalingsmurAttributt = $(element).attr('data-pulse-access-level');
			const betalingsmur = (betalingsmurAttributt === "Paid"); // 

			if (url && url.startsWith(aftenpostenHjemmeside)){
				nyheter.push({
					nyhetsside: 'Aftenposten',
					tittel: overskrift,
					lenke: url,
					betalingsmur: betalingsmur
				});
			}		
		});

		return nyheter
	} catch (err) {
		console.error("Error fetching data: ", err);
	}
};

async function skrapVgArtikkel(nettlenke) {
	try {
		const $ = await nettsideHTML(nettlenke);

		const tekststykker = [];

		// Elementer som inneholder overskrifter (h1), avsnitt (p) og underoverskrifter (h2)
		const artikkelside = $('h1, .article-body > p, .article-body > h2');
		
		// Henter ut hvert ansnitt
		artikkelside.each((index, element) => {
			const ansnitt = $(element).text();
			tekststykker.push(ansnitt);
		});

		const tekst = tekststykker.join(" ")
		
		return tekst
	} catch (err) {
		console.error(err);
	}
};

async function skrapNrkArtikkel(nettlenke) {
	try {
		const $ = await nettsideHTML(nettlenke);

		// Skille mellom nyhetsmeldinger og artikler
		const finnesNyhetsmelding = $('article').attr('data-ec-name');
		if (finnesNyhetsmelding) {
			const tekst = $('.bulletin-title, .bulletin-text-body').text();

			return tekst
		} else {
			const topptekst = $('article header');

			const total = [];
			const artikkelelement = $("div[data-ec-name='brødtekst']").children('h2, p')
			$(artikkelelement).find('span[aria-hidden="true"]').text("");

			artikkelelement.each((index, element) => {
				const avsnitt = $(element).text();
				total.push(avsnitt);
			})

			const tekst = topptekst + total.join(" ") 

			return tekst
		}
	} catch (err) {
		console.error(err);
	}
}

async function skrapAftenpostenArtikkel(nettlenke) {
	try {
		const $ = await nettsideHTML(nettlenke);

		const total = [];

		$('article').children("h1, h2, p, ul").each((index, element) => {
			const avsnitt = $(element).text();
			total.push(avsnitt);
		});

		const tekst = total.join(" ");

		return tekst
	} catch (err) {
		console.error(err);
	}
}

async function hentTekst(url) {
	try {
		const urlprefiks = "https://";

		let artikkeltekst;
		if (url.startsWith(urlprefiks + "nrk.no")) {
			artikkeltekst = await skrapNrkArtikkel(url)
		} else if (url.startsWith(urlprefiks + "vg.no")){
			artikkeltekst = await skrapVgArtikkel(url);
		} else if (url.startsWith(urlprefiks + "aftenposten.no")) {
			artikkeltekst = await skrapAftenpostenArtikkel(url);
		}

		return artikkeltekst
	} catch (err) {
		console.log(`Url som feilet: ${url}`);
		console.error(err);
	}
};

function stikkord(emner, fullTekst) {
    const stikkordmatch = [];
    const soekbarTekst = fullTekst.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '');
    for (let ord of emner) {
        ord = ord.toLowerCase()
        if (soekbarTekst.includes(ord)) {
            stikkordmatch.push(ord);
        }
    }

    return stikkordmatch
}

async function main() {
	const stikkordliste = emneValg();

	const nyheterVg = await hentNyheterVg();
	const nyheterNrk = await hentNyheterNrk();
	const nyheterAftenposten = await hentNyheterAftenposten();

	const dagensOverskrifter = nyheterVg.concat(nyheterNrk).concat(nyheterAftenposten);
	console.log("Dagens overskrifter.")

	for (let nyhet of dagensOverskrifter) {
		nyhet.tekst = await hentTekst(nyhet.lenke);
		
		const matchendeStikkord = stikkord(stikkordliste, nyhet.tekst);

		if (matchendeStikkord.length > 0) {
			console.log(nyhet.lenke);
		}
	};
};

main();