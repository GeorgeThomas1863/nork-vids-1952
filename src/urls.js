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

  console.log("KCNA WATCH URL");
  console.log(htmlModel);
  // const htmlModel = new scrapeKCNAWatch
};
