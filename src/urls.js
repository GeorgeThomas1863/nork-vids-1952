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

  // console.log("KCNA WATCH HTML");
  // console.log(mainPageHTML);
  // const htmlModel = new scrapeKCNAWatchs
};

//!!!!!!!!
//HERE; EXTRACT 5PM and 8PM BROADCASTS AS SEPARATE ARRAYS IN mainPageObj
//!!!!!!!

export const parseMainPageHTML = async (html) => {
  // writeFileSync("mainPageHTML.html", html);
  // Parse the HTML using JSDOM

  const dom = new JSDOM(html);
  const document = dom.window.document;

  const articleArray = document.querySelectorAll("#archive_wrapper article");

  const pageArray = [];
  for (let i = 0; i < articleArray.length; i++) {
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

  //throws errors on fail
  const broadcastHeadText = await getBroadcastHead(article);
  const linkElement = await getLinkElement(article);

  const articleObj = {
    url: linkElement.href,
    title: linkElement.textContent.trim(),
    type: broadcastHeadText,
  };

  console.log("ARTICLE OBJ");
  console.log(articleObj);

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
