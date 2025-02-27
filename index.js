import axios from "axios";
import * as cheerio from 'cheerio';
import puppeteer from "puppeteer";
import readline from 'node:readline/promises';

async function emneValg() { 
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const brukerSvar = await rl.question('Hvilke emner har du lyst til å lese om? ');
  const stikkord = brukerSvar.split(",")
  rl.close()
  
  return stikkord
};

function brukerInput() {
	const emner = emneValg();

  console.log("Du har valgt å lese om: ")
  emner.forEach(emne => {
      emne = emne.trim()
      console.log(emne)
  });
};

async function hentNyheterVg() {
    try {
				const html = await axios.get("https://www.vg.no")
        const $ =  cheerio.load(html);
				const nyheter = [];

        $("article:not([hidden])").each((index, element) => {
					const overskrift = $(element).find('.titles').text();
					const url = $(element).find('a').attr('href');
					overskrift = overskrift.replace(/\s*\n\s*/g, ' ').trim("");
					if (url && !(url.startsWith("https://tv.vg.no"))) {
						nyheter.push({
								nyhetsside: 'VG',
								tittel: overskrift,
								lenke: url
								})};
							});

				return nyheter		
    } catch(err) {
        console.error("Feil ved henting av data: ", err);
    }
};

async function hentNyheterNrk() {
		try {
				const html = await axios.get("https://www.nrk.no");
				const $ = cheerio.load(html);
				const nyheter = [];

				$('.kur-room:not([data-ec-id="https://radio.nrk.no/"])').each((index, element) => {
					const url = $(element).find('a').attr('href');
					const overskrift = $(element).find('.kur-room__title').text().trim("");
					nyheter.push({
						nyhetsside: "NRK",
						tittel: overskrift,
						lenke: url
					})
			});

			return nyheter
		} catch (err) {
				console.error("Feil ved henting av data: ", err);
		}
};

async function hentNyheterAftenposten() {
		try {
				const html = await axios.get("https://www.aftenposten.no/");
				const $ = cheerio.load(html);
				const nyheter = [];

				$('.content-main-wrapper article a').each((index, element) => {
					const overskrift = $(element).find('.title').text();
					const url = $(element).attr('href');
					saker.push({
						nyhetsside: 'Aftenposten',
						tittel: overskrift,
						lenke: url
					});
				});

				return nyheter
		} catch (err) {
				console.error("Feil ved henting av data: ", err);
		}
};




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