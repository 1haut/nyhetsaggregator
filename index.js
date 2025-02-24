// import axios from "axios";
// import * as cheerio from 'cheerio';
// import puppeteer from "puppeteer";
import readline from 'node:readline/promises';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

async function emneValg() {     
      const brukerSvar = await rl.question('Hvilke emner har du lyst til å lese om? ');
      const stikkord = brukerSvar.split(",")
      rl.close()
      
      console.log("Du har valgt å lese om: ")
      stikkord.forEach(emne => {
          emne = emne.trim()
          console.log(emne)
      });
}

emneValg()