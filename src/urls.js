// import { writeFileSync } from "fs";

import { JSDOM } from "jsdom";
import CONFIG from "../config/config.js";
import KCNA from "../models/kcna-model.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";

//get urls
export const scrapeNewURLs = async () => {
  if (!scrapeState.scrapeActive) return null;

  console.log("SCRAPING NEW URLS");
  const mainPageData = await getMainPageData();
};

export const getMainPageData = async () => {
  if (!scrapeState.scrapeActive) return null;
  const { kctvArchive } = CONFIG;

  const htmlModel = new KCNA({ url: kctvArchive });
  const mainPageHTML = await htmlModel.getHTML();

  console.log("MAIN PAGE HTML");
  console.log(mainPageHTML);

  const mainPageArray = await parseMainPageHTML(mainPageHTML);

  console.log("MAIN PAGE ARRAY");
  console.log(mainPageArray);

  return mainPageArray;
};

export const parseMainPageHTML = async (html) => {
  // writeFileSync("mainPageHTML.html", html);
  // Parse the HTML using JSDOM

  const dom = new JSDOM(html);
  const document = dom.window.document;

  const articleArray = document.querySelectorAll("#archive_wrapper article");

  const pageArray = [];
  for (let i = 0; i < articleArray.length; i++) {
    if (!scrapeState.scrapeActive) return null;
    try {
      const articleObj = await getArticleObj(articleArray[i]);
      if (!articleObj) continue;
      pageArray.push(articleObj);
    } catch (e) {
      console.log(`ERROR! ${e.message} \n --------------------------------\n`);
      console.log(`ARTICLE HTML: ${e.article} \n --------------------------------\n`);
      continue;
    }
  }

  return pageArray;
};

export const getArticleObj = async (article) => {
  if (!article) return null;
  const { kcnaWatchList } = CONFIG;

  //throws errors on fail
  const broadcastHeadText = await getBroadcastHead(article);
  const linkElement = await getLinkElement(article);
  const dateObj = await getDateObj(article);
  const baseURL = "https://kcnawatch.org";

  const articleObj = {
    url: baseURL + linkElement.href,
    title: linkElement.textContent.trim(),
    date: dateObj,
    type: broadcastHeadText,
  };

  console.log("ARTICLE OBJ");
  console.log(articleObj);

  //store it
  const storeModel = new dbModel(articleObj, kcnaWatchList);
  const storeData = await storeModel.storeUniqueURL();
  console.log("STORE KCNA WATCH LIST");
  console.log(storeData);

  return articleObj;
};

export const getBroadcastHead = async (article) => {
  const broadcastHead = article.querySelector(".broadcast-head");
  if (!broadcastHead || !broadcastHead.textContent) {
    const error = new Error("CANT EXTRACT BROADCAST HEAD FROM ARTICLE");
    error.article = article;
    throw error;
  }

  const broadcastHeadText = broadcastHead.textContent.trim();
  return broadcastHeadText;
};

export const getLinkElement = async (article) => {
  const linkElement = article.querySelector("h4 a");
  if (!linkElement) {
    const error = new Error("CANT EXTRACT LINK FROM ARTICLE");
    error.article = article;
    throw error;
  }

  return linkElement;
};

export const getDateObj = async (article) => {
  const { scrapeStartTime } = scrapeState;
  const h4Element = article.querySelector("h4 a");
  if (!h4Element || !h4Element.textContent) {
    const error = new Error("CANT EXTRACT DATE FROM ARTICLE");
    error.article = article;
    throw error;
  }

  const dateText = h4Element.textContent.trim();
  const dateObj = new Date(dateText);

  const scrapeHour = scrapeStartTime.getHours();
  const scrapeMinute = scrapeStartTime.getMinutes();

  dateObj.setHours(scrapeHour);
  dateObj.setMinutes(scrapeMinute);

  console.log("DATE TEXT");
  console.log(dateText);

  return dateObj;
};
