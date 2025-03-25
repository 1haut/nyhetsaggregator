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

// Stoppordlister
const stoppord = sw.nob;
const stoppordNynorsk = nno;

// 
const cacheAdresse = "cache/resutat.json";

// Initialiser tokeniserer 
const tokenizer = new natural.AggressiveTokenizerNo();

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
		// Hent og returner nettsidestruktur
		const html = await axios.get(url);
		const htmlMarkup = cheerio.load(html);

		return htmlMarkup
	} catch (err) {
		console.error(err);
	}
}

async function hentUrler() {
    const nettsider = [vgHjemmeside, nrkHjemmeside, aftenpostenHjemmeside];
    const selektorer = [
        'article:not([hidden])', 
        '.kur-room:not([data-ec-id="https://radio.nrk.no/"])', 
        '.content-main-wrapper article'
    ];

    const nyheter = [];

    try {
		// For hver nyhetsside, hent url
        for (let i = 0; i < nettsider.length; i++) {  
            const nettside = nettsider[i];
            const selektor = selektorer[i];
    
            const $ = await nettsideHTML(nettside);
    
            $(selektor).each((index, element) => {
                const url = $(element).find('a').attr('href');
                if (url && url.startsWith(nettside)) {
                    nyheter.push(url);
                }
            })
        }
    
        return nyheter
    } catch (err) {
        console.error("Error fetching data: ", err)
    }
}

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
		
		return informasjon;
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
		// NRK har heldigvis ikke betalingsmurer
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
		const total = [];

		// Overskrift og ingress
        const topptekst = $('article header');

		// Underoverskrifter og tekst
        const artikkelelement = $("div[data-ec-name='brødtekst']").children('h2, p');

		// 
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
		let informasjon;

		switch (true) {
			case url.startsWith(nrkHjemmeside):
				informasjon = await skrapNrkArtikkel(url);
				break;
			case url.startsWith(vgHjemmeside):
				informasjon = await skrapVgArtikkel(url);
				break;
			case url.startsWith(aftenpostenHjemmeside):
				informasjon = await skrapAftenpostenArtikkel(url);
				break;
		}

		return informasjon
	} catch (err) {
		console.log(`Url som feilet: ${url}`);
		console.error(err);
	}
};

function stikkord(emner, fullTekst) {
	// Tokeniser tekst
	const ordliste = tokenizer.tokenize(fullTekst.toLowerCase());

	//
	const stikkordmatch = [];
    for (let ord of emner) {
        ord = ord.toLowerCase();
        if (ordliste.includes(ord)) {
            stikkordmatch.push(ord);
        }
    }

    return stikkordmatch
}

function fjernStoppord(tekst) {
	const ordliste = tokenizer.tokenize(tekst.toLowerCase());

	const filtrerteOrd = sw.removeStopwords(ordliste, stoppord)

	return filtrerteOrd
}

async function sov(sekunder){
	await new Promise ((res) => setTimeout(res, sekunder * 1000));
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
	const listeAvListe = Object.entries(ordteller).sort((a, b) => b[1] - a[1]);

	const mestBrukt = listeAvListe.slice(0, antallOrd);

	const mestBruktOrdliste = mestBrukt.map(ordpar => ordpar[0]);

	return mestBruktOrdliste
}

function lesCache(){
	try {
		const JSONinnhold = fs.readFileSync(dirPath, "utf-8");

		const objekt = JSON.parse(JSONinnhold);

		const mappe = new Map(Object.entries(objekt));
		
		return mappe
	} catch (error) {
		return new Map()
	}
}

function oppdaterCache(cache) {
	fs.mkdir('ekstra', { recursive: true }, (err) => {
		if (err) throw err;
	});

	fs.writeFileSync(dirPath, JSON.stringify(Object.fromEntries(cache)), {flag: "w+"});
}


async function output() {
	const brukerEmner = await emneValg();

	const urlListe = await hentUrler();

	let relevantNytt = [];

	for (let url of urlListe) {
		const artikkel = await hentInfo(url);

		const matchendeStikkord = stikkord(brukerEmner, artikkel.tekst);

		if (matchendeStikkord.length > 0) {
			relevantNytt.push({
				url: url,
				overskrift: artikkel.overskrift,
				stikkord: matchendeStikkord
			})
		}
	}
};

function toCache(sokeord, ttl = 1 * 60 * 60 * 1000){
    const cache = readCache();

    const tid = Date.now();

    const nokkel = sokeord.join(",");

    if (cache.has(nokkel)) {
        const { tidsmerke } = cache.get(nokkel);
        if (tid - tidsmerke < ttl){
            console.log("Fetching from cache");
            return cache;
        }
    }
    console.log("Grabbing result")
    cache.clear();
    const resultat = output();
    cache.set(nokkel, {tidsmerke: tid, emner: sokeord, innhold: resultat})

    oppdaterCache(cache)
};