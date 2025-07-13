import CONFIG from "../config/config.js";
import KCNA from "../models/kcna-model.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";

export const downloadNewVids = async () => {
  await getNewVidData();
  await downloadNewVidArray();
};

export const getNewVidData = async () => {
  if (!scrapeState.scrapeActive) return null;
  const { kcnaWatchContent } = CONFIG;

  //calc which items dont have vid data (or the vid data sucks)
  const vidDataModel = new dbModel("", kcnaWatchContent);
  const vidDataArray = await vidDataModel.getAll();
  if (!vidDataArray || !vidDataArray.length) return null;

  const newVidData = await parseVidDataArray(vidDataArray);
};

export const parseVidDataArray = async (inputArray) => {
  if (!inputArray || !inputArray.length) return null;

  //loop through array
  const vidDataArray = [];
  for (let i = 0; i < inputArray.length; i++) {
    if (!scrapeState.scrapeActive) return vidDataArray;
    try {
      const pageObj = inputArray[i];

      //MAKE MORE ROBUST
      if (pageObj && pageObj.vidData) continue;
      //otherwise get vid data
      const vidData = await getVidData(pageObj);
      if (!vidData) continue;

      vidDataArray.push(vidData);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return vidDataArray;
};

export const getVidData = async (inputObj) => {
  if (!inputObj || !inputObj.vidURL) return null;

  //   console.log("GET VID DATA");
  //   console.log(inputObj);

  const headerModel = new KCNA({ url: inputObj.vidURL });
  const headerData = await headerModel.getMediaHeaders();

  //throw error if cant get headers
  if (!headerData) {
    const error = new Error("HEADER GET ATTEMPTS FAILED");
    error.function = "getVidData";
    error.content = inputObj;
    throw error;
  }

  const vidData = await parseHeaderData(headerData);

  return null;
};

export const parseHeaderData = async (inputData) => {
  if (!inputData) return null;

  console.log("HEADER DATA");
  console.log(inputData);
};

//------------------------

export const downloadNewVidArray = async () => {};
