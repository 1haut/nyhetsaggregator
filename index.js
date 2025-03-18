import axios from "axios";
import * as cheerio from 'cheerio';
import puppeteer from "puppeteer";
import readline from 'node:readline/promises';
import natural from 'natural';
import * as sw from 'stopword';
import { nno } from './ekstra/stoppordNynorsk.js'

// Hjemmesider
const vgHjemmeside = "https://www.vg.no";
const nrkHjemmeside = "https://www.nrk.no";
const aftenpostenHjemmeside = "https://www.aftenposten.no";

// Stoppordliste norsk bokmål
const stoppord = sw.nob;
const stoppordNynorsk = nno;

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
		// Henter url
		$("article:not([hidden])").each((index, element) => {
			const url = $(element).find('a').attr('href');
			if (url && url.startsWith(vgHjemmeside)) {
				nyheter.push(url)};
				}
            );

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
			nyheter.push(url);
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

		// Henter url
		$('.content-main-wrapper article').each((index, element) => {
			const url = $(element).attr('data-pulse-url') || $(element).find('a').attr('href');
			if (url && url.startsWith(aftenpostenHjemmeside)){
				nyheter.push(url);
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

		const informasjon = $.extract({
            nyhetsside: {
                selector: 'meta[property="og:site_name"]',
                value: 'content'
            },
            url: {
                selector: 'link[rel="canonical"]',
                value: 'href'
            },
            overskrift: 'h1',
            tidspunkt: {
                selector: 'meta[property="article:published_time"]',
                value: 'content'
            },
            journalist: ['#vg-byline a'],
            emner: [{
                selector: 'meta[property="article:tag"]',
                value: 'content'
            }]
        })

		const tekststykker = [];
		// Elementer som inneholder overskrifter (h1), avsnitt (p) og underoverskrifter (h2)
		const artikkelside = $('h1, .article-body > p, .article-body > h2');
		
		// Henter ut hvert ansnitt
		artikkelside.each((index, element) => {
			const ansnitt = $(element).text();
			tekststykker.push(ansnitt);
		});

		informasjon.tekst = tekststykker.join(" ");
		
		return informasjon
	} catch (err) {
		console.error(err);
	}
};

async function skrapNrkArtikkel(nettlenke) {
	try {
		const $ = await nettsideHTML(nettlenke);

		const informasjon = $.extract({
            nyhetsside: {
                selector: 'meta[property="og:site_name"]',
                value: 'content'
            },
            url: {
                selector: 'meta[property="og:url"]',
                value: 'content'
            },
            overskrift: 'h2.bulletin-title',
            tidspunkt: {
                selector: 'meta[property="article:published_time"]',
                value: 'content'
            },
            journalist: {
                selector: 'meta[name="author"]',
                value: 'content'
            }
        })

        informasjon.betalingsmur = false;

        informasjon.tekst = hentTekstNrk($);

		return informasjon
	} catch (err) {
		console.error(err);
	}
}

function hentTekstNrk($) {
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
    }

async function skrapAftenpostenArtikkel(nettlenke) {
	try {
		const $ = await nettsideHTML(nettlenke);

		const informasjon = $.extract({
            nyhetsside: {
                selector: 'meta[name="application-name"]',
                value: 'content'
            },
            url: {
                selector: 'meta[property="og:url"]',
                value: 'content'
            },
            overskrift: 'h1',
            tidspunkt: {
                selector: 'meta[property="article:published_time"]',
                value: 'content'
            },
            journalist: ['article span.byline-name'],
        });

        informasjon.betalingsmur = Boolean($('.paywall').text().trim(""));

        // Hent ut tekst
        const total = [];

		$('article').children("h1, h2, p, ul").each((index, element) => {
			const avsnitt = $(element).text();
			total.push(avsnitt);
		});

		informasjon.tekst = total.join(" ");

        return informasjon;
	} catch (err) {
		console.error(err);
	}
}

async function hentInfo(url) {
	try {
		const urlprefiks = "https://www.";

		let informasjon;

		switch (true) {
			case url.startsWith(urlprefiks +  + "nrk.no"):
				informasjon = await skrapNrkArtikkel(url)
				break;
			case url.startsWith(urlprefiks + "vg.no"):
				informasjon = await skrapVgArtikkel(url)
				break;
			case url.startsWith(urlprefiks + "aftenposten.no"):
				informasjon = await skrapAftenpostenArtikkel(url)
				break;
		}

		return informasjon
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

function fjernStoppord(tekst) {
	const tokenizer = new natural.AggressiveTokenizerNo();
	const ordliste = tokenizer.tokenize(tekst.toLowerCase());

	const filtrerteOrd = sw.removeStopwords(ordliste, stoppord)

	return filtrerteOrd
}

function nokkelord(tekst) {
	if (!Array.isArray(tekst)) {
		tekst = fjernStoppord(tekst)
	}

	const antallOrd = 5

	const ordteller = {}

	for (let ord of tekst) {
		if (ord in ordteller) {
			ordteller[ord] += 1
		} else {
			ordteller[ord] = 1
		}
	}

	// Ord sortert i synkende rekkefølge
	const listeAvListe = Object.entries(ordteller).sort((a, b) => b[1] - a[1])

	const mestBrukt = listeAvListe.slice(0, antallOrd)

	const mestBruktOrdliste = mestBrukt.map((ordpar) => {return ordpar[0]})

	return mestBruktOrdliste
}

async function main() {
	const stikkordliste = emneValg();

	const nyheterVg = await hentNyheterVg();
	const nyheterNrk = await hentNyheterNrk();
	const nyheterAftenposten = await hentNyheterAftenposten();

	const urlListe = nyheterVg.concat(nyheterNrk).concat(nyheterAftenposten);

	let relevantNytt = [];

	for (let url of urlListe) {
		const artikkel = await hentInfo(url);
	}

	// for (let nyhet of dagensOverskrifter) {
	// 	nyhet.tekst = await hentTekst(nyhet.lenke);
		
	// 	const matchendeStikkord = stikkord(stikkordliste, nyhet.tekst);

	// 	if (matchendeStikkord.length > 0) {
	// 		console.log(nyhet.lenke);
	// 	}
	// };
};

main();