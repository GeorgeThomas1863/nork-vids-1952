import fs from "fs";

import CONFIG from "../config/config.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";
import { tgPostPicFS } from "./tg-api.js";

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
  const { thumbnailSavePath, vidSavePath, date, itemId } = inputObj;

  //check if vid and thumbnail downloaded
  if (!fs.existsSync(thumbnailSavePath) || !fs.existsSync(vidSavePath)) {
    const error = new Error("Vid or thumbnail NOT downloaded");
    error.function = "uploadVidFS";
    error.content = inputObj;
    throw error;
  }

  const dateNormal = new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

  //make an item NORMAL here (for label)

  //upload thumbnail
  const picParams = {
    picId: itemId,
    savePath: thumbnailSavePath,
    dateNormal: dateNormal,
  };

  const picData = await tgPostPicFS(picParams);

  //upload vid

  console.log("UPLOAD VID FS");
  console.log(inputObj);
};

export const tgPostPicFS = async (inputObj) => {
  const { picId, savePath, dateNormal } = inputObj;
  const { tgUploadId } = CONFIG;
  const token = tokenArray[tokenIndex];

  //build pic params
  const picParams = {
    chatId: tgUploadId,
    picPath: savePath,
  };

  const tgPicURL = `https://api.telegram.org/bot${token}/sendPhoto`;

  let picData = await tgPostPicReq(tgPicURL, picParams);
  const checkData = await checkToken(picData);

  //retry if bot fucked
  if (!checkData) picData = await tgPostPicReq(tgPicURL, picParams);

  //if still cant upload data throw error
  if (!picData || !picData.ok) {
    const error = new Error("UPLOAD PIC FUCKED");
    error.function = "tgPostPicFS";
    error.content = inputObj;
    throw error;
  }

  //build caption
  const caption = "<b>PIC: " + picId + ".jpg</b>" + "\n" + "<i>" + dateNormal + "</i>";

  //build edit caption params
  const editParams = {
    chat_id: picData.result.chat.id,
    message_id: picData.result.message_id,
    caption: caption,
    parse_mode: "HTML",
  };

  const paramObj = {
    params: editParams,
    command: "editMessageCaption",
  };

  //edit caption
  const editModel = new TgReq({ inputObj: paramObj });
  await editModel.tgPost(TgReq.tokenIndex);
  const storeObj = { ...inputObj, ...postData.result };

  //store pic Posted
  try {
    const storeModel = new dbModel(storeObj, CONFIG.picsUploaded);
    const storeData = await storeModel.storeUniqueURL();
    console.log("PIC " + picId + ".jpg UPLOADED AND STORED");
    console.log(storeData);
  } catch (e) {
    console.log(e.url + "; " + e.message + "; F BREAK: " + e.function);
  }
  return storeObj;
};
