import fs from "fs";
import CONFIG from "../config/config.js";
import KCNA from "../models/kcna-model.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";
import { exec } from "child_process";
import { promisify } from "util";

//some promises thing to run ffmpeg
const execPromise = promisify(exec);

export const downloadNewVids = async () => {
  await getNewVidData();
  // await downloadNewVidArray();

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
  const { vidURL, type } = inputObj;
  const { kcnaWatchContent } = CONFIG;

  //dont waste time getting headers for full
  if (type === "Full Broadcast") return null;

  const headerModel = new KCNA({ url: vidURL });
  const headerData = await headerModel.getMediaHeaders();

  //throw error if cant get headers
  if (!headerData) {
    const error = new Error("HEADER GET ATTEMPTS FAILED");
    error.function = "getVidData";
    error.content = inputObj;
    throw error;
  }

  const headerObj = await parseHeaderData(headerData);

  if (!headerObj) {
    const error = new Error("CANT PARSE HEADER DATA");
    error.function = "getVidData";
    error.content = headerData;
    throw error;
  }

  //get vid length using ffmpeg
  const vidLengthObj = await getVidLength(vidURL);

  //throw error if cant get vid length
  if (!vidLengthObj) {
    const error = new Error("CANT GET VID LENGTH");
    error.function = "getVidLength";
    error.content = headerData;
    throw error;
  }

  const vidData = { ...headerObj, ...vidLengthObj };

  console.log("VID DATA");
  console.log(vidData);

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

  //TURN BACK ON
  return vidData;
};

export const getVidLength = async (inputURL) => {
  if (!inputURL) return null;

  const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputURL}"`;
  const { stdout, stderr } = await execPromise(cmd);

  if (stderr) {
    throw new Error(`FFprobe error: ${stderr}`);
  }

  const vidLengthSeconds = parseFloat(stdout.trim());

  if (isNaN(vidLengthSeconds)) {
    throw new Error("Could not parse duration from ffprobe output");
  }

  const vidLengthMinutes = Math.floor(vidLengthSeconds / 60);

  const timeObj = {
    vidLengthSeconds: vidLengthSeconds,
    vidLengthMinutes: vidLengthMinutes,
  };

  return timeObj;
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
  const { watchPath } = CONFIG;
  const { vidURL, vidData, vidName } = inputObj;
  const { vidSizeBytes, downloadChunks } = vidData;

  //define vid save DIRECTORY
  const vidSavePath = `${watchPath}${vidName}_chunks/`;

  // Create the sub folder for DIRECTORY
  if (!fs.existsSync(vidSavePath)) {
    fs.mkdirSync(vidSavePath, { recursive: true });
  }

  //build params
  const params = {
    url: vidURL,
    downloadChunks: downloadChunks,
    vidSizeBytes: vidSizeBytes,
    vidSavePath: vidSavePath,
    vidName: vidName,
  };

  const vidModel = new KCNA(params);
  const vidObj = await vidModel.downloadVidMultiThread();
  if (!vidObj) return null;

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
