// import axios from "axios";
// import * as cheerio from 'cheerio';
// import puppeteer from "puppeteer";
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
}

function scrapeVgForside() {
    try {
        const $ = cheerio.load("https://www.vg.no");
        const data = [];
        $("article:not([hidden]) .titles").each((index, element) => {
            let overskrift = $(element).text();
            overskrift = overskrift.replace(/\s*\n\s*/g, ' ').trim("");
            data.push(overskrift);
        })

        console.log(data);
    } catch(err) {
        console.error("Feil ved henting av data: ", err);
    }
}

function scrapeNrkForside() {
    try {
        const $ = cheerio.load("https://www.nrk.no");
        const data = [];
        $('kur-room__title').each((index, element) => {
            let overskrift = $(element).text().trim("");
            data.push(overskrift);
        })
        console.log(data.length, data);
    } catch (err) {
        console.error(err);
    }
}


function main() {
  const emner = emneValg()

  console.log("Du har valgt å lese om: ")
  emner.forEach(emne => {
      emne = emne.trim()
      console.log(emne)
  });
}

main()