import CONFIG from "../config/config.js";
import { scrapeState } from "./state.js";

//get urls
export const scrapeNewURLs = async () => {
//   if (!scrapeState.scrapeActive) return null;

  const mainPageData = await getMainPageData();
};

export const getMainPageData = async () => {
  const { kcnaWatchURL } = CONFIG;

  console.log("KCNA WATCH URL");
  console.log(kcnaWatchURL);
  // const htmlModel = new scrapeKCNAWatch
};
