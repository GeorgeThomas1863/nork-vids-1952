import { writeFileSync } from "fs";

import { JSDOM } from "jsdom";
import CONFIG from "../config/config.js";
import KCNA from "../models/kcna-model.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";

//get urls
export const scrapeNewURLs = async () => {
  if (!scrapeState.scrapeActive) return null;

  console.log("SCRAPING NEW URLS");
  const mainPageUrls = await getMainPageUrls();
  console.log("MAIN PAGE URLS");
  console.log(mainPageUrls);

  const mainPageContent = await getMainPageContent();
};

export const getMainPageUrls = async () => {
  if (!scrapeState.scrapeActive) return null;
  const { kctvArchive } = CONFIG;

  const htmlModel = new KCNA({ url: kctvArchive });
  const mainPageHTML = await htmlModel.getHTML();

  // console.log("MAIN PAGE HTML");
  // console.log(mainPageHTML);

  const mainPageArray = await parseMainPageHTML(mainPageHTML);

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
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.article} \n\n --------------------------------\n`);
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
    error.function = "getBroadcastHead";
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
    error.function = "getLinkElement";
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
    error.function = "getDateObj";
    error.article = article;
    throw error;
  }

  const dateText = h4Element.textContent.trim();
  const dateObj = new Date(dateText);

  const scrapeHour = scrapeStartTime.getHours();
  const scrapeMinute = scrapeStartTime.getMinutes();

  dateObj.setHours(scrapeHour);
  dateObj.setMinutes(scrapeMinute);

  return dateObj;
};

//------------------------------------

export const getMainPageContent = async () => {
  if (!scrapeState.scrapeActive) return null;
  const { kcnaWatchList, kcnaWatchContent } = CONFIG;

  const newItemParams = {
    collection1: kcnaWatchList,
    collection2: kcnaWatchContent,
  };

  const newItemModel = new dbModel(newItemParams, kcnaWatchList);
  const downloadArray = await newItemModel.findNewURLs();

  const pageContentArray = await buildPageContentArray(downloadArray);

  // console.log("CONTENT ARRAY");
  // console.log(pageContentArray);

  return pageContentArray;
};

export const buildPageContentArray = async (inputArray) => {
  if (!inputArray || !inputArray.length) return null;

  //loop (dont check if stored since inputArray based on mongo compare earlier)
  const pageObjArray = [];
  for (let i = 0; i < inputArray.length; i++) {
    //stop if needed
    if (!scrapeState.scrapeActive) return pageObjArray;
    try {
      const pageObj = await buildPageObj(inputArray[i]);
      if (!pageObj) continue;
      pageObjArray.push(pageObj);
    } catch (e) {
      //  console.log(e.url + "; " + e.message + "; F BREAK: " + e.function);
    }
  }
};

export const buildPageObj = async (inputObj) => {
  if (!inputObj || !inputObj.url) return null;
  const { url, title } = inputObj;

  const htmlModel = new KCNA({ url: url });
  const pageHTML = await htmlModel.getHTML();

  // console.log("PAGE HTML");
  // console.log(pageHTML);

  const pageObj = await parsePageHTML(pageHTML, title);

  // const pageObj = {
  //   url,
  //   title,
  // };

  console.log("INPUT OBJ");
  console.log(inputObj);

  return pageObj;
};

export const parsePageHTML = async (html, title) => {
  // if (!html) return null;
  writeFileSync(`${title}.html`, html);
};
