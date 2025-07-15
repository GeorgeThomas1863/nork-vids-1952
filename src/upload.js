import CONFIG from "../config/config.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";

export const uploadNewVids = async () => {
  const { kcnaWatchDownloaded, kcnaWatchUploaded } = CONFIG;
  if (!scrapeState.scrapeActive) return null;

  const newVidParams = {
    collection1: kcnaWatchDownloaded,
    collection2: kcnaWatchUploaded,
  };

  const newVidModel = new dbModel(newVidParams, "");
  const newVidArray = await newVidModel.findNewURLs();
  if (!newVidArray || !newVidArray.length) return null;

  const vidUploadData = await uploadVidArray(newVidArray);

  return vidUploadData;
};

export const uploadVidArray = async (inputArray) => {
  if (!inputArray || !inputArray.length) return null;

  const uploadDataArray = [];
  for (let i = 0; i < inputArray.length; i++) {
    if (!scrapeState.scrapeActive) return null;
    try {
      const vidDataObj = await uploadVidFS(inputArray[i]);
      if (!vidDataObj) continue;

      uploadDataArray.push(vidDataObj);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return uploadDataArray;
};

export const uploadVidFS = async (inputObj) => {
  if (!inputObj) return null;

  console.log("UPLOAD VID FS");
  console.log(inputObj);
};
