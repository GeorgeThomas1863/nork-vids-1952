import Log from "../models/log-model.js";
import { scrapeNewURLs } from "./urls.js";

//!!! HERE
//BUILD ADMIN COMMAND
export const runAdminCommand = async (inputParams) => {
  const { commandType } = inputParams;

  console.log("INPUT PARAMS");
  console.log(inputParams);

  let data = {};
  switch (commandType) {
    case "admin-start-scrape":
      data = await scrapeKCNAWatch();
      break;
    // case "admin-stop-scrape":
    //   await scrapeKCNAWatch();
    //   break;
  }

  console.log("DATA");
  console.log(data);

  return data;
};

export const scrapeKCNAWatch = async () => {
  const logStartModel = new Log();
  await logStartModel.logStart();

  await scrapeNewURLs();

  const logStopModel = new Log();
  await logStopModel.logStop();
};
