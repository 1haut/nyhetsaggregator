const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');
const fs = require('node:fs');

// Hjemmesider
const vgHjemmeside = "https://www.vg.no";
const nrkHjemmeside = "https://www.nrk.no";
const aftenpostenHjemmeside = "https://www.aftenposten.no";

// Initialiser tokeniserer 
const tokenizer = new natural.AggressiveTokenizerNo();

const cacheResultatFilbane = "cache/resultat.json";
const cacheArtikkelFilbane = "cache/artikler.json";

// Caching
const cache = lesCache(cacheResultatFilbane);
const cacheArtikler = lesCache(cacheArtikkelFilbane);

const cachingKapasitet = 1000;


async function nettsideHTML(url) {
    try {
        // Hent og returner nettsidestruktur
        const { data } = await axios.get(url);
        const htmlMarkup = cheerio.load(data);

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
                    nyheter.push(url.split("?")[0]);
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

        // Hent ut informasjon om artikkelen
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
            overskrift: 'title',
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
};

function hentTekstNrk($) {
    // Skille mellom nyhetsmeldinger og artikler
    const finnesNyhetsmelding = $('article').attr('data-ec-name');
    if (finnesNyhetsmelding) {
        const tekst = $('.bulletin-title, .bulletin-text-body').text();

        return tekst
    } else {
        const total = [];

        // Overskrift og ingress
        const topptekst = $('article header').text().replace(/\r?\n|\r/g, " ");

        // Underoverskrifter og tekst
        const artikkelelement = $("div[data-ec-name='brødtekst']").children('h2, p');

        // 
        $(artikkelelement).find('span[aria-hidden="true"]').text("");

        artikkelelement.each((index, element) => {
            const avsnitt = $(element).text().trim();
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
        // Sjekk om paywall-klassen har innhold
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
        oppdaterCache(cacheArtikler, cacheArtikkelFilbane);
        console.log(`Url som feilet: ${url}`);
        console.error(err);
    }
};

function stikkord(emner, fullTekst) {
    // Tokeniser tekst
    const ordliste = tokenizer.tokenize(fullTekst.toLowerCase());

    // Lager en liste over 
    const stikkordmatch = [];
    for (let ord of emner) {
        ord = ord.toLowerCase();
        if (ordliste.includes(ord)) {
            stikkordmatch.push(ord);
        }
    }

    return stikkordmatch
}

function lesCache(filbane){
    try {
        const JSONinnhold = fs.readFileSync(filbane, "utf-8");
        // Konverter fra JSON til objekt
        const objekt = JSON.parse(JSONinnhold);
        // Konverter fra objekt til mappe
        const mappe = new Map(Object.entries(objekt));
        
        return mappe
    } catch (error) {
        // Tom mappe
        return new Map()
    }
}

function oppdaterCache(cache, filbane) {
    // Søker rekursivt om cache-mappen eksistere, hvis ikke lag ny mappe
    fs.mkdir('cache', { recursive: true }, (err) => {
        if (err) throw err;
    });

    fs.writeFileSync(filbane, JSON.stringify(Object.fromEntries(cache)), {flag: "w+"});
}

async function main(sokeord) {
    const emner = sokeord.split(",").map(item => item.trim())
    const nokkel = sokeord.replaceAll(' ', '');
    const ttl = 1000 * 60 * 60 * 1; // en time
    const tid = Date.now();

    if (cache.has(nokkel)) {
        const { tidsmerke } = cache.get(nokkel);
        if (tid - tidsmerke < ttl){
            return cache.innhold;
        }
    }

    const urlListe = await hentUrler();

    const relevantNytt = [];
    for (let url of urlListe) {
        let artikkel;
        if (cacheArtikler.has(url)) {
            artikkel = cacheArtikler.get(url);
        } else {
            if (cachingKapasitet >= cacheArtikler.size) {
                const forsteArtikkelNokkel = cacheArtikler.keys().next().value;
                cacheArtikler.delete(forsteArtikkelNokkel);
            }
            artikkel = await hentInfo(url);
            cacheArtikler.set(url, artikkel);
        }

        const matchendeStikkord = stikkord(emner, artikkel.tekst);

        if (matchendeStikkord.length > 0) {
            relevantNytt.push({
                url: url,
                overskrift: artikkel.overskrift,
                stikkord: matchendeStikkord,
                dato: artikkel.tidspunkt
            })
        }
    }

    cache.clear();
    cache.set(nokkel, {tidsmerke: tid, innhold: relevantNytt});
    oppdaterCache(cache, cacheResultatFilbane);
    oppdaterCache(cacheArtikler, cacheArtikkelFilbane);

    return relevantNytt
}


module.exports = {
    main
}