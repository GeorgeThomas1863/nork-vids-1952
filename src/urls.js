import { writeFileSync } from "fs";

import { JSDOM } from "jsdom";
import CONFIG from "../config/config.js";
import KCNA from "../models/kcna-model.js";
import { scrapeState } from "./state.js";

//get urls
export const scrapeNewURLs = async () => {
  //   if (!scrapeState.scrapeActive) return null;

  const mainPageData = await getMainPageData();
};

export const getMainPageData = async () => {
  const { kcnaWatchURL } = CONFIG;

  const htmlModel = new KCNA({ url: kcnaWatchURL });
  const mainPageHTML = await htmlModel.getHTML();

  const mainPageObj = await parseMainPageHTML(mainPageHTML);

  console.log("KCNA WATCH HTML");
  console.log(mainPageHTML);
  // const htmlModel = new scrapeKCNAWatchs
};

export const parseMainPageHTML = async (html) => {
  writeFileSync("mainPageHTML.html", html);
  // Parse the HTML using JSDOM
  // const dom = new JSDOM(html);
  // const document = dom.window.document;
};
