import { JSDOM } from "jsdom";
import CONFIG from "../config/config.js";
import KCNA from "../models/kcna-model.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";

//get urls
export const scrapeNewURLs = async () => {
  if (!scrapeState.scrapeActive) return null;

  console.log("SCRAPING NEW URLS");
  await getMainPageUrls();
  await getMainPageContent();
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

  // console.log("ARTICLE OBJ");
  // console.log(articleObj);

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
      const pageContentObj = await buildPageObj(inputArray[i]);
      if (!pageContentObj) continue;
      pageObjArray.push(pageContentObj);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return pageObjArray;
};

export const buildPageObj = async (inputObj) => {
  if (!inputObj || !inputObj.url) return null;
  const { kcnaWatchContent } = CONFIG;
  const { url } = inputObj;

  const htmlModel = new KCNA({ url: url });
  const pageHTML = await htmlModel.getHTML();

  const pageObj = await parsePageHTML(pageHTML);
  if (!pageObj) return null;

  const contentObj = { ...inputObj, ...pageObj };

  //store it
  const storeModel = new dbModel(contentObj, kcnaWatchContent);
  const storeData = await storeModel.storeUniqueURL();
  console.log("STORE KCNA WATCH CONTENT");
  console.log(storeData);

  return contentObj;
};

export const parsePageHTML = async (html) => {
  if (!html) return null;

  const dom = new JSDOM(html);
  const document = dom.window.document;

  //get array of scripts
  const scriptArray = document.querySelectorAll("script");

  //parse each script
  for (let i = 0; i < scriptArray.length; i++) {
    if (!scrapeState.scrapeActive) return null;
    const script = scriptArray[i];
    const scriptText = script.textContent;
    if (!scriptText || !scriptText.includes(".mp4")) continue;

    //returns vidURL and thumbnail as obj
    const pageObj = await parseScriptText(scriptText);
    // console.log("PAGE OBJ");s
    // console.log(pageObj);

    //only 1 script with right info so immediately return
    return pageObj;
  }

  //throw error if cant find script
  const error = new Error("CANT FIND SCRIPT WITH RIGHT INFO");
  error.function = "parsePageHTML";
  error.content = html;
  throw error;
};

export const parseScriptText = async (scriptText) => {
  if (!scriptText) return null;
  const vidStart = scriptText.indexOf("progressive: ") + 14;
  const vidEnd = scriptText.indexOf(".mp4", vidStart) + 4;
  const vidURL = scriptText.substring(vidStart, vidEnd).trim();

  const thumbStart = scriptText.indexOf("poster: ") + 9;
  const thumbEnd = scriptText.indexOf(".jpg", thumbStart) + 4;
  const thumbnail = scriptText.substring(thumbStart, thumbEnd).trim();

  //throw error if cant parse
  if (!vidURL || !thumbnail) {
    const error = new Error("CANT PARSE SCRIPT TEXT");
    error.function = "parseScriptText";
    error.content = scriptText;
    throw error;
  }

  const returnObj = {
    vidURL: vidURL,
    thumbnail: thumbnail,
  };

  return returnObj;
};
