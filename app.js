//TO DO:
// REBUILD DOWNLOAD
// UPLOAD DIDNT WORK FROM THE BEGINNING, rebuild for scraper too

//VID UPLOAD NOT QUITE WORKING, FIGURE OUT ERROR
//STORE VID UPLOAD DATA

// BUILD UPLOAD

import CONFIG from "./config/config.js";
import express from "express";
import cors from "cors";

import routes from "./routes/router.js";
import * as db from "./config/db.js";

// import { scrapeKCNAWatch } from "./src/scrape-control.js";

//FIRST CONNECT TO DB
// (need this HERE bc main function will execute before express and fuck everything)
await db.dbConnect();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors());

app.use(routes);

//SCRAPE TEST (disable later)
// await scrapeKCNAWatch();

//PORT to listen
app.listen(CONFIG.vidPort);

//CATCH CODE (for ref)
// console.log(e.url + "; " + e.message + "; F BREAK: " + e.function);
