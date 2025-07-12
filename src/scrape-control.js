import Log from "../models/log-model.js";
import { scrapeNewURLs } from "./urls.js";

export const scrapeKCNAWatch = async () => {
  const logStartModel = new Log();
  await logStartModel.logStart();

  await scrapeNewURLs();

  const logStopModel = new Log();
  await logStopModel.logStop();
};
