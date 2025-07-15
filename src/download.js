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

  //   console.log("NEW VID DATA");
  //   console.log(newVidData);

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

  //   console.log("GET VID DATA");
  //   console.log(inputObj);

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
  const totalChunks = Math.ceil(vidSizeBytes / vidChunkSize);

  const etag = inputData.etag;
  const serverData = inputData.server;
  const vidEditDate = new Date(inputData["last-modified"]);

  const headerObj = {
    vidSizeBytes: vidSizeBytes,
    vidSizeMB: vidSizeMB,
    totalChunks: totalChunks,
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
      const thumbnailData = await downloadThumbnailFS(downloadArray[i]);
      const vidReturnData = await downloadVidFS(downloadArray[i]);
      if (!thumbnailData || !vidReturnData) continue;

      downloadDataArray.push({
        thumbnailData: thumbnailData,
        vidReturnData: vidReturnData,
      });
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  console.log("DOWNLOAD ARRAY");
  console.log(downloadArray);
};

export const downloadThumbnailFS = async (inputObj) => {
  if (!inputObj || !inputObj.thumbnail) return null;
  const { thumbnail } = inputObj;
  const { watchPath } = CONFIG;

  const nameStart = thumbnail.lastIndexOf("/");
  const nameEnd = thumbnail.lastIndexOf(".");
  const picName = thumbnail.substring(nameStart + 1, nameEnd);

  const savePath = `${watchPath}/${picName}.jpg`;

  //build params
  const params = {
    url: thumbnail,
    savePath: savePath,
    picId: picName,
  };

  const picModel = new KCNA(params);
  const picData = await picModel.downloadPicReq();

  console.log("PIC DATA");
  console.log(picData);

  return picData;
};

export const downloadVidFS = async (inputObj) => {
  if (!inputObj || !inputObj.vidURL || !inputObj.vidData) return null;
  const { tempPath, watchPath } = CONFIG;
  const { vidURL, vidData } = inputObj;
  const { vidSizeBytes, totalChunks } = vidData;

  const nameStart = vidURL.lastIndexOf("/");
  const nameEnd = vidURL.lastIndexOf(".");
  const vidName = vidURL.substring(nameStart + 1, nameEnd);

  const savePath = `${watchPath}/${vidName}.mp4`;

  const params = {
    url: vidURL,
    savePath: savePath,
    vidTempPath: tempPath,
    totalChunks: totalChunks,
    vidSizeBytes: vidSizeBytes,
  };

  const vidModel = new KCNA(params);
  const vidReturnData = await vidModel.downloadVidMultiThread();

  console.log("VID RETURN DATA");
  console.log(vidReturnData);

  return vidReturnData;
};
