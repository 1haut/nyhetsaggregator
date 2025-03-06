import axios from "axios";
import * as cheerio from 'cheerio';
import puppeteer from "puppeteer";
import readline from 'node:readline/promises';

const vgHjemmeside = "https://www.vg.no";
const nrkHjemmeside = "https://www.nrk.no";
const aftenpostenHjemmeside = "https://www.aftenposten.no";

async function emneValg() { 
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const brukerSvar = await rl.question('Hvilke emner har du lyst til å lese om? ');
  const stikkord = brukerSvar.split(",").map((emne) => emne.trim());
  rl.close()
  
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

		$("article:not([hidden])").each((index, element) => {
			const overskrift = $(element).find('.titles').text();
			const url = $(element).find('a').attr('href');

			overskrift = overskrift.replace(/\s*\n\s*/g, ' ').trim("");
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

		$('.content-main-wrapper article').each((index, element) => {
			const overskrift = $(element).attr('data-pulse-teaser-title');
			const url = $(element).attr('data-pulse-url');

			const betalingsmurAttributt = $(element).attr('data-pulse-access-level');
          	const betalingsmur = (betalingsmurAttributt === "Paid")

			if (url && url.startsWith(aftenpostenHjemmeside));
			nyheter.push({
				nyhetsside: 'Aftenposten',
				tittel: overskrift,
				lenke: url,
				betalingsmur: betalingsmur
			});
		});

		return nyheter
	} catch (err) {
		console.error("Error fetching data: ", err);
	}
};

async function skrapVgArtikkel(nettlenke) {
	try {
		const $ = await nettsideHTML(nettlenke);

		const tekst = [];
		const artikkelside = $('h1, .article-body > p, .article-body > h2');

		artikkelside.each((index, element) => {
			const paragraf = $(element).text();
			tekst.push(paragraf);
		});
		
		return tekst.join(" ")
	} catch (err) {
			console.error(err);
	}
};

async function skrapNrkArtikkel(nettlenke) {
	try {
		const $ = await nettsideHTML(nettlenke);

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

			return topptekst + total.join(" ")
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
	} catch (err) {
		console.error(err);
	}
}


async function main() {
	const nyheterVg = await hentNyheterVg();
	const nyheterNrk = await hentNyheterNrk();
	const nyheterAftenposten = await hentNyheterAftenposten();

	const dagensOverskrifter = nyheterVg.concat(nyheterNrk).concat(nyheterAftenposten);

	for (let nyhet of dagensOverskrifter) {
		console.log(`(${nyhet['nyhetsside']}) ${nyhet['tittel']} \n ${nyhet['lenke']}`)
	};
};

main();