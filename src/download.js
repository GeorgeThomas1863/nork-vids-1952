import fs from "fs";
import CONFIG from "../config/config.js";
import KCNA from "../models/kcna-model.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";

export const downloadNewVids = async () => {
  await getNewVidData();
  await downloadNewVidArray();

  console.log("FINISHED DOWNLOADING NEW VIDS");
  return true;
};

export const getNewVidData = async () => {
  if (!scrapeState.scrapeActive) return null;
  const { kcnaWatchContent } = CONFIG;

  //calc which items dont have vid data (or the vid data sucks)
  const vidDataModel = new dbModel("", kcnaWatchContent);
  const vidDataArray = await vidDataModel.getAll();
  if (!vidDataArray || !vidDataArray.length) return null;

  const newVidData = await parseVidDataArray(vidDataArray);

  return newVidData;
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
  const { kcnaWatchContent } = CONFIG;
  const { vidURL } = inputObj;

  const headerModel = new KCNA({ url: vidURL });
  const headerData = await headerModel.getMediaHeaders();

  //throw error if cant get headers
  if (!headerData) {
    const error = new Error("HEADER GET ATTEMPTS FAILED");
    error.function = "getVidData";
    error.content = inputObj;
    throw error;
  }

  const vidData = await parseHeaderData(headerData);

  if (!vidData) {
    const error = new Error("CANT PARSE HEADER DATA");
    error.function = "getVidData";
    error.content = headerData;
    throw error;
  }

  const updateParams = {
    keyToLookup: "vidURL",
    itemValue: vidURL,
    insertKey: "vidData",
    updateObj: vidData,
  };

  const updateModel = new dbModel(updateParams, kcnaWatchContent);
  const updateData = await updateModel.updateObjInsert();

  console.log("UPDATE DATA");
  console.log(updateData);

  return vidData;
};

export const parseHeaderData = async (inputData) => {
  if (!inputData) return null;
  const { vidChunkSize } = CONFIG;

  const contentRange = inputData["content-range"];

  const vidSizeBytes = +contentRange.split("/")[1];
  const vidSizeMB = Math.round(vidSizeBytes / (1024 * 1024));
  const downloadChunks = Math.ceil(vidSizeBytes / vidChunkSize);

  const etag = inputData.etag;
  const serverData = inputData.server;
  const vidEditDate = new Date(inputData["last-modified"]);

  const headerObj = {
    vidSizeBytes: vidSizeBytes,
    vidSizeMB: vidSizeMB,
    downloadChunks: downloadChunks,
    etag: etag,
    serverData: serverData,
    vidEditDate: vidEditDate,
  };

  console.log("HEADER OBJ");
  console.log(headerObj);

  return headerObj;
};

//------------------------

export const downloadNewVidArray = async () => {
  if (!scrapeState.scrapeActive) return null;
  const { kcnaWatchDownloaded, kcnaWatchContent } = CONFIG;

  const newItemParams = {
    collection1: kcnaWatchContent,
    collection2: kcnaWatchDownloaded,
  };

  const newItemModel = new dbModel(newItemParams, "");
  const downloadArray = await newItemModel.findNewURLs();
  if (!downloadArray || !downloadArray.length) return null;

  const downloadDataArray = [];
  for (let i = 0; i < downloadArray.length; i++) {
    if (!scrapeState.scrapeActive) return null;
    try {
      const downloadObj = downloadArray[i];
      const { type } = downloadObj;

      //double check not already downloaded (shouldnt happen)
      const checkModel = new dbModel(downloadObj, kcnaWatchDownloaded);
      const checkData = await checkModel.urlNewCheck();
      if (!checkData) continue;

      //skip full broadcasts
      if (type === "Full Broadcast") continue;

      //download thumbnail; then download vid
      const thumbnailObj = await downloadThumbnailFS(downloadObj);
      const vidReturnObj = await downloadVidFS(downloadObj);

      //if either fail dont save
      if (!thumbnailObj || !vidReturnObj) continue;

      const storeObj = { ...downloadObj, ...thumbnailObj, ...vidReturnObj };

      //store it
      const storeModel = new dbModel(storeObj, kcnaWatchDownloaded);
      const storeData = await storeModel.storeUniqueURL();

      console.log("DOWNLOAD STORE DATA");
      console.log(storeData);

      downloadDataArray.push(storeObj);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return downloadDataArray;
};

export const downloadVidFS = async (inputObj) => {
  if (!inputObj || !inputObj.vidURL || !inputObj.vidData) return null;
  const { vidURL, vidData, vidName } = inputObj;
  const { vidSizeBytes, downloadChunks } = vidData;
  const { watchPath, tempPath } = CONFIG; //get temp path once and put in obj

  // Create the sub folder to save all chunks in
  //DO LATER
  // if (!fs.existsSync(vidSaveFolder)) {
  //   fs.mkdirSync(vidSaveFolder, { recursive: true });
  // }

  //download output path
  const vidSavePath = `${watchPath}${vidName}.mp4`;

  const params = {
    url: vidURL,
    tempPath: tempPath,
    vidSavePath: vidSavePath,
    downloadChunks: downloadChunks,
    vidSizeBytes: vidSizeBytes,
    vidName: vidName,
  };

  const vidModel = new KCNA(params);
  const vidObj = await vidModel.downloadVidMultiThread();
  if (!vidObj) return null;

  //RECHUNK THE SHIT HERE

  //HERE CHANGE BELOW BASED ON WHATS IN CONSOLE
  const returnObj = {
    vidDownloaded: true,
    vidSavePath: vidSavePath,
    chunksProcessed: vidObj.chunksProcessed,
  };

  return returnObj;
};

export const downloadThumbnailFS = async (inputObj) => {
  if (!inputObj || !inputObj.thumbnail) return null;
  const { thumbnail, vidName } = inputObj;
  const { watchPath } = CONFIG;

  // const nameStart = thumbnail.lastIndexOf("/");
  // const nameEnd = thumbnail.lastIndexOf(".");
  // const picName = thumbnail.substring(nameStart + 1, nameEnd);

  const savePath = `${watchPath}${vidName}.jpg`;

  //build params
  const params = {
    url: thumbnail,
    savePath: savePath,
    picId: vidName,
  };

  // console.log("PIC PARAMS");
  // console.log(params);

  const picModel = new KCNA(params);
  const picObj = await picModel.downloadPicReq();
  if (!picObj) return null;

  const returnObj = {
    thumbnailDownloaded: true,
    thumbnailSavePath: picObj.savePath,
    thumbnailDownloadedSize: picObj.downloadedSize,
  };

  return returnObj;
};
